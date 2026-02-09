import * as Cesium from "cesium";
import type { Primitive } from "cesium";
import { BaseDraw, DrawLine, DrawPolygon, DrawRectangle, DrawCircle, type DrawCallbacks, type DrawOptions, type DrawEntity, toggleSelectedStyle } from './drawHelper';
import { wouldCreatePolygonSelfIntersection } from '../utils/selfIntersection';
import { i18n } from './i18n';
/**
 * Cesium 绘图辅助工具类
 * 支持绘制点、线、多边形、矩形，并提供编辑和删除功能
 * 适用于 Cesium 1.132.0
 */
class DrawHelper {
  private viewer: Cesium.Viewer;
  private scene: Cesium.Scene;
  private entities: Cesium.EntityCollection;

  // 绘图状态和数据
  private drawMode: "line" | "polygon" | "rectangle" | "circle" | null = null;
  private isDrawing: boolean = false;
  private tempPositions: Cesium.Cartesian3[] = [];
  private tempEntities: Cesium.Entity[] = []; // 临时实体，用于绘制过程中
  private tempLabelEntities: Cesium.Entity[] = []; // 临时标签实体
  private finishedEntities: Cesium.Entity[] = []; // 已完成的实体
  private finishedLabelEntities: Cesium.Entity[] = []; // 已完成的标签实体
  private finishedPointEntities: Cesium.Entity[] = []; // 已完成的点实体
  private publicEntities: Cesium.Entity[] = []; // 通过公共方法创建的实体
  private _doubleClickPending: boolean = false; // 双击判断
  // 最近一次鼠标移动位置，用于在右键删点后立即重绘预览
  private lastPreviewPosition: Cesium.Cartesian3 | null = null;

  // 绘制步骤提示（跟随鼠标的提示 Label）
  private drawHintEntity: Cesium.Entity | null = null;
  private drawHintText: string = "";
  private drawHintLastPosition: Cesium.Cartesian3 | null = null;

  // 提示文案临时覆盖（用于“多边形不能交叉”等即时反馈）
  private drawHintOverrideText: string | null = null;
  private drawHintOverrideUntil = 0;

  // 最近一次左键点击上下文（用于 renderError 定位）
  private lastLeftClickDebug: {
    time: number;
    mode: string | null;
    isDrawing: boolean;
    pickedCartesian?: { x: number; y: number; z: number } | null;
    tempPositionsCount: number;
    tempEntitiesCount: number;
  } | null = null;

  // 静态：当前处于绘制状态的 DrawHelper，用于跨实例互斥
  private static activeDrawingHelper: DrawHelper | null = null;

  // 绘制类实例
  private drawLine: DrawLine;
  private drawPolygon: DrawPolygon;
  private drawRectangle: DrawRectangle;
  private drawCircle: DrawCircle;
  // 使用抽象基类类型，避免直接依赖子类内部实现
  private currentDrawer: BaseDraw | null = null;
  // 事件处理器
  private screenSpaceEventHandler: Cesium.ScreenSpaceEventHandler | null = null;
  // 实体点击处理器（用于触发绘制完成实体的点击回调与选中样式）
  private entityClickHandler: Cesium.ScreenSpaceEventHandler | null = null;

  // --- 两阶段地形适配（先 NONE，tilesLoaded 后采样/切换） ---
  private terrainRefineQueue: Set<Cesium.Entity> = new Set();
  private terrainRefineInFlight: Set<string> = new Set();
  private terrainRefineLastTick: number = 0;
  private terrainRefineListener: ((scene: Cesium.Scene, time: Cesium.JulianDate) => void) | null = null;

  // --- 绘制期间实体注入防御（拦截其他模块 add 贴地实体导致 TerrainOffsetProperty NaN） ---
  private originalEntityCollectionAdd: ((...args: any[]) => any) | null = null;
  private entityCollectionAddHookInstalled = false;

  // 回调函数
  private onDrawStartCallback: (() => void) | null = null;
  private onDrawEndCallback: ((entity: Cesium.Entity | null) => void) | null = null;
  private onEntityRemovedCallback: ((entity: Cesium.Entity) => void) | null = null;
  private onMeasureCompleteCallback: ((result: {
    type: "line" | "polygon" | "rectangle" | "circle";
    positions: Cesium.Cartesian3[];
    distance?: number;
    areaKm2?: number;
  }) => void) | null = null;
  private offsetHeight: number = 2;
  /** 当前绘制配置（用于调度器侧做快速校验/提示） */
  private currentDrawOptions?: DrawOptions;
  // 记录绘制前地形深度测试开关，用于绘制结束或取消时恢复
  private originalDepthTestAgainstTerrain: boolean | null = null;

  private isFiniteCartesian3(pos: any): pos is Cesium.Cartesian3 {
    return (
      !!pos &&
      Number.isFinite((pos as any).x) &&
      Number.isFinite((pos as any).y) &&
      Number.isFinite((pos as any).z)
    );
  }

  private findEntityById(id: string):
    | { entity: Cesium.Entity; source: string; collection: Cesium.EntityCollection }
    | null {
    try {
      const direct = this.viewer.entities.getById(id);
      if (direct) {
        return { entity: direct, source: 'viewer.entities', collection: this.viewer.entities };
      }

      const dsCollection: any = (this.viewer as any).dataSources;
      if (dsCollection && typeof dsCollection.length === 'number' && typeof dsCollection.get === 'function') {
        for (let i = 0; i < dsCollection.length; i++) {
          const ds = dsCollection.get(i);
          const ents = ds?.entities as Cesium.EntityCollection | undefined;
          if (!ents) continue;
          const hit = ents.getById(id);
          if (hit) {
            return { entity: hit, source: `dataSource[${i}]`, collection: ents };
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  private removeEntityById(id: string): boolean {
    try {
      const found = this.findEntityById(id);
      if (!found) return false;
      try {
        return found.collection.remove(found.entity);
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * 在绘制/结束绘制的临界时刻短暂屏蔽 scene.pick 等交互，避免同一点击事件链中
   * 其它模块（如覆盖物服务）继续触发 pick，引发 ground/worker 相关异常。
   */
  private setPickCooldown(ms: number = 800, reason?: string): void {
    try {
      const anyViewer: any = this.viewer as any;
      const until = Date.now() + Math.max(0, ms);
      const cur = Number(anyViewer.__vmapDrawHelperBlockPickUntil) || 0;
      if (until > cur) {
        anyViewer.__vmapDrawHelperBlockPickUntil = until;
      }
      if (reason) {
        anyViewer.__vmapDrawHelperBlockPickReason = reason;
      }
    } catch {
      // ignore
    }
  }

  private isPickBlocked(): boolean {
    try {
      const anyViewer: any = this.viewer as any;
      const until = Number(anyViewer.__vmapDrawHelperBlockPickUntil) || 0;
      return Date.now() < until;
    } catch {
      return false;
    }
  }

  /**
   * 在实体被加入场景后、渲染循环更新前做一次快速校验。
   * 避免某些极端情况下（例如 height 为 Infinity 等）构造出 NaN Cartesian3，导致下一帧渲染直接停止。
   */
  private validateEntityPositionsOrRemove(entity: Cesium.Entity): void {
    try {
      const now = Cesium.JulianDate.now();
      const id = String((entity as any)?.id ?? '');

      // polygon
      if (entity.polygon?.hierarchy) {
        const hierarchy: any = (entity.polygon.hierarchy as any).getValue
          ? (entity.polygon.hierarchy as any).getValue(now)
          : entity.polygon.hierarchy;
        const positions: Cesium.Cartesian3[] | undefined = hierarchy?.positions ?? hierarchy;
        if (Array.isArray(positions) && positions.length > 0) {
          const bad = positions.find((p) => !this.isFiniteCartesian3(p));
          if (bad) {
            console.warn('Removed newly-created invalid polygon entity:', entity.id, bad);
            if (!this.entities.remove(entity) && id) {
              this.removeEntityById(id);
            }
            return;
          }
        }
      }

      // polyline
      if (entity.polyline?.positions) {
        const positions: any = (entity.polyline.positions as any).getValue
          ? (entity.polyline.positions as any).getValue(now)
          : entity.polyline.positions;
        if (Array.isArray(positions) && positions.length > 0) {
          const bad = positions.find((p) => !this.isFiniteCartesian3(p));
          if (bad) {
            console.warn('Removed newly-created invalid polyline entity:', entity.id, bad);
            if (!this.entities.remove(entity) && id) {
              this.removeEntityById(id);
            }
            return;
          }
        }
      }

      // position (point/label/billboard)
      if (entity.position) {
        const pos = (entity.position as any).getValue ? (entity.position as any).getValue(now) : entity.position;
        if (pos && !this.isFiniteCartesian3(pos)) {
          console.warn('Removed newly-created invalid positioned entity:', entity.id, pos);
          if (!this.entities.remove(entity) && id) {
            this.removeEntityById(id);
          }
          return;
        }
      }
    } catch (e) {
      console.warn('validateEntityPositionsOrRemove failed', (entity as any)?.id, e);
    }
  }

  /**
   * 防御性清理：移除包含 NaN/Infinity 坐标的实体。
   * 这类实体会在 Cesium 的 GeometryUpdater/TerrainOffsetProperty 更新阶段持续抛错，
   * 即使后续代码已修复输入，也会因旧实体仍存在而反复报错。
   */
  private removeEntitiesWithInvalidPositions(): void {
    try {
      const now = Cesium.JulianDate.now();

      const scanAndRemove = (collection: Cesium.EntityCollection) => {
        const all = collection.values.slice();
        for (const entity of all) {
          if (!entity) continue;

          // polygon
          if (entity.polygon?.hierarchy) {
            try {
              const hierarchy: any = (entity.polygon.hierarchy as any).getValue
                ? (entity.polygon.hierarchy as any).getValue(now)
                : entity.polygon.hierarchy;
              const positions: Cesium.Cartesian3[] | undefined = hierarchy?.positions ?? hierarchy;
              if (Array.isArray(positions) && positions.length > 0) {
                const bad = positions.find(
                  (p) =>
                    !p ||
                    !Number.isFinite((p as any).x) ||
                    !Number.isFinite((p as any).y) ||
                    !Number.isFinite((p as any).z)
                );
                if (bad) {
                  console.warn('Removed invalid polygon entity (NaN positions):', entity.id, bad);
                  collection.remove(entity);
                  continue;
                }
              }
            } catch {
              // 若获取层级失败，也移除以避免持续报错
              console.warn('Removed invalid polygon entity (hierarchy unreadable):', entity.id);
              collection.remove(entity);
              continue;
            }
          }

          // polyline
          if (entity.polyline?.positions) {
            try {
              const positions: any = (entity.polyline.positions as any).getValue
                ? (entity.polyline.positions as any).getValue(now)
                : entity.polyline.positions;
              if (Array.isArray(positions) && positions.length > 0) {
                const bad = positions.find(
                  (p) =>
                    !p ||
                    !Number.isFinite((p as any).x) ||
                    !Number.isFinite((p as any).y) ||
                    !Number.isFinite((p as any).z)
                );
                if (bad) {
                  console.warn('Removed invalid polyline entity (NaN positions):', entity.id, bad);
                  collection.remove(entity);
                  continue;
                }
              }
            } catch {
              console.warn('Removed invalid polyline entity (positions unreadable):', entity.id);
              collection.remove(entity);
              continue;
            }
          }

          // position (point/label/billboard)
          if (entity.position) {
            try {
              const pos: any = (entity.position as any).getValue ? (entity.position as any).getValue(now) : entity.position;
              if (pos && (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z))) {
                console.warn('Removed invalid positioned entity (NaN position):', entity.id, pos);
                collection.remove(entity);
                continue;
              }
            } catch {
              // 避免误删：某些临时实体在创建/更新的瞬间 position 可能短暂不可读（或被外部 Proxy 包装）。
              // 这里选择跳过而不是移除，防止绘制时红色点位球体“点了就没”。
              console.warn('Skipped positioned entity (position unreadable):', entity.id);
            }
          }
        }
      };

      // viewer.entities
      scanAndRemove(this.entities);

      // viewer.dataSources (some code paths create entities in CustomDataSource)
      const dsCollection: any = (this.viewer as any).dataSources;
      if (dsCollection && typeof dsCollection.length === 'number' && typeof dsCollection.get === 'function') {
        for (let i = 0; i < dsCollection.length; i++) {
          const ds = dsCollection.get(i);
          const ents = ds?.entities as Cesium.EntityCollection | undefined;
          if (ents) scanAndRemove(ents);
        }
      }
    } catch (e) {
      console.warn('removeEntitiesWithInvalidPositions failed', e);
    }
  }

  /**
   * 构造函数
   * @param viewer Cesium Viewer 实例
   */
  constructor(viewer: Cesium.Viewer) {
    if (!viewer || !(viewer instanceof Cesium.Viewer)) {
      throw new Error("Invalid Cesium Viewer instance provided.");
    }

    this.viewer = viewer;
    this.scene = viewer.scene;
    this.entities = viewer.entities;

    // 兜底触发统计：用于确认 NaN 恢复逻辑是否曾经触发过
    try {
      const anyViewer: any = this.viewer as any;
      if (typeof anyViewer.__vmapDrawHelperNaNRecoveredCount !== 'number') {
        anyViewer.__vmapDrawHelperNaNRecoveredCount = 0;
      }
    } catch {
      // ignore
    }

    // 根据地图模式设置偏移高度
    this.updateOffsetHeight();

    // 确保启用地形深度测试以获得正确的高度
    // this.scene.globe.depthTestAgainstTerrain = true;

    // 初始化绘制类实例
    const callbacks: DrawCallbacks = {
      onDrawStart: () => {
        if (this.onDrawStartCallback) {
          this.onDrawStartCallback();
        }
      },
      onDrawEnd: (entity) => {
        if (this.onDrawEndCallback) {
          this.onDrawEndCallback(entity);
        }
      },
      onEntityRemoved: (entity) => {
        if (this.onEntityRemovedCallback) {
          this.onEntityRemovedCallback(entity);
        }
      },
      onMeasureComplete: (result) => {
        if (this.onMeasureCompleteCallback) {
          this.onMeasureCompleteCallback(result);
        }
      }
    };

    this.drawLine = new DrawLine(viewer, callbacks);
    this.drawPolygon = new DrawPolygon(viewer, callbacks);
    this.drawRectangle = new DrawRectangle(viewer, callbacks);
    this.drawCircle = new DrawCircle(viewer, callbacks);

    // 兜底定位：NaN 偶发时常发生在 GroundGeometryUpdater 内部构造 TerrainOffsetProperty。
    // 在抛错前抓取触发的 entity 快照，便于直接锁定来源。
    this.installGroundGeometryUpdaterDebugHook();

    // showErrorPanel：有些 NaN 会直接走 CesiumWidget.showErrorPanel 而不触发 scene.renderError
    // 这里安装兜底钩子，确保能输出诊断并尽量清理脏实体。
    try {
      const anyViewer: any = this.viewer as any;
      if (!anyViewer.__vmapDrawHelperShowErrorPanelHookInstalled) {
        anyViewer.__vmapDrawHelperShowErrorPanelHookInstalled = true;
        const widget: any = this.viewer.cesiumWidget as any;
        if (widget && typeof widget.showErrorPanel === 'function') {
          const original = widget.showErrorPanel.bind(widget);
          widget.showErrorPanel = (title: any, message: any, error: any) => {
            try {
              console.error('[DrawHelper] CesiumWidget.showErrorPanel:', { title, message, error });
              try {
                const dbg = (this.viewer as any).__vmapDrawHelperLastLeftClickDebug;
                if (dbg) console.warn('[DrawHelper] lastLeftClickDebug:', dbg);
              } catch {
                // ignore
              }

              try {
                const groundDbg = (this.viewer as any).__vmapDrawHelperLastGroundUpdaterThrow;
                if (groundDbg) console.warn('[DrawHelper] lastGroundUpdaterThrow:', groundDbg);

                try {
                  const anyViewer: any = this.viewer as any;
                  console.warn('[DrawHelper] NaNRecoveredCount:', anyViewer.__vmapDrawHelperNaNRecoveredCount || 0);
                } catch {
                  // ignore
                }

                const entityId = groundDbg?.entityId ? String(groundDbg.entityId) : '';
                if (entityId) {
                  const found = this.findEntityById(entityId);
                  if (found) {
                    const anyEnt: any = found.entity as any;
                    console.warn('[DrawHelper] lastGroundUpdaterThrow entity found:', {
                      id: entityId,
                      source: found.source,
                      name: (found.entity as any).name,
                      drawType: anyEnt?._drawType,
                      overlayType: anyEnt?._overlayType,
                      hasPolygon: !!anyEnt?.polygon,
                      hasRectangle: !!anyEnt?.rectangle,
                      hasEllipse: !!anyEnt?.ellipse,
                      hasPolyline: !!anyEnt?.polyline,
                    });
                  } else {
                    console.warn('[DrawHelper] lastGroundUpdaterThrow entity NOT found:', entityId);
                  }
                }
              } catch {
                // ignore
              }

              // 扫描并输出当前可疑实体（贴地/相对地面 + NaN/Infinity 位置）
              const report = this.dumpPotentialClampingEntities('showErrorPanel');
              try {
                (this.viewer as any).__vmapDrawHelperLastNaNReport = report;
              } catch {
                // ignore
              }
              this.removeEntitiesWithInvalidPositions();
            } catch (e) {
              console.warn('[DrawHelper] showErrorPanel diagnostic failed', e);
            }
            return original(title, message, error);
          };
        }
      }
    } catch {
      // ignore
    }

    // renderError：当 Cesium 渲染停止时，输出诊断信息，帮助定位是哪类实体触发 clamping NaN
    try {
      const anyViewer: any = this.viewer as any;
      if (!anyViewer.__vmapDrawHelperRenderErrorInstalled) {
        anyViewer.__vmapDrawHelperRenderErrorInstalled = true;
        this.scene.renderError.addEventListener((_scene: Cesium.Scene, error: any) => {
          try {
            console.error('[DrawHelper] scene.renderError:', error);
            const dbg = (anyViewer.__vmapDrawHelperLastLeftClickDebug || null) as any;
            if (dbg) {
              console.error('[DrawHelper] lastLeftClickDebug:', dbg);
            }

            // 扫描当前场景中所有 polygon/polyline（含 dataSources），打印非 NONE/贴地项
            const now = Cesium.JulianDate.now();
            const scan = (collection: Cesium.EntityCollection, tag: string) => {
              const all = collection.values.slice();
              for (const entity of all) {
                if (!entity) continue;
                try {
                  if (entity.polygon) {
                    const hrAny: any = (entity.polygon as any).heightReference;
                    const hr = hrAny?.getValue ? hrAny.getValue(now) : hrAny;
                    const hierarchyAny: any = (entity.polygon as any).hierarchy;
                    const hierarchy = hierarchyAny?.getValue ? hierarchyAny.getValue(now) : hierarchyAny;
                    const positions: any = hierarchy?.positions ?? hierarchy;
                    const bad = Array.isArray(positions)
                      ? positions.find((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z))
                      : null;
                    if (bad) {
                      console.error(`[DrawHelper] BAD polygon positions (${tag})`, entity.id, bad, 'heightReference=', hr);
                    } else if (hr && hr !== Cesium.HeightReference.NONE) {
                      console.warn(`[DrawHelper] polygon heightReference!=NONE (${tag})`, entity.id, hr);
                    }
                  }
                  if (entity.polyline) {
                    const clampAny: any = (entity.polyline as any).clampToGround;
                    const clamp = clampAny?.getValue ? clampAny.getValue(now) : clampAny;
                    const posAny: any = (entity.polyline as any).positions;
                    const positions = posAny?.getValue ? posAny.getValue(now) : posAny;
                    const bad = Array.isArray(positions)
                      ? positions.find((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z))
                      : null;
                    if (bad) {
                      console.error(`[DrawHelper] BAD polyline positions (${tag})`, entity.id, bad, 'clampToGround=', clamp);
                    } else if (clamp === true) {
                      console.warn(`[DrawHelper] polyline clampToGround=true (${tag})`, entity.id);
                    }
                  }

                  // point/label/billboard：位置与 heightReference 也可能触发 TerrainOffsetProperty NaN
                  if (entity.position) {
                    const posAny: any = entity.position as any;
                    const pos = posAny?.getValue ? posAny.getValue(now) : posAny;
                    if (pos && (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z))) {
                      console.error(`[DrawHelper] BAD entity.position (${tag})`, entity.id, pos, {
                        hasPoint: !!(entity as any).point,
                        hasLabel: !!(entity as any).label,
                        hasBillboard: !!(entity as any).billboard,
                      });
                    }
                  }
                  if (entity.point) {
                    const hrAny: any = (entity.point as any).heightReference;
                    const hr = hrAny?.getValue ? hrAny.getValue(now) : hrAny;
                    if (hr && hr !== Cesium.HeightReference.NONE) {
                      console.warn(`[DrawHelper] point heightReference!=NONE (${tag})`, entity.id, hr);
                    }
                  }
                  if (entity.label) {
                    const hrAny: any = (entity.label as any).heightReference;
                    const hr = hrAny?.getValue ? hrAny.getValue(now) : hrAny;
                    if (hr && hr !== Cesium.HeightReference.NONE) {
                      console.warn(`[DrawHelper] label heightReference!=NONE (${tag})`, entity.id, hr);
                    }
                  }
                  if (entity.billboard) {
                    const hrAny: any = (entity.billboard as any).heightReference;
                    const hr = hrAny?.getValue ? hrAny.getValue(now) : hrAny;
                    if (hr && hr !== Cesium.HeightReference.NONE) {
                      console.warn(`[DrawHelper] billboard heightReference!=NONE (${tag})`, entity.id, hr);
                    }
                  }
                } catch {
                  // ignore
                }
              }
            };

            scan(this.viewer.entities, 'viewer.entities');
            const dsCollection: any = (this.viewer as any).dataSources;
            if (dsCollection && typeof dsCollection.length === 'number' && typeof dsCollection.get === 'function') {
              for (let i = 0; i < dsCollection.length; i++) {
                const ds = dsCollection.get(i);
                const ents = ds?.entities as Cesium.EntityCollection | undefined;
                if (ents) scan(ents, `dataSources[${i}]`);
              }
            }
          } catch (e) {
            console.warn('[DrawHelper] renderError diagnostic failed', e);
          }
        });
      }
    } catch {
      // ignore
    }

    // 安装“两阶段地形适配”监听：tilesLoaded 后异步采样并更新实体。
    // 注意：同一 viewer 可能因 HMR/多实例重复创建 DrawHelper，这里会替换旧监听。
    try {
      const anyViewer: any = this.viewer as any;
      const prev = anyViewer.__vmapDrawHelperTerrainRefineListener as
        | ((scene: Cesium.Scene, time: Cesium.JulianDate) => void)
        | undefined;
      if (prev) {
        try {
          this.scene.postRender.removeEventListener(prev);
        } catch {
          // ignore
        }
      }
      this.terrainRefineListener = () => {
        this.processTerrainRefineQueue();
      };
      anyViewer.__vmapDrawHelperTerrainRefineListener = this.terrainRefineListener;
      this.scene.postRender.addEventListener(this.terrainRefineListener);
    } catch {
      // ignore
    }

    // 实体点击处理（用于触发绘制完成实体的点击回调和选中样式）
    try {
      // 防 HMR/多实例：如果同一个 viewer 上已经存在旧的 handler，先销毁
      const anyViewer: any = this.viewer as any;
      const prev = anyViewer.__vmapDrawHelperEntityClickHandler as Cesium.ScreenSpaceEventHandler | undefined;
      if (prev && typeof (prev as any).destroy === 'function') {
        try { prev.destroy(); } catch { /* ignore */ }
      }

      this.entityClickHandler = new Cesium.ScreenSpaceEventHandler(this.scene.canvas);
      anyViewer.__vmapDrawHelperEntityClickHandler = this.entityClickHandler;

      this.entityClickHandler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        // 只要“任何实例”处于绘制状态，就全局禁用实体点击逻辑，避免多实例 handler 交叉触发
        if (DrawHelper.activeDrawingHelper) return;
        if (this.isDrawing) return; // 绘制时忽略实体点击
        // 绘制刚结束/切换状态的短窗口内，禁用 pick，避免与 OverlayService 等其它 handler 争用
        if (this.isPickBlocked()) return;
        const picked = this.scene.pick(click.position as any);
        const entity = picked && (picked as any).id as Cesium.Entity | undefined;
        if (!entity) return;

        const drawEntity = entity as DrawEntity;

        // 只处理由绘制模块创建的实体，普通覆盖物交给 CesiumOverlayService 处理，避免重复触发
        const isDrawEntity = drawEntity._drawType !== undefined;
        if (!isDrawEntity) {
          return;
        }

        // 用户回调
        const cb = drawEntity._onClick as ((entity: Cesium.Entity, type?: any, positions?: Cesium.Cartesian3[]) => void) | undefined;
        try {
          if (cb) {
            const pos = drawEntity._groundPositions || drawEntity._groundPosition || undefined;
            const normalizedPos = Array.isArray(pos) ? pos : pos ? [pos] : undefined;
            cb(drawEntity, drawEntity._drawType, normalizedPos);
          }
        } catch (e) {
          console.warn('entity onClick handler error', e);
        }

        // 切换选中样式
        const opts = drawEntity._drawOptions as DrawOptions | undefined;
        if (opts?.selected) {
          toggleSelectedStyle(drawEntity);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } catch (e) {
      // 安全忽略初始化错误
      console.warn('entity click handler init failed', e);
    }
  }

  private dumpPotentialClampingEntities(tag: string): {
    time: number;
    tag: string;
    suspects: Array<{ source: string; id: string; kind: string; value?: any }>;
    invalidPositions: Array<{ source: string; id: string; kind: string }>;
    scanned: { viewerEntities: number; dataSources: number };
  } {
    const report = {
      time: Date.now(),
      tag,
      suspects: [] as Array<{ source: string; id: string; kind: string; value?: any }>,
      invalidPositions: [] as Array<{ source: string; id: string; kind: string }>,
      scanned: { viewerEntities: 0, dataSources: 0 },
    };
    try {
      const now = Cesium.JulianDate.now();
      const scanCollection = (collection: Cesium.EntityCollection, source: string) => {
        const all = collection.values.slice();
        if (source === 'viewer.entities') report.scanned.viewerEntities = all.length;
        for (const entity of all) {
          if (!entity) continue;

          // polygon heightReference
          if (entity.polygon && (entity.polygon as any).heightReference) {
            const hrProp: any = (entity.polygon as any).heightReference;
            const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
            if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'polygon.heightReference', value: hr });
            }
          }

          // polygon extrudedHeightReference
          if (entity.polygon && (entity.polygon as any).extrudedHeightReference) {
            const ehrProp: any = (entity.polygon as any).extrudedHeightReference;
            const ehr = ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp;
            if (ehr === Cesium.HeightReference.CLAMP_TO_GROUND || ehr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'polygon.extrudedHeightReference', value: ehr });
            }
          }

          // polygon classificationType (可能走 ground pipeline)
          if (entity.polygon && (entity.polygon as any).classificationType) {
            const ctProp: any = (entity.polygon as any).classificationType;
            const ct = ctProp?.getValue ? ctProp.getValue(now) : ctProp;
            if (ct === (Cesium as any).ClassificationType?.TERRAIN) {
              report.suspects.push({ source, id: String(entity.id), kind: 'polygon.classificationType=TERRAIN', value: ct });
            }
          }

          if (entity.rectangle && (entity.rectangle as any).heightReference) {
            const hrProp: any = (entity.rectangle as any).heightReference;
            const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
            if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'rectangle.heightReference', value: hr });
            }
          }

          if (entity.rectangle && (entity.rectangle as any).extrudedHeightReference) {
            const ehrProp: any = (entity.rectangle as any).extrudedHeightReference;
            const ehr = ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp;
            if (ehr === Cesium.HeightReference.CLAMP_TO_GROUND || ehr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'rectangle.extrudedHeightReference', value: ehr });
            }
          }

          if (entity.ellipse && (entity.ellipse as any).heightReference) {
            const hrProp: any = (entity.ellipse as any).heightReference;
            const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
            if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'ellipse.heightReference', value: hr });
            }
          }

          if (entity.ellipse && (entity.ellipse as any).extrudedHeightReference) {
            const ehrProp: any = (entity.ellipse as any).extrudedHeightReference;
            const ehr = ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp;
            if (ehr === Cesium.HeightReference.CLAMP_TO_GROUND || ehr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'ellipse.extrudedHeightReference', value: ehr });
            }
          }

          // polyline clampToGround
          if (entity.polyline && (entity.polyline as any).clampToGround) {
            const ctgProp: any = (entity.polyline as any).clampToGround;
            const ctg = ctgProp?.getValue ? ctgProp.getValue(now) : ctgProp;
            if (ctg === true) {
              report.suspects.push({ source, id: String(entity.id), kind: 'polyline.clampToGround', value: true });
            }
          }

          // point/label/billboard heightReference
          if (entity.point && (entity.point as any).heightReference) {
            const hrProp: any = (entity.point as any).heightReference;
            const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
            if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'point.heightReference', value: hr });
            }
          }
          if (entity.label && (entity.label as any).heightReference) {
            const hrProp: any = (entity.label as any).heightReference;
            const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
            if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'label.heightReference', value: hr });
            }
          }
          if (entity.billboard && (entity.billboard as any).heightReference) {
            const hrProp: any = (entity.billboard as any).heightReference;
            const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
            if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
              report.suspects.push({ source, id: String(entity.id), kind: 'billboard.heightReference', value: hr });
            }
          }

          // position validity (for quick hint)
          if (entity.position) {
            try {
              const pos = (entity.position as any).getValue ? (entity.position as any).getValue(now) : entity.position;
              if (pos && !this.isFiniteCartesian3(pos)) {
                report.invalidPositions.push({ source, id: String(entity.id), kind: 'position' });
              }
            } catch {
              // ignore
            }
          }
        }
      };

      scanCollection(this.entities, 'viewer.entities');
      const dsCollection: any = (this.viewer as any).dataSources;
      if (dsCollection && typeof dsCollection.length === 'number' && typeof dsCollection.get === 'function') {
        report.scanned.dataSources = dsCollection.length;
        for (let i = 0; i < dsCollection.length; i++) {
          const ds = dsCollection.get(i);
          const ents = ds?.entities as Cesium.EntityCollection | undefined;
          if (ents) scanCollection(ents, `dataSource[${i}]`);
        }
      }
    } catch {
      // ignore
    }

    // 输出一个更显眼的汇总（避免日志被大量堆栈淹没）
    try {
      console.warn('[DrawHelper] NaN diagnostic report:', {
        tag: report.tag,
        time: report.time,
        scanned: report.scanned,
        suspectCount: report.suspects.length,
        invalidPositionCount: report.invalidPositions.length,
      });
      if (report.suspects.length) console.warn('[DrawHelper] suspects:', report.suspects.slice(0, 30));
      if (report.invalidPositions.length) console.warn('[DrawHelper] invalidPositions:', report.invalidPositions.slice(0, 30));
    } catch {
      // ignore
    }
    return report;
  }

  /**
   * 对新创建的实体进行净化处理，确保其符合渲染要求
   * @param entity - 需要净化的 Cesium.Entity 对象
   * @param tag - 用于标识来源的标签，会在控制台警告时显示
   */
  private sanitizeNewEntity(entity: Cesium.Entity, tag: string): void {
    try {
      // 如果实体不存在，直接返回
      if (!entity) return;
      // 获取当前时间
      const now = Cesium.JulianDate.now();

      // 1) 禁止触发 TerrainOffsetProperty：把所有 CLAMP/RELATIVE 降级为 NONE
      // 处理多边形的高度参考
      if (entity.polygon && (entity.polygon as any).heightReference) {
        const hrProp: any = (entity.polygon as any).heightReference;
        const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
        if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.polygon as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized polygon heightReference (${tag})`, entity.id);
        }
      }

      // 处理多边形的拉伸高度参考
      if (entity.polygon && (entity.polygon as any).extrudedHeightReference) {
        const ehrProp: any = (entity.polygon as any).extrudedHeightReference;
        const ehr = ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp;
        if (ehr === Cesium.HeightReference.CLAMP_TO_GROUND || ehr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.polygon as any).extrudedHeightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized polygon extrudedHeightReference (${tag})`, entity.id);
        }
      }
      // 处理矩形的高度参考
      if (entity.rectangle && (entity.rectangle as any).heightReference) {
        const hrProp: any = (entity.rectangle as any).heightReference;
        const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
        if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.rectangle as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized rectangle heightReference (${tag})`, entity.id);
        }
      }

      // 处理矩形的拉伸高度参考
      if (entity.rectangle && (entity.rectangle as any).extrudedHeightReference) {
        const ehrProp: any = (entity.rectangle as any).extrudedHeightReference;
        const ehr = ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp;
        if (ehr === Cesium.HeightReference.CLAMP_TO_GROUND || ehr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.rectangle as any).extrudedHeightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized rectangle extrudedHeightReference (${tag})`, entity.id);
        }
      }
      // 处理椭圆的高度参考
      if (entity.ellipse && (entity.ellipse as any).heightReference) {
        const hrProp: any = (entity.ellipse as any).heightReference;
        const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
        if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.ellipse as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized ellipse heightReference (${tag})`, entity.id);
        }
      }

      // 处理椭圆的拉伸高度参考
      if (entity.ellipse && (entity.ellipse as any).extrudedHeightReference) {
        const ehrProp: any = (entity.ellipse as any).extrudedHeightReference;
        const ehr = ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp;
        if (ehr === Cesium.HeightReference.CLAMP_TO_GROUND || ehr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.ellipse as any).extrudedHeightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized ellipse extrudedHeightReference (${tag})`, entity.id);
        }
      }
      // 处理折线的贴地属性
      if (entity.polyline && (entity.polyline as any).clampToGround) {
        const ctgProp: any = (entity.polyline as any).clampToGround;
        const ctg = ctgProp?.getValue ? ctgProp.getValue(now) : ctgProp;
        if (ctg === true) {
          (entity.polyline as any).clampToGround = new Cesium.ConstantProperty(false);
          console.warn(`[DrawHelper] sanitized polyline clampToGround (${tag})`, entity.id);
        }
      }

      // 处理点的高度参考
      if (entity.point && (entity.point as any).heightReference) {
        const hrProp: any = (entity.point as any).heightReference;
        const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
        if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.point as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized point heightReference (${tag})`, entity.id);
        }
      }
      // 处理标签的高度参考
      if (entity.label && (entity.label as any).heightReference) {
        const hrProp: any = (entity.label as any).heightReference;
        const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
        if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.label as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized label heightReference (${tag})`, entity.id);
        }
      }
      if (entity.billboard && (entity.billboard as any).heightReference) {
        const hrProp: any = (entity.billboard as any).heightReference;
        const hr = hrProp?.getValue ? hrProp.getValue(now) : hrProp;
        if (hr === Cesium.HeightReference.CLAMP_TO_GROUND || hr === Cesium.HeightReference.RELATIVE_TO_GROUND) {
          (entity.billboard as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          console.warn(`[DrawHelper] sanitized billboard heightReference (${tag})`, entity.id);
        }
      }

      // 2) 如果包含 NaN/Infinity，立即移除（否则下一帧 GeometryUpdater 会直接停渲染）
      this.validateEntityPositionsOrRemove(entity);
    } catch {
      // ignore
    }
  }

  private installEntitiesAddHook(): void {
    if (this.entityCollectionAddHookInstalled) return;
    try {
      const proto: any = (Cesium as any).EntityCollection?.prototype;
      if (!proto || typeof proto.add !== 'function') return;
      this.originalEntityCollectionAdd = proto.add;
      const self = this;
      proto.add = function (this: any, options: any) {
        const entity = self.originalEntityCollectionAdd!.call(this, options);
        // 只在绘制中启用：避免影响正常覆盖物
        if (self.isDrawing) {
          self.sanitizeNewEntity(entity, 'EntityCollection.add(during-draw)');
        }
        return entity;
      };
      this.entityCollectionAddHookInstalled = true;
    } catch {
      // ignore
    }
  }

  private uninstallEntitiesAddHook(): void {
    if (!this.entityCollectionAddHookInstalled) return;
    try {
      const proto: any = (Cesium as any).EntityCollection?.prototype;
      if (proto && this.originalEntityCollectionAdd) {
        proto.add = this.originalEntityCollectionAdd;
      }
    } catch {
      // ignore
    }
    this.originalEntityCollectionAdd = null;
    this.entityCollectionAddHookInstalled = false;
  }

  /**
   * 安装地面几何更新器调试钩子
   * 此方法用于在Cesium GroundGeometryUpdater中安装一个调试钩子，用于捕获和处理渲染错误
   */
  private installGroundGeometryUpdaterDebugHook(): void {
    try {
      // 将viewer转换为any类型，以便访问内部属性
      const anyViewer: any = this.viewer as any;
      // 检查钩子是否已经安装，避免重复安装
      if (anyViewer.__vmapDrawHelperGroundUpdaterHookInstalled) return;

      // 获取Cesium的GroundGeometryUpdater类
      const GG: any = (Cesium as any).GroundGeometryUpdater;
      // 获取原型对象
      const proto: any = GG?.prototype;
      // 获取原始的_onEntityPropertyChanged方法
      const original: any = proto?._onEntityPropertyChanged;
      // 检查原型和方法是否存在
      if (!proto || typeof original !== 'function') return;

      // 标记钩子已安装
      anyViewer.__vmapDrawHelperGroundUpdaterHookInstalled = true;
      // 保存当前实例引用
      const self = this;

      // 重写_onEntityPropertyChanged方法
      proto._onEntityPropertyChanged = function (...args: any[]) {
        // 获取实体和属性名
        const entity: any = args?.[0];
        const propertyName: any = args?.[1];

        // 预检查：如果 polygon hierarchy 已经含 NaN/Infinity，直接移除该实体，避免进入 Cesium 的 clamping 逻辑后停渲染。
        try {
          if (entity?.polygon && propertyName === 'polygon') {
            const now = Cesium.JulianDate.now();
            const hierarchyAny: any = (entity.polygon as any).hierarchy;
            const hierarchy = hierarchyAny?.getValue ? hierarchyAny.getValue(now) : hierarchyAny;
            const positions: any[] = hierarchy?.positions ?? hierarchy;
            if (Array.isArray(positions) && positions.length > 0) {
              const bad = positions.find((p) => !p || !self.isFiniteCartesian3(p));
              if (bad) {
                const entityId = entity?.id !== undefined ? String(entity.id) : '';

                try {
                  anyViewer.__vmapDrawHelperNaNRecoveredCount = (Number(anyViewer.__vmapDrawHelperNaNRecoveredCount) || 0) + 1;
                  anyViewer.__vmapDrawHelperNaNRecoveredLastAt = Date.now();
                  anyViewer.__vmapDrawHelperNaNRecoveredLastReason = 'ground-precheck-invalid-position';
                } catch {
                  // ignore
                }

                anyViewer.__vmapDrawHelperLastGroundUpdaterThrow = {
                  time: Date.now(),
                  propertyName,
                  entityId,
                  reason: 'precheck-invalid-position',
                  firstInvalidPosition: bad,
                };
                console.error('[DrawHelper] GroundGeometryUpdater precheck removed invalid entity:', {
                  entityId,
                  propertyName,
                  bad,
                });
                if (entityId) {
                  self.removeEntityById(entityId);
                }
                return;
              }
            }
          }
        } catch {
          // ignore
        }

        try {
          return original.apply(this, args);
        } catch (e: any) {
          try {
            const now = Cesium.JulianDate.now();
            const snapshot: any = {
              time: Date.now(),
              propertyName,
              entityId: entity?.id !== undefined ? String(entity.id) : undefined,
              hasPolygon: !!entity?.polygon,
              hasRectangle: !!entity?.rectangle,
              hasEllipse: !!entity?.ellipse,
            };

            if (entity?.polygon) {
              const poly: any = entity.polygon;
              const hrProp: any = poly.heightReference;
              const ehrProp: any = poly.extrudedHeightReference;
              const ctProp: any = poly.classificationType;
              const pphProp: any = poly.perPositionHeight;
              snapshot.polygon = {
                heightReference: hrProp?.getValue ? hrProp.getValue(now) : hrProp,
                extrudedHeightReference: ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp,
                classificationType: ctProp?.getValue ? ctProp.getValue(now) : ctProp,
                perPositionHeight: pphProp?.getValue ? pphProp.getValue(now) : pphProp,
              };

              try {
                const hierarchyAny: any = poly.hierarchy;
                const hierarchy = hierarchyAny?.getValue ? hierarchyAny.getValue(now) : hierarchyAny;
                const positions: any[] = hierarchy?.positions ?? hierarchy;
                if (Array.isArray(positions)) {
                  const bad = positions.find((p) => !p || !self.isFiniteCartesian3(p));
                  snapshot.polygon.positionsCount = positions.length;
                  snapshot.polygon.hasInvalidPosition = !!bad;
                  if (bad) snapshot.polygon.firstInvalidPosition = bad;
                }
              } catch {
                // ignore
              }
            }

            if (entity?.rectangle) {
              const rect: any = entity.rectangle;
              const hrProp: any = rect.heightReference;
              const ehrProp: any = rect.extrudedHeightReference;
              snapshot.rectangle = {
                heightReference: hrProp?.getValue ? hrProp.getValue(now) : hrProp,
                extrudedHeightReference: ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp,
              };
            }

            if (entity?.ellipse) {
              const ell: any = entity.ellipse;
              const hrProp: any = ell.heightReference;
              const ehrProp: any = ell.extrudedHeightReference;
              snapshot.ellipse = {
                heightReference: hrProp?.getValue ? hrProp.getValue(now) : hrProp,
                extrudedHeightReference: ehrProp?.getValue ? ehrProp.getValue(now) : ehrProp,
              };
            }

            anyViewer.__vmapDrawHelperLastGroundUpdaterThrow = snapshot;

            // 默认不刷屏：该 hook 的主要目的是在 showErrorPanel/renderError 时提供诊断快照。
            // 如需实时输出，将 viewer.__vmapDrawHelperDebugGroundUpdater = true（或 window.__VMAP_DRAWHELPER_DEBUG__ = true）。
            try {
              const enableVerbose =
                !!anyViewer.__vmapDrawHelperDebugGroundUpdater || !!(globalThis as any).__VMAP_DRAWHELPER_DEBUG__;
              const isDrawing = !!anyViewer.__vmapDrawHelperIsDrawing;
              const entityId = snapshot?.entityId ? String(snapshot.entityId) : '';
              const key = `${String(propertyName || '')}|${entityId}`;
              const lastAt = Number(anyViewer.__vmapDrawHelperGroundUpdaterThrowLastLogAt) || 0;
              const lastKey = String(anyViewer.__vmapDrawHelperGroundUpdaterThrowLastLogKey || '');
              const nowAt = Date.now();
              const throttled = nowAt - lastAt < 2000 && lastKey === key;

              if (enableVerbose || (!isDrawing && !throttled)) {
                anyViewer.__vmapDrawHelperGroundUpdaterThrowLastLogAt = nowAt;
                anyViewer.__vmapDrawHelperGroundUpdaterThrowLastLogKey = key;
                console.error('[DrawHelper] GroundGeometryUpdater throw snapshot:', snapshot);
              }
            } catch {
              // ignore
            }
          } catch {
            // ignore
          }

          // 关键兜底：对于 NaN 相关 DeveloperError，移除罪魁祸首并吞掉异常，避免 CesiumWidget 进入“渲染停止”状态。
          try {
            const msg = (e && (e.message || e.toString?.())) ? String(e.message || e.toString()) : '';
            if (msg.includes('NaN component') || msg.includes('cartesian has a NaN')) {
              const entityId = entity?.id !== undefined ? String(entity.id) : '';
              if (entityId) {
                const removed = self.removeEntityById(entityId);
                console.warn('[DrawHelper] Swallowed NaN render error by removing entity:', { entityId, removed });

                try {
                  anyViewer.__vmapDrawHelperNaNRecoveredCount = (Number(anyViewer.__vmapDrawHelperNaNRecoveredCount) || 0) + 1;
                  anyViewer.__vmapDrawHelperNaNRecoveredLastAt = Date.now();
                  anyViewer.__vmapDrawHelperNaNRecoveredLastReason = 'ground-throw-nan-removed';
                  anyViewer.__vmapDrawHelperNaNRecoveredLastEntityId = entityId;
                } catch {
                  // ignore
                }
              }
              return;
            }
          } catch {
            // ignore
          }

          throw e;
        }
      };
    } catch {
      // ignore
    }
  }

  /**
   * 外部调用：在场景模式（2D/3D）切换后，更新偏移高度并重算已完成实体
   */
  public handleSceneModeChanged(): void {
    const oldOffsetHeight = this.offsetHeight;
    this.updateOffsetHeight();
    if (oldOffsetHeight !== this.offsetHeight) {
      this.updateFinishedEntitiesForModeChange();
    }

    // 若正在绘制且提示已显示，场景模式切换后同步提示高度
    if (this.isDrawing && this.drawHintLastPosition) {
      this.updateDrawHintPosition(this.drawHintLastPosition);
    }
  }

  /**
   * 根据场景模式更新偏移高度
   */
  private updateOffsetHeight(): void {
    if (this.scene.mode === Cesium.SceneMode.SCENE3D) {
      this.offsetHeight = 1; // 3D模式使用100米偏移，所有元素都浮动
    } else {
      this.offsetHeight = 0; // 2D模式使用0米偏移，所有元素都贴近地面
    }
  }

  /**
   * 计算提示文本（随绘制模式 + 点数量变化）
   */
  private getDrawHintText(): string {
    if (!this.isDrawing || !this.drawMode) {
      return "";
    }

    // 临时覆盖优先（例如自相交提示）
    if (this.drawHintOverrideText && Date.now() < this.drawHintOverrideUntil) {
      return this.drawHintOverrideText;
    }
    this.drawHintOverrideText = null;
    this.drawHintOverrideUntil = 0;

    const pointCount = this.tempPositions.length;

    switch (this.drawMode) {
      case "circle": {
        if (pointCount === 0) return i18n.t("draw.hint.circle_start");
        if (pointCount === 1) return i18n.t("draw.hint.circle_radius");
        return i18n.t("draw.hint.finish_or_undo");
      }
      case "rectangle": {
        if (pointCount === 0) return i18n.t("draw.hint.rectangle_start");
        if (pointCount === 1) return i18n.t("draw.hint.rectangle_end");
        return i18n.t("draw.hint.finish_or_undo");
      }
      case "polygon": {
        if (pointCount === 0) return i18n.t("draw.hint.polygon_start");
        if (pointCount === 1) return i18n.t("draw.hint.polygon_add" );
        return i18n.t("draw.hint.polygon_continue");
      }
      case "line": {
        if (pointCount === 0) return i18n.t("draw.hint.line_start");
        if (pointCount === 1) return i18n.t("draw.hint.line_add");
        return i18n.t("draw.hint.line_continue");
      }
      default:
        return "";
    }
  }

  /**
   * 设置绘制提示覆盖文本及其持续时间
   * @param text 要显示的提示文本
   * @param ms 提示文本显示的持续时间（毫秒），默认为1200毫秒
   */
  private setDrawHintOverride(text: string, ms: number = 1200): void {
    this.drawHintOverrideText = text; // 设置提示覆盖文本
    this.drawHintOverrideUntil = Date.now() + Math.max(0, ms); // 设置提示文本的过期时间，确保不小于0
    this.refreshDrawHintTextOnly(); // 仅刷新提示文本
  }

  /**
   * 将提示位置转换为显示位置（按当前模式做轻微抬高，避免被地形遮挡）
   */
  private toHintDisplayPosition(position: Cesium.Cartesian3): Cesium.Cartesian3 {
    // 这里不能只依赖 try/catch：fromRadians 传入 NaN 不会 throw，会返回 NaN Cartesian3。
    if (
      !position ||
      !Number.isFinite((position as any).x) ||
      !Number.isFinite((position as any).y) ||
      !Number.isFinite((position as any).z)
    ) {
      return position;
    }
    try {
      const carto = Cesium.Cartographic.fromCartesian(position);
      if (!Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) {
        return position;
      }
      const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
      const extraHeight = this.offsetHeight > 0 ? this.offsetHeight : 0.1;
      const displayPos = Cesium.Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        baseHeight + extraHeight
      );
      if (
        Number.isFinite((displayPos as any).x) &&
        Number.isFinite((displayPos as any).y) &&
        Number.isFinite((displayPos as any).z)
      ) {
        return displayPos;
      }
      return position;
    } catch {
      return position;
    }
  }

  /**
   * 创建或更新提示实体的位置与文本
   */
  private updateDrawHintPosition(position: Cesium.Cartesian3): void {
    if (!this.isDrawing) return;

    const nextText = this.getDrawHintText();
    if (!nextText) {
      this.clearDrawHint();
      return;
    }

    this.drawHintText = nextText;
    this.drawHintLastPosition = position.clone();

    const displayPos = this.toHintDisplayPosition(position);

    if (!this.drawHintEntity) {
      this.drawHintEntity = this.entities.add({
        position: new Cesium.ConstantPositionProperty(displayPos),
        label: {
          text: this.drawHintText,
          font: "14px 'Microsoft YaHei', 'PingFang SC', sans-serif",
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(12, -18),
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.NONE,
          scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.6),
        },
      });
    } else {
      this.drawHintEntity.position = new Cesium.ConstantPositionProperty(displayPos);
      if (this.drawHintEntity.label) {
        this.drawHintEntity.label.text = new Cesium.ConstantProperty(this.drawHintText);
      }
    }
  }

  /**
   * 更新提示文本（不改变位置；通常在点数变化时调用）
   */
  private refreshDrawHintTextOnly(): void {
    const nextText = this.getDrawHintText();
    this.drawHintText = nextText;
    if (!nextText) {
      this.clearDrawHint();
      return;
    }
    if (this.drawHintEntity?.label) {
      this.drawHintEntity.label.text = new Cesium.ConstantProperty(nextText);
    }
  }

  /**
   * 清除绘制提示实体
   */
  private clearDrawHint(): void {
    if (this.drawHintEntity) {
      try {
        this.entities.remove(this.drawHintEntity);
      } catch {
        // ignore
      }
      this.drawHintEntity = null;
    }
    this.drawHintText = "";
    this.drawHintLastPosition = null;
  }

  /**
   * 开始绘制线条
   */
  startDrawingLine(options?: DrawOptions): void {
    this.startDrawing("line", options);
  }

  /**
   * 开始绘制多边形（仅边线）
   */
  startDrawingPolygon(options?: DrawOptions): void {
    this.startDrawing("polygon", options);
  }

  /**
   * 开始绘制矩形
   */
  startDrawingRectangle(options?: DrawOptions): void {
    this.startDrawing("rectangle", options);
  }

  /**
   * 开始绘制圆形
   */
  startDrawingCircle(options?: DrawOptions): void {
    this.startDrawing("circle", options);
  }

  /**
   * 内部统一的开始绘制方法
   * @param mode 绘制模式
   */
  private startDrawing(mode: "line" | "polygon" | "rectangle" | "circle", options?: DrawOptions): void {
    // 防御：清理旧的非法实体，避免其在 render/update 阶段持续抛错
    this.removeEntitiesWithInvalidPositions();

    // 开始绘制的临界时刻，短暂屏蔽外部 pick（例如覆盖物 click handler）
    this.setPickCooldown(500, 'draw-start');

    // 若有其他 DrawHelper 实例正在绘制，先取消其绘制，避免多个实例的事件同时响应
    const active = DrawHelper.activeDrawingHelper;
    if (active && active !== this) {
      active.cancelDrawing();
    }

    // 结束当前实例内部可能残留的绘制状态，但不清空已完成的实体
    this.endDrawingInternal(false);

    // 清理可能残留的提示
    this.clearDrawHint();

    this.drawMode = mode;
    this.isDrawing = true;
    try {
      (this.viewer as any).__vmapDrawHelperIsDrawing = true;
    } catch {
      // ignore
    }
    this.lastPreviewPosition = null;
    DrawHelper.activeDrawingHelper = this;
    this.tempPositions = [];
    this.tempEntities = [];
    this._doubleClickPending = false;
    this.currentDrawOptions = options;

    // 绘制期间拦截 entities.add：若其他模块在同一点击链路中创建贴地实体，先降级/校验避免 NaN 停渲染
    this.installEntitiesAddHook();

    // 选择对应的绘制类
    switch (mode) {
      case "line":
        this.currentDrawer = this.drawLine;
        break;
      case "polygon":
        this.currentDrawer = this.drawPolygon;
        break;
      case "rectangle":
        this.currentDrawer = this.drawRectangle;
        break;
      case "circle":
        this.currentDrawer = this.drawCircle;
        break;
    }

    if (this.currentDrawer) {
      this.currentDrawer.startDrawing(options);
    }

    // 初始化提示文本（位置将在首次鼠标移动/点击时确定）
    this.refreshDrawHintTextOnly();

    this.activateDrawingHandlers();
  }

  /**
   * 激活屏幕空间事件处理器
   */
  private activateDrawingHandlers(): void {
    this.deactivateDrawingHandlers(); // 确保之前的手柄已销毁

    this.screenSpaceEventHandler = new Cesium.ScreenSpaceEventHandler(
      this.scene.canvas
    );

    // 左键点击添加点
    this.screenSpaceEventHandler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (!this.isDrawing) return;
        console.log('左键点击44444444添加点位置');
        // 本次点击事件链中屏蔽其它模块 pick（绘制中通常已屏蔽，但用于“结束绘制”边界的兜底）
        this.setPickCooldown(300, 'draw-left-click');
        // 防御：requestRenderMode 下，点击会触发渲染更新；先清理历史脏实体避免更新阶段抛错
        this.removeEntitiesWithInvalidPositions();

        if (this._doubleClickPending) {
          this._doubleClickPending = false;
          return;
        }
        const cartesian = this.pickGlobePosition(click.position);
        console.log('左键点击55555555添加点位置:', cartesian);

        try {
          const anyViewer: any = this.viewer as any;
          this.lastLeftClickDebug = {
            time: Date.now(),
            mode: this.drawMode,
            isDrawing: this.isDrawing,
            pickedCartesian: cartesian
              ? { x: (cartesian as any).x, y: (cartesian as any).y, z: (cartesian as any).z }
              : null,
            tempPositionsCount: this.tempPositions.length,
            tempEntitiesCount: this.tempEntities.length,
          };
          anyViewer.__vmapDrawHelperLastLeftClickDebug = this.lastLeftClickDebug;
        } catch {
          // ignore
        }

        if (cartesian) {
          // 点击时同步提示位置（避免用户不移动鼠标看不到提示更新）
          this.updateDrawHintPosition(cartesian);
          this.addPoint(cartesian);

          // 再清理一次：本次点击可能刚创建了新的临时点/面/边框实体，确保下一帧不会因 NaN 停渲染
          this.removeEntitiesWithInvalidPositions();
        }
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    // 右键删除最后一个点
    this.screenSpaceEventHandler.setInputAction(() => {
      if (!this.isDrawing || this.tempPositions.length === 0) return;
      this.removeLastPoint();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // 鼠标移动更新预览
    this.screenSpaceEventHandler.setInputAction(
      (move: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (!this.isDrawing) return;
        const cartesian = this.pickGlobePosition(move.endPosition);
        if (cartesian) {
          // 无论是否已落点，都更新提示位置
          this.updateDrawHintPosition(cartesian);

          // 已落点时才更新几何预览
          if (this.tempPositions.length > 0) {
            this.updatePreview(cartesian);
          }
        }
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );

    // 双击结束绘制
    this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
    // 绘图双击事件，添加校验，只有在点击地图时才触发
    this.screenSpaceEventHandler.setInputAction(
      (dblClick: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (!this.isDrawing) return;

        // 校验是否点击在地图上
        const cartesian = this.pickGlobePosition(dblClick.position);
        if (!cartesian) {
          console.warn('Double-click event ignored: not on the map.');
          return;
        }

        this._doubleClickPending = true;
        // 双击结束绘制：提前设置较长的冷却，避免随后同一/紧邻事件链触发覆盖物 pick
        this.setPickCooldown(900, 'draw-double-click-finish');
        this.finishDrawing();
      },
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
  }

  /**
   * 拾取地形或椭球体上的位置
   * @param windowPosition 屏幕坐标
   * @returns 世界坐标 Cartesian3 或 null
   */
  private pickGlobePosition(
    windowPosition: Cesium.Cartesian2
  ): Cesium.Cartesian3 | null {
    // 防御：拖动相机/画布抖动时，偶发会收到非有限的屏幕坐标，直接忽略
    const anyPos = windowPosition as any;
    if (!anyPos || !Number.isFinite(anyPos.x) || !Number.isFinite(anyPos.y)) {
      return null;
    }

    try {
      // 首先尝试从地形拾取
      const ray = this.viewer.camera.getPickRay(windowPosition);
      // 仅在地形瓦片已加载完成时才尝试 globe.pick，避免早期不稳定状态
      if (ray && this.scene.mode === Cesium.SceneMode.SCENE3D && this.scene.globe.tilesLoaded) {
        const position = this.scene.globe.pick(ray, this.scene) as Cesium.Cartesian3 | undefined;
        if (Cesium.defined(position)) {
          // 防御性检查：确保拾取到的位置不包含 NaN/Infinity
          if (
            Number.isFinite(position.x) &&
            Number.isFinite(position.y) &&
            Number.isFinite(position.z)
          ) {
            return position.clone();
          }
        }
      }
      // 如果地形拾取失败，回退到椭球体拾取
      const ellipsoidPosition = this.viewer.camera.pickEllipsoid(
        windowPosition,
        this.scene.globe.ellipsoid
      ) as Cesium.Cartesian3 | undefined;
      if (ellipsoidPosition) {
        if (
          Number.isFinite(ellipsoidPosition.x) &&
          Number.isFinite(ellipsoidPosition.y) &&
          Number.isFinite(ellipsoidPosition.z)
        ) {
          return ellipsoidPosition.clone();
        }
      }
      return null;
    } catch (e) {
      // Cesium 内部有时会抛出 "cartesian has a NaN component"（多发生在相机拖动过程中），这里吞掉以避免弹窗
      return null;
    }
  }

  /**
   * 添加一个点到临时位置数组并创建点实体
   * @param position 世界坐标
   */
  private addPoint(position: Cesium.Cartesian3): void {
    if (
      !position ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      console.warn("Invalid Cartesian3 detected in addPoint. Point ignored.", position);
      return;
    }
    // 不因 tilesLoaded 拦截点击：地形未就绪时回退为椭球拾取，后续再做采样修正

    if (this.currentDrawer) {
      // 多边形：在落点前进行自相交校验（可通过 DrawOptions 控制行为）
      if (this.drawMode === "polygon") {
        const selfIntersectionEnabled = !!this.currentDrawOptions?.selfIntersectionEnabled;
        const allowTouch = !!this.currentDrawOptions?.selfIntersectionAllowTouch;
        const allowContinue = !!this.currentDrawOptions?.selfIntersectionAllowContinue;
        if (selfIntersectionEnabled) {
          const existing = this.currentDrawer.getTempPositions();
          if (existing && existing.length >= 2) {
            const willSelfIntersect = wouldCreatePolygonSelfIntersection(existing, position, { allowTouch });
            if (willSelfIntersect && !allowContinue) {
              // 阻止落点，但保持绘制状态，用户可继续选择其他点
              console.warn('Polygon self-intersection detected; point rejected.');
              this.setDrawHintOverride(i18n.t('draw.hint.polygon_no_intersection'));
              return;
            }
          }
        }
      }

      this.currentDrawer.addPointForHelper(position);
      this.tempPositions = this.currentDrawer.getTempPositions();
      this.tempEntities = this.currentDrawer.getTempEntities();
      this.updateDrawingEntity();

      // 点数变化后刷新提示文案
      this.refreshDrawHintTextOnly();
    }
  }

  /**
   * 删除最后一个添加的点及其相关的临时实体
   */
  private removeLastPoint(): void {
    if (!this.currentDrawer) {
      return;
    }

    const positions = this.currentDrawer.getTempPositions();
    if (!positions || positions.length === 0) {
      return;
    }

    // 委托给绘制基类处理删除最后一个点及预览重建
    this.currentDrawer.removeLastPointAndRedraw();

    // 同步临时数据到调度器本地状态
    this.tempPositions = this.currentDrawer.getTempPositions();
    this.tempEntities = this.currentDrawer.getTempEntities();
    this.tempLabelEntities = this.currentDrawer.getTempLabelEntities();

    // 使用最近一次鼠标位置作为预览点，立即重绘线/面/圆预览
    if (this.lastPreviewPosition && this.isDrawing) {
      this.updateDrawingEntity(this.lastPreviewPosition);
    }

    // 点数变化后刷新提示文案
    this.refreshDrawHintTextOnly();
  }

  /**
   * 更新预览线/面
   * @param currentMousePosition 当前鼠标位置世界坐标
   */
  private updatePreview(currentMousePosition: Cesium.Cartesian3): void {
    // 记录最近一次预览点，便于右键删点后立即重绘
    this.lastPreviewPosition = currentMousePosition.clone();

    // 多边形：预览阶段同样拦截“将要自相交”的鼠标点，避免自相交三角剖分导致的缺失/闪烁
    if (this.drawMode === "polygon" && this.currentDrawer) {
      const selfIntersectionEnabled = !!this.currentDrawOptions?.selfIntersectionEnabled;
      const allowTouch = !!this.currentDrawOptions?.selfIntersectionAllowTouch;
      const allowContinue = !!this.currentDrawOptions?.selfIntersectionAllowContinue;
      if (selfIntersectionEnabled) {
        const existing = this.currentDrawer.getTempPositions();
        if (existing && existing.length >= 2) {
          const willSelfIntersect = wouldCreatePolygonSelfIntersection(existing, currentMousePosition, { allowTouch });
          if (willSelfIntersect && !allowContinue) {
            this.setDrawHintOverride(i18n.t('draw.hint.polygon_no_intersection'));
            this.updateDrawingEntity(undefined);
            return;
          }
        }
      }
    }
    this.updateDrawingEntity(currentMousePosition);
  }

  /**
   * 核心方法：根据当前点序列更新或创建临时的线/面实体
   * @param previewPoint 可选的预览点，用于显示动态效果
   */
  private updateDrawingEntity(previewPoint?: Cesium.Cartesian3): void {
    if (!this.currentDrawer) {
      console.warn('updateDrawingEntity called but currentDrawer is null. This should not happen.');
      return;
    }

    this.currentDrawer.updateDrawingEntity(previewPoint);
    // 同步临时数据
    this.tempPositions = this.currentDrawer.getTempPositions();
    this.tempEntities = this.currentDrawer.getTempEntities();
    this.tempLabelEntities = this.currentDrawer.getTempLabelEntities();
  }

  /**
   * 完成当前绘制操作
   */
  private finishDrawing(): void {
    if (!this.currentDrawer) {
      console.warn('finishDrawing called but currentDrawer is null. This should not happen.');
      this.endDrawingInternal(true);
      return;
    }

    // 结束绘制的临界时刻：绘制状态即将切换，短暂屏蔽其它模块 pick
    this.setPickCooldown(900, 'draw-finish');

    // 双击结束绘制时，Cesium 往往会先触发两次 LEFT_CLICK 再触发 LEFT_DOUBLE_CLICK，
    // 导致最后一个点被重复落两次（两个点几乎相同），进而在闭合自相交校验中被判定为 touch/overlap。
    // 这里在真正 finish 前去掉这个“重复末尾点”。
    if (this.drawMode === 'polygon') {
      try {
        const pts = this.currentDrawer.getTempPositions();
        if (pts && pts.length >= 2) {
          const a = pts[pts.length - 1];
          const b = pts[pts.length - 2];
          // 5cm 阈值：足以覆盖双击同一点的拾取抖动，不影响正常绘制
          if (Cesium.Cartesian3.distance(a, b) <= 0.05) {
            this.currentDrawer.removeLastPointAndRedraw();
          }
        }
      } catch {
        // ignore
      }
    }

    const result = this.currentDrawer.finishDrawing();

    // 若绘制类返回 null（例如点数不足/自相交被拦截），它通常不会触发 onDrawEnd 回调。
    // 这里补触发一次，便于外部 UI 能正确收尾。
    if (!result) {
      try {
        if (this.onDrawEndCallback) {
          this.onDrawEndCallback(null);
        }
      } catch {
        // ignore
      }
    }

    // 确保绘制类在 finish 后恢复 requestRenderMode（如果它自己未恢复）
    try {
      if ((this.currentDrawer as any).restoreRequestRenderModeIfNeeded) {
        (this.currentDrawer as any).restoreRequestRenderModeIfNeeded();
      }
    } catch (e) {
      // 安全忽略
    }

    if (result && result.entity) {
      this.finishedEntities.push(result.entity);

      // 关键：在下一帧渲染更新前校验实体，避免 GeometryUpdater 因 NaN 直接停渲染
      this.validateEntityPositionsOrRemove(result.entity);
      const border = (result.entity as any)?._borderEntity as Cesium.Entity | undefined;
      if (border) {
        this.validateEntityPositionsOrRemove(border);
      }

      // 两阶段：先 NONE 落地，地形稳定后再采样/切换
      this.scheduleTerrainRefine(result.entity);
      try {
        const labels = ((result.entity as any)?._labelEntities as Cesium.Entity[] | undefined) || [];
        labels.forEach((l) => this.scheduleTerrainRefine(l));
      } catch {
        // ignore
      }
    }

    // 同步临时数据
    this.tempPositions = this.currentDrawer.getTempPositions();
    this.tempEntities = this.currentDrawer.getTempEntities();
    this.tempLabelEntities = this.currentDrawer.getTempLabelEntities();
    this.finishedPointEntities = this.currentDrawer.getFinishedPointEntities();

    // 将临时标签实体转移到已完成标签实体数组
    this.tempLabelEntities.forEach((entity) => {
      this.finishedLabelEntities.push(entity);
    });
    this.tempLabelEntities = [];

    // 完成绘制后，恢复绘图状态和事件
    this.drawMode = null;
    this.isDrawing = false;
    try {
      (this.viewer as any).__vmapDrawHelperIsDrawing = false;
    } catch {
      // ignore
    }
    this.lastPreviewPosition = null;
    this.currentDrawer = null;
    this.currentDrawOptions = undefined;
    this.deactivateDrawingHandlers();

    // 清理提示
    this.clearDrawHint();

    if (DrawHelper.activeDrawingHelper === this) {
      DrawHelper.activeDrawingHelper = null;
    }

    // 防御：finish 后也清理一次，避免遗留实体在 render/update 中持续触发 NaN
    this.removeEntitiesWithInvalidPositions();

    // 退出绘制后恢复 entities.add（startDrawing 时安装了拦截钩子）
    this.uninstallEntitiesAddHook();
  }

  /**
   * 内部方法：重置绘图状态和清理临时数据
   * @param resetMode 是否重置绘图模式和状态标志
   */
  private endDrawingInternal(resetMode: boolean): void {
    // 如果使用绘制类，清理绘制类的临时数据
    if (this.currentDrawer) {
      this.currentDrawer.clearTempEntitiesForHelper();
      this.tempPositions = this.currentDrawer.getTempPositions();
      this.tempEntities = this.currentDrawer.getTempEntities();
      this.tempLabelEntities = this.currentDrawer.getTempLabelEntities();
    }

    // 重置本地临时数据引用（具体实体清理由各绘制类负责）
    this.tempEntities = [];
    this.tempLabelEntities = [];
    this.tempPositions = [];

    if (resetMode) {
      this.drawMode = null;
      this.isDrawing = false;
      try {
        (this.viewer as any).__vmapDrawHelperIsDrawing = false;
      } catch {
        // ignore
      }
      this.lastPreviewPosition = null;

      // 如果绘制类在 end 时仍然修改了 requestRenderMode，尝试恢复
      try {
        if (this.currentDrawer && (this.currentDrawer as any).restoreRequestRenderModeIfNeeded) {
          (this.currentDrawer as any).restoreRequestRenderModeIfNeeded();
        }
      } catch (e) {
        // 安全忽略
      }

      this.currentDrawer = null;
      this.deactivateDrawingHandlers();

      // 取消/结束绘制时清理提示
      this.clearDrawHint();
      // 取消绘制时同样恢复地形深度测试开关
      if (this.originalDepthTestAgainstTerrain !== null) {
        this.scene.globe.depthTestAgainstTerrain = this.originalDepthTestAgainstTerrain;
        this.originalDepthTestAgainstTerrain = null;
      }

      if (DrawHelper.activeDrawingHelper === this) {
        DrawHelper.activeDrawingHelper = null;
      }

      // 退出绘制后恢复 entities.add
      this.uninstallEntitiesAddHook();
    }
  }

  /**
   * 公共方法：结束当前绘制（如果正在进行）
   */
  endDrawing(): void {
    if (this.isDrawing) {
      this.finishDrawing();
    } else {
      // 如果没有在绘制，也执行一次清理
      this.endDrawingInternal(true);
    }
  }

  /**
   * 公共方法：取消当前正在进行的绘制（不触发完成回调，不生成实体）
   * 主要用于在外部开启新的绘制前，保证旧的未完成绘制被安全终止，
   * 避免同时存在多个绘制事件处理器。
   */
  cancelDrawing(): void {
    if (this.isDrawing) {
      this.endDrawingInternal(true);
    }
  }

  /**
   * 销毁事件处理器
   */
  private deactivateDrawingHandlers(): void {
    if (this.screenSpaceEventHandler) {
      this.screenSpaceEventHandler.destroy();
      this.screenSpaceEventHandler = null;
    }
  }

  /**
   * 清除所有已绘制的实体
   */
  clearAll(): void {
    // 先结束可能的绘制
    this.endDrawing();

    // 强制清除所有点实体
    this.clearAllPoints();

    // 清除所有已完成的实体（包括其关联的边框实体）
    this.finishedEntities.forEach((entity) => {
      if (!entity) return;
      const border = (entity as any)._borderEntity as Cesium.Entity | undefined;
      if (border) {
        this.entities.remove(border);
      }
      this.entities.remove(entity);
    });
    this.finishedEntities = [];

    // 清除所有已完成的标签实体
    this.finishedLabelEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.finishedLabelEntities = [];

    // 清除所有通过公共方法创建的实体
    this.publicEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.publicEntities = [];

    // 重置本地临时数据引用（具体实体清理由各绘制类负责）
    this.tempEntities = [];
    this.tempLabelEntities = [];
    this.tempPositions = [];

    // 清理 DrawPolygon 的边框实体
    if (this.drawPolygon) {
      this.drawPolygon.clear();
    }
  }

  /**
   * 清除所有实体（包括未跟踪的实体）
   * 这是一个更彻底的清理方法，会清除场景中的所有实体
   */
  clearAllEntities(): void {
    // 先结束可能的绘制
    this.endDrawing();
    // 清除场景中的所有实体
    this.entities.removeAll();
    // 重置所有跟踪数组
    this.finishedEntities = [];
    this.finishedLabelEntities = [];
    this.finishedPointEntities = [];
    this.publicEntities = [];
    this.tempEntities = [];
    this.tempLabelEntities = [];
    this.tempPositions = [];
  }

  /**
   * 强制清除所有点实体
   * 用于解决点实体无法删除的问题
   */
  clearAllPoints(): void {
    // 清除所有已完成的点实体
    this.finishedPointEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.finishedPointEntities = [];

    // 清除当前绘制过程中的临时点实体，委托给绘制基类
    if (this.currentDrawer) {
      this.currentDrawer.clearTempPointEntitiesForHelper();
      this.tempEntities = this.currentDrawer.getTempEntities();
    }

    // 清除所有可能的点实体（通过实体名称查找）
    const allEntities = this.entities.values;
    for (let i = allEntities.length - 1; i >= 0; i--) {
      const entity = allEntities[i];
      if (entity && entity.point) {
        this.entities.remove(entity);
      }
    }
  }

  /**
   * 删除一个指定的已完成实体
   * @param entity 要删除的实体
   */
  removeEntity(entity: Cesium.Entity): void {
    const index = this.finishedEntities.indexOf(entity);
    if (index > -1) {
      // 先移除关联的标签实体（例如面积标签）
      const drawEntity = entity as DrawEntity;
      const linkedLabels = (drawEntity as any)._labelEntities as Cesium.Entity[] | undefined;
      if (linkedLabels && linkedLabels.length > 0) {
        linkedLabels.forEach((lab) => {
          try {
            if (lab) {
              this.entities.remove(lab);
            }
          } catch {
            // ignore
          }
        });
        // 从已完成标签数组中同步剔除
        this.finishedLabelEntities = this.finishedLabelEntities.filter((lab) => !linkedLabels.includes(lab));
        (drawEntity as any)._labelEntities = [];
      } else {
        // 兜底：按 owner id 查找并移除
        const ownerId = (entity as any).id;
        if (ownerId) {
          const owned = this.finishedLabelEntities.filter((lab) => (lab as any)?._ownerEntityId === ownerId);
          owned.forEach((lab) => {
            try {
              this.entities.remove(lab);
            } catch {
              // ignore
            }
          });
          if (owned.length > 0) {
            this.finishedLabelEntities = this.finishedLabelEntities.filter((lab) => (lab as any)?._ownerEntityId !== ownerId);
          }
        }
      }

      const border = (entity as any)._borderEntity as Cesium.Entity | undefined;
      if (border) {
        this.entities.remove(border);
      }
      this.entities.remove(entity);
      this.finishedEntities.splice(index, 1);
      if (this.onEntityRemovedCallback) {
        this.onEntityRemovedCallback(entity);
      }
    }
  }

  /**
   * 获取某个绘制实体关联的标签实体（例如面积标签）
   */
  getEntityLabelEntities(entity: Cesium.Entity): Cesium.Entity[] {
    const labels = ((entity as any)?._labelEntities as Cesium.Entity[] | undefined) || [];
    return [...labels];
  }

  /**
   * 获取所有已完成的实体
   * @returns 实体数组
   */
  getFinishedEntities(): Cesium.Entity[] {
    return [...this.finishedEntities];
  }

  // --- 回调注册 ---
  onMeasureComplete(callback: (result: {
    type: "line" | "polygon" | "rectangle" | "circle";
    positions: Cesium.Cartesian3[];
    distance?: number;
    areaKm2?: number;
  }) => void): void {
    this.onMeasureCompleteCallback = callback;
  }

  /**
   * 设置开始绘制时的回调函数
   * @param callback 回调函数
   */
  onDrawStart(callback: () => void): void {
    this.onDrawStartCallback = callback;
  }

  /**
   * 设置结束绘制时的回调函数
   * @param callback 回调函数，参数为完成的实体或null
   */
  onDrawEnd(callback: (entity: Cesium.Entity | null) => void): void {
    this.onDrawEndCallback = callback;
  }

  /**
   * 设置实体被移除时的回调函数
   * @param callback 回调函数，参数为被移除的实体
   */
  onEntityRemoved(callback: (entity: Cesium.Entity) => void): void {
    this.onEntityRemovedCallback = callback;
  }


  /**
   * 更新所有已完成实体以适应场景模式变化
   * 当从2D切换到3D或从3D切换到2D时，需要更新实体的高度参考和位置
   */
  private updateFinishedEntitiesForModeChange(): void {
    const is3DMode = this.offsetHeight > 0;
    const allowGroundClamping =
      this.scene.mode === Cesium.SceneMode.SCENE3D && this.scene.globe.tilesLoaded;

    // 更新已完成的主要实体（线、多边形、矩形）
    this.finishedEntities.forEach((entity) => {
      if (!entity) return;

      if (entity.polyline) {
        // 更新线条：使用保存的原始地面位置
        const rawGroundPositions = (entity as any)._groundPositions as Cesium.Cartesian3[] | undefined;
        if (rawGroundPositions && rawGroundPositions.length > 0) {
          // 过滤掉包含 NaN/Infinity 的无效点
          const groundPositions = rawGroundPositions.filter((pos) =>
            pos &&
            Number.isFinite(pos.x) &&
            Number.isFinite(pos.y) &&
            Number.isFinite(pos.z)
          );
          if (groundPositions.length < 2) {
            return;
          }
          if (is3DMode) {
            // 切换到3D模式：抬高位置，取消贴地
            const elevatedPositions = groundPositions
              .map((pos) => {
                try {
                  const carto = Cesium.Cartographic.fromCartesian(pos);
                  if (!Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) return null;
                  const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
                  const p = Cesium.Cartesian3.fromRadians(
                    carto.longitude,
                    carto.latitude,
                    baseHeight + this.offsetHeight
                  );
                  return this.isFiniteCartesian3(p) ? p : null;
                } catch {
                  return null;
                }
              })
              .filter((p): p is Cesium.Cartesian3 => !!p);
            if (elevatedPositions.length < 2) return;
            entity.polyline.positions = new Cesium.ConstantProperty(elevatedPositions);
            entity.polyline.clampToGround = new Cesium.ConstantProperty(false);
          } else {
            // 切换到2D模式：使用原始地面位置，贴地
            entity.polyline.positions = new Cesium.ConstantProperty(groundPositions);
            // 统一不走 ground pipeline：clampToGround=false，避免 TerrainOffsetProperty/ground worker 异常
            entity.polyline.clampToGround = new Cesium.ConstantProperty(false);
          }
        }
      } else if (entity.polygon) {
        // 更新多边形：使用保存的原始地面位置
        const rawGroundPositions = (entity as any)._groundPositions as Cesium.Cartesian3[] | undefined;
        if (rawGroundPositions && rawGroundPositions.length > 0) {
          const groundPositions = rawGroundPositions.filter((pos) =>
            pos &&
            Number.isFinite(pos.x) &&
            Number.isFinite(pos.y) &&
            Number.isFinite(pos.z)
          );
          if (groundPositions.length < 3) {
            return;
          }
          if (is3DMode) {
            // 切换到3D模式：抬高位置
            const elevatedPositions = groundPositions
              .map((pos) => {
                try {
                  const carto = Cesium.Cartographic.fromCartesian(pos);
                  if (!Number.isFinite(carto.longitude) || !Number.isFinite(carto.latitude)) return null;
                  const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
                  const p = Cesium.Cartesian3.fromRadians(
                    carto.longitude,
                    carto.latitude,
                    baseHeight + this.offsetHeight
                  );
                  return this.isFiniteCartesian3(p) ? p : null;
                } catch {
                  return null;
                }
              })
              .filter((p): p is Cesium.Cartesian3 => !!p);
            if (elevatedPositions.length < 3) return;

            entity.polygon.hierarchy = new Cesium.ConstantProperty(
              new Cesium.PolygonHierarchy(elevatedPositions)
            );
            entity.polygon.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          } else {
            // 切换到非 3D：统一不使用 CLAMP_TO_GROUND（会创建 TerrainOffsetProperty/ground pipeline）
            entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(groundPositions));
            entity.polygon.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          }
        }
      } else if (entity.rectangle) {
        // 更新矩形：使用保存的原始矩形坐标
        const groundRectangle = (entity as any)._groundRectangle as Cesium.Rectangle | undefined;
        if (groundRectangle) {
          if (is3DMode) {
            entity.rectangle.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
            entity.rectangle.extrudedHeight = new Cesium.ConstantProperty(this.offsetHeight);
          } else {
            entity.rectangle.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
            entity.rectangle.extrudedHeight = undefined;
          }
        }
      }
    });

    // 更新标签实体（面积 label + 距离 billboard）
    this.finishedLabelEntities.forEach((entity) => {
      if (!entity) return;

      // 使用保存的原始地面位置
      const groundPosition = (entity as any)._groundPosition as Cesium.Cartesian3 | undefined;
      if (!groundPosition) return;

      if (entity.label) {
        // 处理面积等使用 Cesium.Label 的标签
        if (is3DMode) {
          // 切换到3D模式：抬高标签位置
          try {
            const carto = Cesium.Cartographic.fromCartesian(groundPosition);
            const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
            const elevatedPosition = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              baseHeight + this.offsetHeight
            );
            if (!this.isFiniteCartesian3(elevatedPosition)) return;
            entity.position = new Cesium.ConstantPositionProperty(elevatedPosition);
          } catch {
            return;
          }
          // 两阶段：先 NONE，待 tilesLoaded 后采样并可切换
          entity.label.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          (entity as any)._preferRelativeToGround = true;
          this.scheduleTerrainRefine(entity);
        } else {
          // 切换到2D模式：使用原始地面位置，贴地
          entity.position = new Cesium.ConstantPositionProperty(groundPosition);
          entity.label.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
        }
      } else if (entity.billboard) {
        // 处理测距总长 / 分段的 billboard 标签
        if (is3DMode) {
          try {
            const carto = Cesium.Cartographic.fromCartesian(groundPosition);
            const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
            const elevatedPosition = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              baseHeight + this.offsetHeight
            );
            if (!this.isFiniteCartesian3(elevatedPosition)) return;
            entity.position = new Cesium.ConstantPositionProperty(elevatedPosition);
          } catch {
            return;
          }
          entity.billboard.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          (entity as any)._preferRelativeToGround = true;
          this.scheduleTerrainRefine(entity);
        } else {
          // 2D 模式下对 billboard 贴地支持有限，这里直接使用地面 Cartesian3，关闭贴地
          entity.position = new Cesium.ConstantPositionProperty(groundPosition);
          entity.billboard.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
        }
      }
    });

    // 更新点实体（点实体在绘制过程中创建，需要从当前位置推断原始位置）
    this.finishedPointEntities.forEach((entity) => {
      if (!entity || !entity.point) return;

      const position = entity.position?.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3;
      if (position) {
        let carto: Cesium.Cartographic;
        try {
          carto = Cesium.Cartographic.fromCartesian(position);
        } catch {
          return;
        }
        // 尝试从保存的原始位置获取，如果没有则从当前位置推断
        const groundPosition = (entity as any)._groundPosition;
        if (groundPosition) {
          if (is3DMode) {
            let gc: Cesium.Cartographic;
            try {
              gc = Cesium.Cartographic.fromCartesian(groundPosition);
            } catch {
              return;
            }
            const baseHeight = Number.isFinite(gc.height) ? (gc.height as number) : 0;
            const elevatedPosition = Cesium.Cartesian3.fromRadians(
              gc.longitude,
              gc.latitude,
              baseHeight + this.offsetHeight
            );
            if (!this.isFiniteCartesian3(elevatedPosition)) return;
            entity.position = new Cesium.ConstantPositionProperty(elevatedPosition);
            entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
            (entity as any)._preferRelativeToGround = true;
            this.scheduleTerrainRefine(entity);
          } else {
            entity.position = new Cesium.ConstantPositionProperty(groundPosition);
            entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          }
        } else {
          // 如果没有保存的原位置，从当前位置推断（兼容旧数据）
          if (is3DMode) {
            const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
            const elevatedPosition = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              Math.max(0, baseHeight - this.offsetHeight) + this.offsetHeight
            );
            if (!this.isFiniteCartesian3(elevatedPosition)) return;
            entity.position = new Cesium.ConstantPositionProperty(elevatedPosition);
            entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
            (entity as any)._preferRelativeToGround = true;
            this.scheduleTerrainRefine(entity);
          } else {
            const baseHeight = Number.isFinite(carto.height) ? (carto.height as number) : 0;
            const groundPos = Cesium.Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              Math.max(0, baseHeight - this.offsetHeight)
            );
            if (!this.isFiniteCartesian3(groundPos)) return;
            entity.position = new Cesium.ConstantPositionProperty(groundPos);
            entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
          }
        }
      }
    });
  }

  /**
   * 加入“两阶段地形适配”队列：先 NONE 安全显示，tilesLoaded 后再采样/切换。
   */
  private scheduleTerrainRefine(entity: Cesium.Entity): void {
    try {
      if (!entity) return;
      // 只在 3D 模式下才有“地形稳定后再贴地/采样”的意义
      if (this.scene.mode !== Cesium.SceneMode.SCENE3D) return;
      this.terrainRefineQueue.add(entity);
    } catch {
      // ignore
    }
  }

  private processTerrainRefineQueue(): void {
    try {
      const now = Date.now();
      if (now - this.terrainRefineLastTick < 500) return;
      this.terrainRefineLastTick = now;

      if (this.scene.mode !== Cesium.SceneMode.SCENE3D) return;
      if (!this.scene.globe.tilesLoaded) return;
      if (this.terrainRefineQueue.size === 0) return;

      // 每次最多处理一个，避免一次性采样太多点位造成卡顿
      const next = this.terrainRefineQueue.values().next().value as Cesium.Entity | undefined;
      if (!next) return;
      const id = (next as any).id as string | undefined;
      if (id && this.terrainRefineInFlight.has(id)) {
        this.terrainRefineQueue.delete(next);
        return;
      }
      if (id) this.terrainRefineInFlight.add(id);
      this.terrainRefineQueue.delete(next);

      this.refineEntityToTerrain(next)
        .catch(() => {
          // ignore
        })
        .finally(() => {
          if (id) this.terrainRefineInFlight.delete(id);
        });
    } catch {
      // ignore
    }
  }

  private async refineEntityToTerrain(entity: Cesium.Entity): Promise<void> {
    const CesiumAny: any = Cesium as any;
    const sampleMostDetailed = CesiumAny.sampleTerrainMostDetailed as
      | ((terrainProvider: any, positions: Cesium.Cartographic[]) => Promise<Cesium.Cartographic[]>)
      | undefined;
    const terrainProvider = (this.viewer as any).terrainProvider;

    if (!sampleMostDetailed || !terrainProvider) return;
    if (!entity) return;

    // 1) 绘制实体（polygon/line）的采样：用 _groundPositions
    const drawType = (entity as any)._drawType as string | undefined;
    const rawGroundPositions = (entity as any)._groundPositions as Cesium.Cartesian3[] | undefined;
    if (drawType && Array.isArray(rawGroundPositions) && rawGroundPositions.length > 0) {
      const required = drawType === 'polygon' ? 3 : 2;
      if (rawGroundPositions.length >= required) {
        const cartos = rawGroundPositions
          .map((p) => {
            try {
              const c = Cesium.Cartographic.fromCartesian(p);
              if (!Number.isFinite(c.longitude) || !Number.isFinite(c.latitude)) return null;
              c.height = 0;
              return c;
            } catch {
              return null;
            }
          })
          .filter((c): c is Cesium.Cartographic => !!c);
        if (cartos.length >= required) {
          const sampled = await sampleMostDetailed(terrainProvider, cartos);

          const safeGround = sampled
            .map((c) => {
              const h = Number.isFinite((c as any).height) ? (c as any).height : 0;
              const p = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, h);
              return this.isFiniteCartesian3(p) ? p : null;
            })
            .filter((p): p is Cesium.Cartesian3 => !!p);
          if (safeGround.length >= required) {
            (entity as any)._groundPositions = safeGround;

            const elevated = sampled
              .map((c) => {
                const h = Number.isFinite((c as any).height) ? (c as any).height : 0;
                const p = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, h + Math.max(0, this.offsetHeight));
                return this.isFiniteCartesian3(p) ? p : null;
              })
              .filter((p): p is Cesium.Cartesian3 => !!p);

            if (drawType === 'polygon' && entity.polygon && elevated.length >= 3) {
              entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(elevated));
              (entity.polygon as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);

              const border = (entity as any)._borderEntity as Cesium.Entity | undefined;
              if (border?.polyline) {
                const closed = elevated.slice();
                if (closed.length >= 2) closed.push(elevated[0]);
                border.polyline.positions = new Cesium.ConstantProperty(closed);
                (border.polyline as any).clampToGround = new Cesium.ConstantProperty(false);
              }
            }
            if (drawType === 'line' && entity.polyline && elevated.length >= 2) {
              entity.polyline.positions = new Cesium.ConstantProperty(elevated);
              (entity.polyline as any).clampToGround = new Cesium.ConstantProperty(false);
            }
          }
        }
      }
    }

    // 2) 单点实体（label/billboard/point）的采样：用 _groundPosition
    const groundPosition = (entity as any)._groundPosition as Cesium.Cartesian3 | undefined;
    if (groundPosition) {
      let carto: Cesium.Cartographic | null = null;
      try {
        carto = Cesium.Cartographic.fromCartesian(groundPosition);
      } catch {
        carto = null;
      }
      if (carto && Number.isFinite(carto.longitude) && Number.isFinite(carto.latitude)) {
        carto.height = 0;
        const sampled = await sampleMostDetailed(terrainProvider, [carto]);
        const c = sampled && sampled[0];
        if (c && Number.isFinite(c.longitude) && Number.isFinite(c.latitude)) {
          const h = Number.isFinite((c as any).height) ? (c as any).height : 0;
          const elevated = Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, h + Math.max(0, this.offsetHeight));
          if (this.isFiniteCartesian3(elevated)) {
            entity.position = new Cesium.ConstantPositionProperty(elevated);

            // 关键：永远不启用 RELATIVE/CLAMP，以彻底绕开 TerrainOffsetProperty（NaN 源头）
            if (entity.billboard) {
              entity.billboard.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
            }
            if (entity.label) {
              entity.label.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
            }
            if (entity.point) {
              entity.point.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
            }
          }
        }
      }
    }

    // 3) 若该 entity 是绘制主体，顺带处理其关联 label（避免需要单独入队）
    try {
      const labels = ((entity as any)._labelEntities as Cesium.Entity[] | undefined) || [];
      for (const l of labels) {
        if (l) {
          // label 自己会走上面的 groundPosition 分支
          await this.refineEntityToTerrain(l);
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * 销毁工具，清理所有事件监听器
   */
  destroy(): void {
    this.deactivateDrawingHandlers();
    if (this.entityClickHandler) {
      try {
        this.entityClickHandler.destroy();
      } catch { /* ignore */ }
      this.entityClickHandler = null;
    }

    // 卸载 terrain refine listener（仅移除当前实例安装的那个）
    try {
      const anyViewer: any = this.viewer as any;
      const cur = anyViewer.__vmapDrawHelperTerrainRefineListener as
        | ((scene: Cesium.Scene, time: Cesium.JulianDate) => void)
        | undefined;
      if (cur && this.terrainRefineListener && cur === this.terrainRefineListener) {
        this.scene.postRender.removeEventListener(cur);
        anyViewer.__vmapDrawHelperTerrainRefineListener = undefined;
      }
    } catch {
      // ignore
    }

    // 可以选择不清除实体，由用户决定
    // this.clearAll();
  }
}

// 为了在 HTML 中通过 <script type="module"> 或打包工具使用
// @ts-ignore
window.DrawHelper = DrawHelper;

export default DrawHelper;

