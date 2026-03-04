import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference } from "cesium";
import type { OverlayPosition, OverlayEntity } from './types';
import { CirclePrimitiveBatch } from './primitives/CirclePrimitiveBatch';
import { CirclePrimitiveLayerStack } from './primitives/CirclePrimitiveLayerStack';

/**
 * Circle 选项
 */
export interface CircleOptions {
  position: OverlayPosition;
  radius: number; // 米
  /**
   * 渲染模式：
   * - auto：自动选择（默认；当前实现等同于 entity）
   * - entity：使用 Cesium Entity
   * - primitive：使用 Cesium Primitive（为大批量静态覆盖物预留）
   */
  renderMode?: 'auto' | 'entity' | 'primitive';
  material?: Cesium.MaterialProperty | Color | string;
  outline?: boolean;
  outlineColor?: Color | string;
  outlineWidth?: number;
  /**
   * 粗边框（outlineWidth>1）模式下用于近似圆的分段数，越大越圆滑但更耗性能。
   * 默认 256。
   */
  segments?: number;
  /**
   * 是否贴地（默认：在粗边框模式下为 true）。
   * - true：填充与边框都贴地。
   * - false：填充与边框都使用 position 高度悬空。
   */
  clampToGround?: boolean; // 仅在 entity 模式下有效, 是否贴地
  heightReference?: HeightReference; // 几何体高度，绝对高度（默认）NONE: 0；贴地：CLAMP_TO_GROUND: 1; 相对地面:RELATIVE_TO_GROUND: 2
  extrudedHeight?: number; // 拉伸高度（仅 entity 模式）
  heightEpsilon?: number; // 高度容差，用于环形方案
  /** 点击该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  clickHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  /** 鼠标移入该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  hoverHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  /**
   * Primitive 模式分层渲染 key。
   * - 相同 layerKey 的 circle 会被合并到同一个批次中（更高性能）
   * - 不同 layerKey 会进入不同的“图层空间”，并按首次出现顺序确定上下层
   * - 只对 primitive 生效；entity 模式忽略
   */
  layerKey?: string;
  id?: string;
}

/**
 * Circle 工具类
 */
export class MapCircle {
  private viewer: Viewer;
  private entities: Cesium.EntityCollection;

  private primitiveBatch: CirclePrimitiveBatch | null = null;
  private primitiveLayerStack: CirclePrimitiveLayerStack | null = null;
  private primitiveBatchesByLayer: Map<string, CirclePrimitiveBatch> = new Map();

  private static bearingTableCache: Map<number, { sin: Float64Array; cos: Float64Array }> = new Map();

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.entities = viewer.entities;
  }

  private getPrimitiveBatch(): CirclePrimitiveBatch {
    if (!this.primitiveBatch) {
      this.primitiveBatch = new CirclePrimitiveBatch(this.viewer);
    }
    return this.primitiveBatch;
  }

  private getLayeredPrimitiveBatch(layerKey: string): CirclePrimitiveBatch {
    const key = String(layerKey);
    const existing = this.primitiveBatchesByLayer.get(key);
    if (existing) return existing;

    if (!this.primitiveLayerStack) {
      this.primitiveLayerStack = new CirclePrimitiveLayerStack(this.viewer);
    }
    const { fillCollection, ringCollection } = this.primitiveLayerStack.getLayerCollections(key);
    const batch = new CirclePrimitiveBatch(this.viewer, { fillCollection, ringCollection });
    this.primitiveBatchesByLayer.set(key, batch);
    return batch;
  }

  private getPrimitiveBatchForOverlay(overlay: OverlayEntity): CirclePrimitiveBatch {
    const layerKey = (overlay as any)._primitiveLayerKey as string | undefined;
    if (layerKey) return this.getLayeredPrimitiveBatch(layerKey);
    return this.getPrimitiveBatch();
  }

  private resolveMaterialColor(material?: Cesium.MaterialProperty | Color | string): Cesium.Color | null {
    if (!material) return Cesium.Color.BLUE.withAlpha(0.5);
    if (typeof material === 'string') return this.resolveColor(material);
    if (material instanceof Cesium.Color) return material;
    // 支持常见的纯色材质：ColorMaterialProperty
    if (material instanceof Cesium.ColorMaterialProperty) {
      try {
        const c: any = (material as any).color;
        const v = c && typeof c.getValue === 'function' ? c.getValue(Cesium.JulianDate.now()) : c;
        if (v instanceof Cesium.Color) return v;
        if (typeof v === 'string') return this.resolveColor(String(v));
      } catch {
        // ignore
      }
    }
    // Primitive 模式仅支持纯色（Color / css string）。复杂材质无法用 PerInstanceColorAppearance 表达。
    return null;
  }

  private canUsePrimitive(options: CircleOptions): boolean {
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    if (!(ringThickness > 0)) return false;
    const clampToGround = options.clampToGround ?? true;
    if (!clampToGround) return false;
    if (options.extrudedHeight !== undefined) return false;
    if (this.resolveMaterialColor(options.material) === null) return false;
    return true;
  }

  /**
   * 添加一个基础的圆形图元
   * @param options 圆形配置选项
   * @returns 返回创建的实体对象
   */
  private addPrimitiveCircle(options: CircleOptions): Entity {
    // 生成唯一ID，如果未提供则使用时间戳和随机字符串组合
    const id = options.id || `circle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const layerKey = options.layerKey;

    // 仅支持：粗边框 + 贴地 + 纯色
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0; // 边框厚度
    const clampToGround = options.clampToGround ?? true; // 是否贴地
    const fillColor = this.resolveMaterialColor(options.material); // 解析填充颜色
    // 检查是否满足primitive支持条件，如果不满足则回退到entity模式
    if (!(ringThickness > 0) || !clampToGround || !fillColor) {
      // 兜底：不满足 primitive 支持条件时，回退到 entity（并尽量不抛错）
      console.warn('[vmap-cesium-tool] Circle renderMode=primitive is not supported for the given options; falling back to Entity.');
      return this.add({ ...options, renderMode: 'entity' });
    }

    // 转换位置坐标
    const position = this.convertPosition(options.position);
    const baseCartoRaw = Cesium.Cartographic.fromCartesian(position); // 转换为地理坐标
    const baseCarto0 = new Cesium.Cartographic(baseCartoRaw.longitude, baseCartoRaw.latitude, 0); // 设置高度为0



    // 设置圆形参数
    const outerRadius = options.radius; // 外半径
    const ringSegments = Math.max(16, Math.floor(options.segments ?? this.getDefaultSegmentsForRadius(outerRadius))); // 环段数
    const innerRadius = Math.max(0, options.radius - ringThickness); // 内半径



    // 生成圆形位置点
    const ringPositions = this.generateCirclePositions(baseCarto0, outerRadius, 0, ringSegments); // 外环位置点
    const fillPositions = this.generateCirclePositions(baseCarto0, innerRadius, 0, ringSegments); // 内填充位置点

    const ringColor = options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK; // 环颜色

    // Primitive pick 需要稳定的 id：这里用两个“代理 Entity”（不加入 viewer.entities）
    const outer = new Cesium.Entity({ id });
    const inner = new Cesium.Entity({ id: `${id}__fill` });

    const outerEntity = outer as OverlayEntity;
    const innerEntity = inner as OverlayEntity;

    outerEntity._overlayType = 'circle-primitive';
    innerEntity._overlayType = 'circle-primitive';

    // primitive 分层信息：用于后续 update/remove/visible/highlight 正确路由到对应 batch
    (outerEntity as any)._primitiveLayerKey = layerKey;
    (innerEntity as any)._primitiveLayerKey = layerKey;

    // 复合覆盖物联动：outer（环）+ inner（填充）
    const group = [outer, inner];
    const clickHighlight = options.clickHighlight ?? false;
    const hoverHighlight = options.hoverHighlight ?? false;
    outerEntity._clickHighlight = clickHighlight;
    innerEntity._clickHighlight = clickHighlight;
    outerEntity._hoverHighlight = hoverHighlight;
    innerEntity._hoverHighlight = hoverHighlight;
    outerEntity._highlightEntities = group;
    innerEntity._highlightEntities = group;

    // 复合引用：复用 _innerEntity 字段（与 entity 模式一致）
    outerEntity._innerEntity = inner;

    if (options.onClick) {
      outerEntity._onClick = options.onClick;
      innerEntity._onClick = options.onClick;
    }

    // 记录可用于 update/remove/visible 的元数据
    outerEntity._clampToGround = true;
    outerEntity._baseHeight = 0;
    outerEntity._centerCartographic = new Cesium.Cartographic(baseCartoRaw.longitude, baseCartoRaw.latitude, 0);
    outerEntity._isRing = true;
    outerEntity._ringThickness = ringThickness;
    outerEntity._outerRadius = outerRadius;
    outerEntity._innerRadius = innerRadius;
    outerEntity._ringSegments = ringSegments;
    outerEntity._fillMaterial = fillColor;
    outerEntity._primitiveRingBaseColor = ringColor;
    outerEntity._primitiveFillBaseColor = fillColor;

    // 记录外圈边界（闭合），供高亮时绘制 glow 边框使用
    const ringClosed = ringPositions.slice();
    if (ringClosed.length >= 2) ringClosed.push(ringClosed[0]);
    outerEntity._primitiveOutlinePositions = ringClosed;

    // inner 也写一份，方便从任意命中对象恢复
    innerEntity._primitiveRingBaseColor = ringColor;
    innerEntity._primitiveFillBaseColor = fillColor;
    innerEntity._primitiveOutlinePositions = outerEntity._primitiveOutlinePositions;

    // 入 batch（若提供 layerKey，则进入分层渲染栈）
    const batch = layerKey ? this.getLayeredPrimitiveBatch(layerKey) : this.getPrimitiveBatch();
    batch.upsertGeometry({
      circleId: id,
      parts: { outer, inner },
      ringPositions,
      fillPositions,
      ringColor,
      fillColor,
      visible: true,
    });

    return outer;
  }

  /**
   * 转换位置为 Cartesian3
   */
  private convertPosition(position: OverlayPosition): Cartesian3 {
    if (position instanceof Cesium.Cartesian3) {
      if (
        Number.isFinite((position as any).x) &&
        Number.isFinite((position as any).y) &&
        Number.isFinite((position as any).z)
      ) {
        return position;
      }
      throw new Error('Invalid position: Cartesian3 has NaN/Infinity components');
    }
    if (Array.isArray(position)) {
      if (position.length === 2 || position.length === 3) {
        const lon = Number((position as any)[0]);
        const lat = Number((position as any)[1]);
        const height = position.length === 3 ? Number((position as any)[2]) : undefined;

        if (!Number.isFinite(lon) || !Number.isFinite(lat) || (height !== undefined && !Number.isFinite(height))) {
          throw new Error('Invalid position: lon/lat/height must be finite numbers');
        }

        const cart = position.length === 3
          ? Cesium.Cartesian3.fromDegrees(lon, lat, height as number)
          : Cesium.Cartesian3.fromDegrees(lon, lat);

        if (!Number.isFinite((cart as any).x) || !Number.isFinite((cart as any).y) || !Number.isFinite((cart as any).z)) {
          throw new Error('Invalid position: converted Cartesian3 has NaN/Infinity components');
        }

        return cart;
      }
    }
    throw new Error('Invalid position format');
  }

  /**
   * 转换颜色
   */
  private resolveColor(color: Color | string): Color {
    if (color instanceof Cesium.Color) {
      return color;
    }
    try {
      return Cesium.Color.fromCssColorString(color);
    } catch {
      return Cesium.Color.WHITE;
    }
  }

  /**
   * 解析材质
   */
  private resolveMaterial(material?: Cesium.MaterialProperty | Color | string): Cesium.MaterialProperty | Color {
    if (!material) {
      return Cesium.Color.BLUE.withAlpha(0.5);
    }
    if (typeof material === 'string') {
      return this.resolveColor(material);
    }
    if (material instanceof Cesium.Color) {
      return material;
    }
    return material;
  }

  /**
   * 添加 Circle（圆形）
   */
  public add(options: CircleOptions): Entity {
    const renderMode = options.renderMode ?? 'auto';
    if ((renderMode === 'primitive' || renderMode === 'auto') && this.canUsePrimitive(options)) {
      return this.addPrimitiveCircle(options);
    }

    const position = this.convertPosition(options.position);
    const id = options.id || `circle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const material = this.resolveMaterial(options.material);

    // 判断是否启用双层椭圆环方案：当 outlineWidth>1 时，将其视为米单位厚度，使用双层椭圆实现粗边框
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;

    if (ringThickness > 0) {
      const clampToGround = options.clampToGround ?? true;
      const baseCartoRaw = Cesium.Cartographic.fromCartesian(position);
      const baseHeight = clampToGround ? 0 : ((baseCartoRaw?.height ?? 0) as number);
      const heightReference = clampToGround
        ? Cesium.HeightReference.CLAMP_TO_GROUND
        : (options.heightReference ?? Cesium.HeightReference.NONE);

      const heightEpsilon = options.heightEpsilon ?? (clampToGround ? 0 : 0.01);
      const ringHeight = baseHeight + heightEpsilon;

      const baseCarto = new Cesium.Cartographic(baseCartoRaw.longitude, baseCartoRaw.latitude, 0);
      const centerCartesian = Cesium.Cartesian3.fromRadians(baseCartoRaw.longitude, baseCartoRaw.latitude, 0);

      const outerRadius = options.radius;
      // 性能：粗边框模式下一个圆会创建 2 个实体 + 2 套多边形顶点。
      // 若用户未显式指定 segments，则按半径选择更合理的默认值，避免在大量圆场景下过度消耗。
      const ringSegments = Math.max(16, Math.floor(options.segments ?? this.getDefaultSegmentsForRadius(outerRadius)));
      const innerRadius = Math.max(0, options.radius - ringThickness);

      // 统一几何：外环与内填充都使用同样的近似圆顶点，避免“外圈是多边形/内圈是真圆”产生缝隙
      const outerPositions = this.generateCirclePositions(baseCarto, outerRadius, 0, ringSegments);
      const innerPositions = this.generateCirclePositions(baseCarto, innerRadius, 0, ringSegments);

      const outer = this.entities.add({
        id,
        // 使用带洞的多边形，只渲染环带区域，不填充中心
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]),
          material: new Cesium.ColorMaterialProperty(options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK),
          outline: false,
          heightReference,
          ...(clampToGround ? {} : { height: ringHeight }),
        },
      });

      const inner = this.entities.add({
        id: `${id}__fill`,
        position: centerCartesian,
        polygon: {
          hierarchy: innerPositions,
          material: material instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(material) : (material as Cesium.MaterialProperty),
          outline: false,
          heightReference,
          ...(clampToGround ? {} : { height: ringHeight }),
          extrudedHeight: options.extrudedHeight,
        },
      });

      if (options.onClick) {
        const outerEntity = outer as OverlayEntity;
        const innerEntity = inner as OverlayEntity;
        outerEntity._onClick = options.onClick;
        innerEntity._onClick = options.onClick;
      }

      const outerEntity = outer as OverlayEntity;
      const innerEntity = inner as OverlayEntity;
      const group = [outer, inner];
      const clickHighlight = options.clickHighlight ?? false;
      const hoverHighlight = options.hoverHighlight ?? false;
      outerEntity._clickHighlight = clickHighlight;
      innerEntity._clickHighlight = clickHighlight;
      outerEntity._hoverHighlight = hoverHighlight;
      innerEntity._hoverHighlight = hoverHighlight;
      outerEntity._highlightEntities = group;
      innerEntity._highlightEntities = group;

      // 记录元数据，便于更新/移除
      outerEntity._innerEntity = inner;
      outerEntity._isRing = true;
      outerEntity._ringThickness = ringThickness;
      outerEntity._fillMaterial = material;
      outerEntity._ringHeightEpsilon = heightEpsilon;
      outerEntity._centerCartographic = new Cesium.Cartographic(baseCartoRaw.longitude, baseCartoRaw.latitude, baseHeight);
      outerEntity._outerRadius = outerRadius;
      outerEntity._innerRadius = innerRadius;
      outerEntity._ringSegments = ringSegments;
      outerEntity._clampToGround = clampToGround;
      outerEntity._baseHeight = baseHeight;

      return outer;
    } else {
      // 非环形：默认贴地（可通过 clampToGround:false 或传入 heightReference 覆盖）
      const clampToGround = options.clampToGround ?? true;
      const heightReference =
        options.heightReference ?? (clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE);

      // Cesium 的 ellipse 高度以 ellipse.height 为准（position 的高度不一定会被当作图形高度使用）。
      // 因此统一策略：position 始终使用地表点（height=0），悬空高度通过 ellipse.height 表达。
      const carto = Cesium.Cartographic.fromCartesian(position);
      const surfacePosition = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
      const heightMeters = clampToGround ? 0 : (carto.height ?? 0);

      const entity = this.entities.add({
        id,
        position: surfacePosition,
        ellipse: {
          semiMajorAxis: options.radius,
          semiMinorAxis: options.radius,
          material,
          outline: options.outline ?? true,
          outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK,
          outlineWidth: options.outlineWidth ?? 1,
          heightReference,
          height: heightMeters,
          extrudedHeight: options.extrudedHeight,
        },
      });

      if (options.onClick) {
        const overlayEntity = entity as OverlayEntity;
        overlayEntity._onClick = options.onClick;
      }

      const overlayEntity = entity as OverlayEntity;
      overlayEntity._clickHighlight = options.clickHighlight ?? false;
      overlayEntity._hoverHighlight = options.hoverHighlight ?? false;
      overlayEntity._highlightEntities = [entity];

      (entity as OverlayEntity)._clampToGround = clampToGround;
      (entity as OverlayEntity)._baseHeight = heightMeters;

      return entity;
    }
  }

  /**
   * 生成近似圆（多边形）顶点，返回 Cartesian3 数组。
   * 使用大圆航线公式，segments 越大越平滑。
   */
  private generateCirclePositions(center: Cesium.Cartographic, radiusMeters: number, heightMeters: number, segments: number = 128): Cesium.Cartesian3[] {
    const R = 6378137.0; // WGS84 半径近似
    const lat1 = center.latitude;
    const lon1 = center.longitude;
    const d = radiusMeters / R;
    const positions: Cesium.Cartesian3[] = [];

    const seg = Math.max(3, Math.floor(segments));
    const table = this.getBearingTable(seg);

    const sinLat1 = Math.sin(lat1);
    const cosLat1 = Math.cos(lat1);
    const sinD = Math.sin(d);
    const cosD = Math.cos(d);

    for (let i = 0; i < seg; i++) {
      const sinBearing = table.sin[i];
      const cosBearing = table.cos[i];
      const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * cosBearing);
      const lon2 = lon1 + Math.atan2(sinBearing * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));
      positions.push(Cesium.Cartesian3.fromRadians(lon2, lat2, heightMeters));
    }
    return positions;
  }

  /**
   * 获取方位角查找表，用于存储正弦和余弦值
   * @param segments 分段数量，用于确定查找表的精度
   * @returns 返回一个包含正弦和余弦数组的对象
   */
  private getBearingTable(segments: number): { sin: Float64Array; cos: Float64Array } {
    // 确保分段数至少为3，并向下取整
    const seg = Math.max(3, Math.floor(segments));
    // 检查缓存中是否已存在对应分段数的查找表
    const cached = MapCircle.bearingTableCache.get(seg);
    // 如果缓存中存在，直接返回缓存的结果
    if (cached) return cached;

    // 创建两个Float64Array数组，分别用于存储正弦和余弦值
    const sin = new Float64Array(seg);
    const cos = new Float64Array(seg);
    // 遍历每个分段，计算对应角度的正弦和余弦值
    for (let i = 0; i < seg; i++) {
      // 计算当前角度（弧度制）
      const bearing = (i / seg) * Cesium.Math.TWO_PI;
      // 存储计算得到的正弦值
      sin[i] = Math.sin(bearing);
      // 存储计算得到的余弦值
      cos[i] = Math.cos(bearing);
    }
    // 创建查找表对象
    const table = { sin, cos };
    // 将计算结果存入缓存，以便后续使用
    MapCircle.bearingTableCache.set(seg, table);
    // 返回查找表
    return table;
  }

  /**
   * 粗边框模式的默认分段数：平衡“圆滑程度/性能”。
   * 用户如果传了 options.segments，则完全尊重用户设置。
   */
  private getDefaultSegmentsForRadius(radiusMeters: number): number {
    const r = Math.max(0, Number(radiusMeters));
    if (!Number.isFinite(r)) return 96;
    if (r <= 200) return 48;
    if (r <= 1000) return 64;
    if (r <= 5000) return 96;
    return 128;
  }

  /**
   * 更新 Circle 位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const newPosition = this.convertPosition(position);
    const overlay = entity as OverlayEntity;

    // primitive（静态批处理）模式：通过重建该 circle 的几何并让 batch 重新 build
    if (overlay._overlayType === 'circle-primitive') {
      const root = entity as OverlayEntity;
      const id = String(root.id);

      const thickness = root._ringThickness ?? 0;
      const outerRadius = root._outerRadius ?? 0;
      const segments = root._ringSegments ?? this.getDefaultSegmentsForRadius(outerRadius);
      const innerRadius = Math.max(0, outerRadius - thickness);

      const carto = Cesium.Cartographic.fromCartesian(newPosition);
      const baseCarto0 = new Cesium.Cartographic(carto.longitude, carto.latitude, 0);
      root._centerCartographic = new Cesium.Cartographic(carto.longitude, carto.latitude, 0);
      const ringPositions = this.generateCirclePositions(baseCarto0, outerRadius, 0, segments);
      const fillPositions = this.generateCirclePositions(baseCarto0, innerRadius, 0, segments);

      const ringClosed = ringPositions.slice();
      if (ringClosed.length >= 2) ringClosed.push(ringClosed[0]);
      root._primitiveOutlinePositions = ringClosed;
      const innerPart = root._innerEntity as OverlayEntity | undefined;
      if (innerPart) innerPart._primitiveOutlinePositions = ringClosed;

      const inner = root._innerEntity;
      if (!inner) return;

      const ringBase = root._primitiveRingBaseColor ?? Cesium.Color.BLACK;
      const fillBase = root._primitiveFillBaseColor ?? (this.resolveMaterialColor(root._fillMaterial as any) ?? Cesium.Color.BLUE.withAlpha(0.5));
      this.getPrimitiveBatchForOverlay(root).upsertGeometry({
        circleId: id,
        parts: { outer: entity, inner },
        ringPositions,
        fillPositions,
        ringColor: ringBase,
        fillColor: fillBase,
        visible: entity.show !== false,
      });
      return;
    }

    let carto: Cesium.Cartographic | undefined;
    try {
      carto = Cesium.Cartographic.fromCartesian(newPosition);
    } catch {
      carto = undefined;
    }
    if (!carto) {
      entity.position = new Cesium.ConstantPositionProperty(newPosition);
      const innerFallback = overlay._innerEntity;
      if (innerFallback) {
        innerFallback.position = new Cesium.ConstantPositionProperty(newPosition);
      }
      return;
    }

    const clampToGround = overlay._clampToGround ?? false;
    const baseHeight = clampToGround ? 0 : (carto.height ?? 0);
    const heightEpsilon = overlay._ringHeightEpsilon ?? 0;
    const ringHeight = baseHeight + heightEpsilon;
    overlay._baseHeight = baseHeight;

    const surfacePosition = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);

    // 环形（粗边框）方案：外层是 polygon（环带），需要重建 hierarchy；内层是 ellipse，用 height 控制悬空
    if (overlay._isRing && entity.polygon) {
      overlay._centerCartographic = new Cesium.Cartographic(carto.longitude, carto.latitude, baseHeight);

      const outerRadius = overlay._outerRadius;
      const innerRadius = overlay._innerRadius;
      const segments = overlay._ringSegments ?? 256;
      if (outerRadius !== undefined && innerRadius !== undefined) {
        const baseCarto0 = new Cesium.Cartographic(carto.longitude, carto.latitude, 0);
        const outerPositions = this.generateCirclePositions(baseCarto0, outerRadius, 0, segments);
        const innerPositions = this.generateCirclePositions(baseCarto0, innerRadius, 0, segments);
        entity.polygon.hierarchy = new Cesium.ConstantProperty(
          new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)])
        );

        const inner = overlay._innerEntity;
        if (inner && inner.polygon) {
          inner.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(innerPositions));
        }
      }

      // 高度策略：贴地=CLAMP_TO_GROUND；悬空=NONE + height
      (entity.polygon as any).heightReference = new Cesium.ConstantProperty(
        clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
      );
      if (clampToGround) {
        (entity.polygon as any).height = undefined;
      } else {
        (entity.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
      }

      const inner = overlay._innerEntity;
      if (inner) {
        inner.position = new Cesium.ConstantPositionProperty(surfacePosition);
        if (inner.polygon) {
          (inner.polygon as any).heightReference = new Cesium.ConstantProperty(
            clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
          );
          if (clampToGround) {
            (inner.polygon as any).height = undefined;
          } else {
            (inner.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
          }
        }
      }
      return;
    }

    // 非环形：position 使用地表点，高度用 ellipse.height 表达
    entity.position = new Cesium.ConstantPositionProperty(surfacePosition);
    overlay._baseHeight = clampToGround ? 0 : baseHeight;
    if (entity.ellipse) {
      entity.ellipse.heightReference = new Cesium.ConstantProperty(
        clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
      );
      entity.ellipse.height = new Cesium.ConstantProperty(clampToGround ? 0 : baseHeight);
    }
  }

  /**
   * 更新 Circle 半径
   */
  public updateRadius(entity: Entity, radius: number): void {
    const overlayEntity = entity as OverlayEntity;
    const thickness = overlayEntity._ringThickness;

    // primitive（静态批处理）模式：重建该 circle 的几何并让 batch 重新 build
    if (overlayEntity._overlayType === 'circle-primitive') {
      const root = entity as OverlayEntity;
      const id = String(root.id);
      const inner = root._innerEntity;
      if (!inner) return;

      const thickness2 = root._ringThickness ?? 0;
      const clampToGround = true;
      if (!clampToGround) return;

      const carto = root._centerCartographic
        ? new Cesium.Cartographic(root._centerCartographic.longitude, root._centerCartographic.latitude, 0)
        : (() => {
            // 尝试从 inner/outer 的 id 推断没有位置；primitive 模式必须有 centerCartographic，缺失则直接返回
            return undefined;
          })();
      if (!carto) return;

      const segments = root._ringSegments ?? this.getDefaultSegmentsForRadius(radius);
      root._outerRadius = radius;
      root._innerRadius = Math.max(0, radius - thickness2);

      const ringPositions = this.generateCirclePositions(carto, root._outerRadius, 0, segments);
      const fillPositions = this.generateCirclePositions(carto, root._innerRadius, 0, segments);

      const ringClosed = ringPositions.slice();
      if (ringClosed.length >= 2) ringClosed.push(ringClosed[0]);
      root._primitiveOutlinePositions = ringClosed;
      const innerPart = root._innerEntity as OverlayEntity | undefined;
      if (innerPart) innerPart._primitiveOutlinePositions = ringClosed;

      const ringBase = (root as any)._primitiveRingBaseColor as Cesium.Color | undefined;
      const fillBase = (root as any)._primitiveFillBaseColor as Cesium.Color | undefined;
      this.getPrimitiveBatchForOverlay(root).upsertGeometry({
        circleId: id,
        parts: { outer: entity, inner },
        ringPositions,
        fillPositions,
        ringColor: ringBase ?? Cesium.Color.BLACK,
        fillColor: fillBase ?? (this.resolveMaterialColor(root._fillMaterial as any) ?? Cesium.Color.BLUE.withAlpha(0.5)),
        visible: entity.show !== false,
      });
      return;
    }

    // 环形（粗边框）：需要重建外环 + 内填充的 polygon hierarchy
    if (overlayEntity._isRing && entity.polygon && thickness !== undefined) {
      const center = overlayEntity._centerCartographic;
      if (!center) return;
      const clampToGround = overlayEntity._clampToGround ?? false;
      const baseHeight = overlayEntity._baseHeight ?? 0;
      const heightEpsilon = overlayEntity._ringHeightEpsilon ?? 0;
      const ringHeight = baseHeight + heightEpsilon;
      const segments = overlayEntity._ringSegments ?? 256;

      overlayEntity._outerRadius = radius;
      overlayEntity._innerRadius = Math.max(0, radius - thickness);

      const baseCarto0 = new Cesium.Cartographic(center.longitude, center.latitude, 0);
      const outerPositions = this.generateCirclePositions(baseCarto0, overlayEntity._outerRadius, 0, segments);
      const holePositions = this.generateCirclePositions(baseCarto0, overlayEntity._innerRadius, 0, segments);
      entity.polygon.hierarchy = new Cesium.ConstantProperty(
        new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(holePositions)])
      );
      (entity.polygon as any).heightReference = new Cesium.ConstantProperty(
        clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
      );
      if (!clampToGround) {
        (entity.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
      }

      const inner = overlayEntity._innerEntity;
      if (inner && inner.polygon) {
        inner.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(holePositions));
        (inner.polygon as any).heightReference = new Cesium.ConstantProperty(
          clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
        );
        if (!clampToGround) {
          (inner.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
        }
      }
      return;
    }

    // 非环形：按 ellipse 半径更新
    if (entity.ellipse) {
      entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(radius);
      entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(radius);
    }
  }

  /**
   * 更新 Circle 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<CircleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    const overlay = entity as OverlayEntity;

    // primitive：仅支持纯色填充/边框。更新后重建该 circle 的实例颜色/几何。
    if (overlay._overlayType === 'circle-primitive') {
      const root = entity as OverlayEntity;
      const id = String(root.id);
      const inner = root._innerEntity;
      if (!inner) return;

      if (options.outlineColor !== undefined) {
        root._primitiveRingBaseColor = this.resolveColor(options.outlineColor as any);
        (inner as OverlayEntity)._primitiveRingBaseColor = root._primitiveRingBaseColor;
      }
      if (options.material !== undefined) {
        const c = this.resolveMaterialColor(options.material as any);
        if (c) {
          root._primitiveFillBaseColor = c;
          (inner as OverlayEntity)._primitiveFillBaseColor = c;
          root._fillMaterial = c;
        }
      }
      if (options.outlineWidth !== undefined) {
        const thickness = Math.max(0, options.outlineWidth as any);
        root._ringThickness = thickness;
        // NOTE: primitive 模式依赖粗边框，outlineWidth<=1 时回退到 entity 不在这里处理
      }

      // 重新应用当前高亮（如果有）
      if (root._primitiveRingBaseColor && root._primitiveFillBaseColor) {
        this.getPrimitiveBatchForOverlay(root).setColors(id, root._primitiveRingBaseColor, root._primitiveFillBaseColor);
      }
      return;
    }

    // 环形（粗边框）方案：外层 polygon 是边框，内层 polygon 是填充
    if (overlay._isRing && entity.polygon) {
      const inner = overlay._innerEntity;
      if (options.outlineColor !== undefined) {
        entity.polygon.material = new Cesium.ColorMaterialProperty(this.resolveColor(options.outlineColor));
      }
      if (options.material !== undefined && inner && inner.polygon) {
        const mat = this.resolveMaterial(options.material);
        inner.polygon.material = mat instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(mat) : (mat as Cesium.MaterialProperty);
        overlay._fillMaterial = options.material;
      }
      if (options.outlineWidth !== undefined) {
        const thickness = Math.max(0, options.outlineWidth);
        overlay._ringThickness = thickness;
        const outerRadius = overlay._outerRadius;
        if (outerRadius !== undefined) {
          this.updateRadius(entity, outerRadius);
        }
      }
      return;
    }

    // 非环形：按原生 ellipse outline/material
    if (entity.ellipse) {
      if (options.material !== undefined) {
        const mat = this.resolveMaterial(options.material);
        entity.ellipse.material = mat instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(mat) : (mat as Cesium.MaterialProperty);
      }
      if (options.outline !== undefined) {
        entity.ellipse.outline = new Cesium.ConstantProperty(options.outline);
      }
      if (options.outlineColor !== undefined) {
        entity.ellipse.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor));
      }
      if (options.outlineWidth !== undefined) {
        entity.ellipse.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      }
    }
  }

  /**
   * 移除 Circle（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.getById(entityOrId) : entityOrId;
    // primitive：overlayService 可能直接传入 proxy entity（不在 entities 集合里）
    const direct = (typeof entityOrId !== 'string') ? entityOrId : entity;
    const anyOverlay = direct as OverlayEntity;
    if (anyOverlay && anyOverlay._overlayType === 'circle-primitive') {
      const id = String((direct as any).id);
      try {
        this.getPrimitiveBatchForOverlay(anyOverlay).remove(id);
      } catch {
        // ignore
      }
      const inner = anyOverlay._innerEntity;
      if (inner) {
        (inner as OverlayEntity)._onClick = undefined;
        anyOverlay._innerEntity = undefined;
      }
      anyOverlay._onClick = undefined;
      return true;
    }

    if (!entity) return false;
    const overlayEntity = entity as OverlayEntity;
    const inner = overlayEntity._innerEntity;
    if (inner) {
      (inner as OverlayEntity)._onClick = undefined;
      this.entities.remove(inner);
    }
    overlayEntity._onClick = undefined;
    return this.entities.remove(entity);
  }

  public setPrimitiveVisible(entity: Entity, visible: boolean): void {
    const overlay = entity as OverlayEntity;
    if (overlay._overlayType !== 'circle-primitive') return;
    const id = String(entity.id);
    this.getPrimitiveBatchForOverlay(overlay).setVisible(id, visible);
  }

  public applyPrimitiveHighlight(entity: OverlayEntity, hlColor: Cesium.Color, fillAlpha: number): void {
    if (entity._overlayType !== 'circle-primitive') return;
    const root = entity._highlightEntities && entity._highlightEntities.length > 0
      ? (entity._highlightEntities[0] as OverlayEntity)
      : entity;
    const id = String(root.id);

    // 若缺失 base（理论上 addPrimitiveCircle 已写入），做兜底
    if (!root._primitiveRingBaseColor) root._primitiveRingBaseColor = Cesium.Color.BLACK;
    if (!root._primitiveFillBaseColor) {
      root._primitiveFillBaseColor = this.resolveMaterialColor(root._fillMaterial as any) ?? Cesium.Color.BLUE.withAlpha(0.5);
    }

    const ringColor = hlColor.withAlpha(1.0);
    const fillColor = root._primitiveFillBaseColor ?? (this.resolveMaterialColor(root._fillMaterial as any) ?? Cesium.Color.BLUE.withAlpha(0.5));
    // 仅高亮边框（环），不改变填充
    this.getPrimitiveBatchForOverlay(root).setColors(id, ringColor, fillColor);
    (entity as OverlayEntity)._isHighlighted = true;
  }

  public restorePrimitiveHighlight(entity: OverlayEntity): void {
    if (entity._overlayType !== 'circle-primitive') return;
    const root = entity._highlightEntities && entity._highlightEntities.length > 0
      ? (entity._highlightEntities[0] as OverlayEntity)
      : entity;
    const id = String(root.id);
    if (root._primitiveRingBaseColor && root._primitiveFillBaseColor) {
      this.getPrimitiveBatchForOverlay(root).setColors(id, root._primitiveRingBaseColor, root._primitiveFillBaseColor);
    }
    (entity as OverlayEntity)._isHighlighted = false;
  }
} 

