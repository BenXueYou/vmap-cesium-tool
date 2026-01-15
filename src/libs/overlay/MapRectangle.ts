import * as Cesium from "cesium";
import type { Viewer, Entity, Color, HeightReference } from "cesium";
import type { OverlayEntity } from './types';
import { RectanglePrimitiveBatch } from './primitives/RectanglePrimitiveBatch';

/**
 * Rectangle 选项
 */
export interface RectangleOptions {
  coordinates: Cesium.Rectangle;
  /**
   * 渲染模式：
   * - auto：自动选择（默认；当前仅在“粗边框+贴地+纯色”场景下会切到 primitive）
   * - entity：使用 Cesium Entity
   * - primitive：使用 Cesium GroundPrimitive（大批量静态贴地场景）
   */
  renderMode?: 'auto' | 'entity' | 'primitive';
  material?: Cesium.MaterialProperty | Color | string;
  outline?: boolean;
  outlineColor?: Color | string;
  outlineWidth?: number;
  /** 是否贴地（默认：在粗边框模式下为 true） */
  clampToGround?: boolean;
  /** 悬空时的基准高度（米，clampToGround=false 时有效） */
  height?: number;
  heightReference?: HeightReference;
  extrudedHeight?: number;
  /** 高度容差（米）：用于避免共面深度冲突；会同时作用于边框与填充以保证一致 */
  heightEpsilon?: number;
  /** 点击该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  clickHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  /** 鼠标移入该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  hoverHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * Rectangle 工具类
 */
export class MapRectangle {
  private viewer: Viewer;
  private entities: Cesium.EntityCollection;

  private primitiveBatch: RectanglePrimitiveBatch | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.entities = viewer.entities;
  }

  private getPrimitiveBatch(): RectanglePrimitiveBatch {
    if (!this.primitiveBatch) {
      this.primitiveBatch = new RectanglePrimitiveBatch(this.viewer);
    }
    return this.primitiveBatch;
  }

  private resolveMaterialColor(material?: Cesium.MaterialProperty | Color | string): Cesium.Color | null {
    if (!material) return Cesium.Color.BLUE.withAlpha(0.5);
    if (typeof material === 'string') return this.resolveColor(material);
    if (material instanceof Cesium.Color) return material;
    // Primitive 模式仅支持纯色
    return null;
  }

  private canUsePrimitive(options: RectangleOptions): boolean {
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    if (!(ringThickness > 0)) return false;
    const clampToGround = options.clampToGround ?? true;
    if (!clampToGround) return false;
    if (options.extrudedHeight !== undefined) return false;
    if (this.resolveMaterialColor(options.material) === null) return false;
    // outlineColor 也要求可解析为纯色
    if (options.outlineColor !== undefined && !(this.resolveColor(options.outlineColor as any) instanceof Cesium.Color)) return false;
    return true;
  }

  private addPrimitiveRectangle(options: RectangleOptions): Entity {
    const id = options.id || `rectangle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    const clampToGround = options.clampToGround ?? true;
    if (!(ringThickness > 0) || !clampToGround || options.extrudedHeight !== undefined) {
      console.warn('[vmap-cesium-tool] Rectangle renderMode=primitive is not supported for the given options; falling back to Entity.');
      return this.add({ ...options, renderMode: 'entity' });
    }

    const fillColor = this.resolveMaterialColor(options.material);
    if (!fillColor) {
      console.warn('[vmap-cesium-tool] Rectangle renderMode=primitive requires solid color material; falling back to Entity.');
      return this.add({ ...options, renderMode: 'entity' });
    }

    const ringColor = options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK;

    const outer = new Cesium.Entity({ id });
    const inner = new Cesium.Entity({ id: `${id}__fill` });

    const outerEntity = outer as OverlayEntity;
    const innerEntity = inner as OverlayEntity;
    outerEntity._overlayType = 'rectangle-primitive';
    innerEntity._overlayType = 'rectangle-primitive';

    const group = [outer, inner];
    const clickHighlight = options.clickHighlight ?? false;
    const hoverHighlight = options.hoverHighlight ?? false;
    outerEntity._clickHighlight = clickHighlight;
    innerEntity._clickHighlight = clickHighlight;
    outerEntity._hoverHighlight = hoverHighlight;
    innerEntity._hoverHighlight = hoverHighlight;
    outerEntity._highlightEntities = group;
    innerEntity._highlightEntities = group;

    outerEntity._innerEntity = inner;
    outerEntity._isRing = true;
    outerEntity._ringThickness = ringThickness;
    outerEntity._outerRectangle = options.coordinates;
    outerEntity._clampToGround = true;
    outerEntity._baseHeight = 0;

    // 保存原始颜色，供高亮恢复
    outerEntity._primitiveRingBaseColor = ringColor;
    outerEntity._primitiveFillBaseColor = fillColor;
    innerEntity._primitiveRingBaseColor = ringColor;
    innerEntity._primitiveFillBaseColor = fillColor;

    if (options.onClick) {
      outerEntity._onClick = options.onClick;
      innerEntity._onClick = options.onClick;
    }

    const outerPositions = this.rectangleToPositions(options.coordinates, 0);
    const innerRect = this.shrinkRectangle(options.coordinates, ringThickness);
    const innerPositions = this.rectangleToPositions(innerRect, 0);

    this.getPrimitiveBatch().upsertGeometry({
      rectangleId: id,
      parts: { outer, inner },
      outerPositions,
      innerPositions,
      ringColor,
      fillColor,
      visible: true,
    });

    return outer;
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
  private resolveMaterial(material?: Cesium.MaterialProperty | Color | string): Cesium.MaterialProperty {
    if (!material) {
      return new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.5));
    }
    if (typeof material === 'string') {
      return new Cesium.ColorMaterialProperty(this.resolveColor(material));
    }
    if (material instanceof Cesium.Color) {
      return new Cesium.ColorMaterialProperty(material);
    }
    return material as Cesium.MaterialProperty;
  }

  /**
   * 将 Rectangle 转为四点多边形顶点（按西南→东南→东北→西北顺序）
   */
  private rectangleToPositions(rect: Cesium.Rectangle, heightMeters: number): Cesium.Cartesian3[] {
    const w = rect.west;
    const s = rect.south;
    const e = rect.east;
    const n = rect.north;
    return [
      Cesium.Cartesian3.fromRadians(w, s, heightMeters),
      Cesium.Cartesian3.fromRadians(e, s, heightMeters),
      Cesium.Cartesian3.fromRadians(e, n, heightMeters),
      Cesium.Cartesian3.fromRadians(w, n, heightMeters),
    ];
  }

  /**
   * 按米单位向内收缩矩形边界，返回新的 Rectangle
   */
  private shrinkRectangle(rect: Cesium.Rectangle, thicknessMeters: number): Cesium.Rectangle {
    const R = 6378137.0;
    const centerLat = (rect.north + rect.south) / 2;
    const deltaLat = thicknessMeters / R; // radians
    const deltaLon = thicknessMeters / (R * Math.cos(centerLat));
    const maxDeltaLon = (rect.east - rect.west) / 2 * 0.999;
    const maxDeltaLat = (rect.north - rect.south) / 2 * 0.999;
    const dLon = Math.min(deltaLon, maxDeltaLon);
    const dLat = Math.min(deltaLat, maxDeltaLat);
    return new Cesium.Rectangle(rect.west + dLon, rect.south + dLat, rect.east - dLon, rect.north - dLat);
  }

  /**
   * 添加 Rectangle（矩形）
   */
  public add(options: RectangleOptions): Entity {
    const id = options.id || `rectangle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const material = this.resolveMaterial(options.material);

    const renderMode = options.renderMode ?? 'auto';
    if (renderMode === 'primitive' || (renderMode === 'auto' && this.canUsePrimitive(options))) {
      return this.addPrimitiveRectangle({ ...options, id, renderMode: 'primitive' });
    }

    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    if (ringThickness && ringThickness > 0) {
      const clampToGround = options.clampToGround ?? true;
      const baseHeight = clampToGround ? 0 : (options.height ?? 0);
      const heightReference = clampToGround
        ? Cesium.HeightReference.CLAMP_TO_GROUND
        : (options.heightReference ?? Cesium.HeightReference.NONE);
      const heightEpsilon = options.heightEpsilon ?? (clampToGround ? 0 : 0.1);
      const ringHeight = baseHeight + heightEpsilon;

      const outerPositions = this.rectangleToPositions(options.coordinates, 0);
      const innerRect = this.shrinkRectangle(options.coordinates, ringThickness);
      const innerPositions = this.rectangleToPositions(innerRect, 0);

      const outer = this.entities.add({
        id,
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
        rectangle: {
          coordinates: innerRect,
          material,
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
      outerEntity._innerEntity = inner;
      outerEntity._isRing = true;
      outerEntity._ringThickness = ringThickness;
      outerEntity._outerRectangle = options.coordinates;
      outerEntity._clampToGround = clampToGround;
      outerEntity._baseHeight = baseHeight;
      outerEntity._ringHeightEpsilon = heightEpsilon;

      return outer;
    }

    // 非环形：默认贴地（可通过 clampToGround:false 或传入 heightReference 覆盖）
    const clampToGround = options.clampToGround ?? true;
    const heightReference =
      options.heightReference ?? (clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE);

    const entity = this.entities.add({
      id,
      rectangle: {
        coordinates: options.coordinates,
        material,
        outline: options.outline ?? true,
        outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK,
        outlineWidth: options.outlineWidth ?? 1,
        heightReference,
        ...(!clampToGround && options.height !== undefined ? { height: options.height } : {}),
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

    return entity;
  }

  /**
   * 更新 Rectangle 坐标
   */
  public updateCoordinates(entity: Entity, coordinates: Cesium.Rectangle): void {
    const overlayEntity = entity as OverlayEntity;

    // primitive
    if (overlayEntity._overlayType === 'rectangle-primitive') {
      const root = entity as OverlayEntity;
      const id = String(root.id);
      const inner = root._innerEntity;
      if (!inner) return;

      const thickness = root._ringThickness ?? 0;
      const outerPositions = this.rectangleToPositions(coordinates, 0);
      const innerRect = this.shrinkRectangle(coordinates, thickness);
      const innerPositions = this.rectangleToPositions(innerRect, 0);

      const ringBase = root._primitiveRingBaseColor ?? Cesium.Color.BLACK;
      const fillBase = root._primitiveFillBaseColor ?? Cesium.Color.BLUE.withAlpha(0.5);

      this.getPrimitiveBatch().upsertGeometry({
        rectangleId: id,
        parts: { outer: entity, inner },
        outerPositions,
        innerPositions,
        ringColor: ringBase,
        fillColor: fillBase,
        visible: entity.show !== false,
      });

      root._outerRectangle = coordinates;
      return;
    }

    const inner = overlayEntity._innerEntity;
    const thickness = overlayEntity._ringThickness;
    if (entity.polygon && inner && thickness) {
      const clampToGround = overlayEntity._clampToGround ?? true;
      const baseHeight = clampToGround ? 0 : (overlayEntity._baseHeight ?? 0);
      const heightEpsilon = overlayEntity._ringHeightEpsilon ?? (clampToGround ? 0 : 0.1);
      const ringHeight = baseHeight + heightEpsilon;

      const outerPositions = this.rectangleToPositions(coordinates, 0);
      const innerRect = this.shrinkRectangle(coordinates, thickness);
      const innerPositions = this.rectangleToPositions(innerRect, 0);
      entity.polygon.hierarchy = new Cesium.ConstantProperty(
        new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)])
      );
      inner.rectangle!.coordinates = new Cesium.ConstantProperty(innerRect);
      // 确保内层填充高度与外层一致
      if (inner.rectangle) {
        if (clampToGround) {
          (inner.rectangle as any).height = undefined;
        } else {
          (inner.rectangle as any).height = new Cesium.ConstantProperty(ringHeight);
        }
      }
      // 外层 polygon 高度（悬空时）
      if (!clampToGround && entity.polygon) {
        (entity.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
      }
      overlayEntity._outerRectangle = coordinates;
    } else if (entity.rectangle) {
      entity.rectangle.coordinates = new Cesium.ConstantProperty(coordinates);
    }
  }

  /**
   * 更新 Rectangle 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<RectangleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    const overlayEntity = entity as OverlayEntity;

    // primitive
    if (overlayEntity._overlayType === 'rectangle-primitive') {
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
        }
      }
      if (options.outlineWidth !== undefined) {
        root._ringThickness = Math.max(0, Number(options.outlineWidth) || 0);
        const outerRect = root._outerRectangle;
        if (outerRect) this.updateCoordinates(entity, outerRect);
      }

      if (root._primitiveRingBaseColor && root._primitiveFillBaseColor) {
        this.getPrimitiveBatch().setColors(id, root._primitiveRingBaseColor, root._primitiveFillBaseColor);
      }
      return;
    }

    const inner = overlayEntity._innerEntity;
    const isRing = overlayEntity._isRing;
    if (isRing && entity.polygon && inner) {
      if (options.outlineColor !== undefined) {
        entity.polygon.material = new Cesium.ColorMaterialProperty(this.resolveColor(options.outlineColor));
      }
      if (options.material !== undefined) {
        inner.rectangle!.material = this.resolveMaterial(options.material);
      }
      if (options.outlineWidth !== undefined) {
        const thickness = Math.max(0, options.outlineWidth);
        overlayEntity._ringThickness = thickness;
        const outerRect = overlayEntity._outerRectangle ?? undefined;
        if (outerRect) {
          const clampToGround = overlayEntity._clampToGround ?? true;
          const baseHeight = clampToGround ? 0 : (overlayEntity._baseHeight ?? 0);
          const heightEpsilon = overlayEntity._ringHeightEpsilon ?? (clampToGround ? 0 : 0.1);
          const ringHeight = baseHeight + heightEpsilon;

          const outerPositions = this.rectangleToPositions(outerRect, 0);
          const innerRect = this.shrinkRectangle(outerRect, thickness);
          const innerPositions = this.rectangleToPositions(innerRect, 0);
          entity.polygon.hierarchy = new Cesium.ConstantProperty(
            new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)])
          );
          inner.rectangle!.coordinates = new Cesium.ConstantProperty(innerRect);
          if (inner.rectangle) {
            if (clampToGround) {
              (inner.rectangle as any).height = undefined;
            } else {
              (inner.rectangle as any).height = new Cesium.ConstantProperty(ringHeight);
            }
          }
          if (!clampToGround && entity.polygon) {
            (entity.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
          }
        }
      }
    } else if (entity.rectangle) {
      if (options.material !== undefined) {
        entity.rectangle.material = this.resolveMaterial(options.material);
      }
      if (options.outline !== undefined) {
        entity.rectangle.outline = new Cesium.ConstantProperty(options.outline);
      }
      if (options.outlineColor !== undefined) {
        entity.rectangle.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor));
      }
      if (options.outlineWidth !== undefined) {
        entity.rectangle.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      }
    }
  }

  /**
   * 移除 Rectangle（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.getById(entityOrId) : entityOrId;
    const direct = (typeof entityOrId !== 'string') ? entityOrId : entity;
    const anyOverlay = direct as OverlayEntity;
    if (anyOverlay && anyOverlay._overlayType === 'rectangle-primitive') {
      const id = String((direct as any).id);
      try {
        this.getPrimitiveBatch().remove(id);
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
    if (overlay._overlayType !== 'rectangle-primitive') return;
    const id = String(entity.id);
    this.getPrimitiveBatch().setVisible(id, visible);
  }

  public applyPrimitiveHighlight(entity: OverlayEntity, hlColor: Cesium.Color, fillAlpha: number): void {
    if (entity._overlayType !== 'rectangle-primitive') return;
    const root = entity._highlightEntities && entity._highlightEntities.length > 0
      ? (entity._highlightEntities[0] as OverlayEntity)
      : entity;
    const id = String(root.id);

    if (!root._primitiveRingBaseColor) root._primitiveRingBaseColor = Cesium.Color.BLACK;
    if (!root._primitiveFillBaseColor) root._primitiveFillBaseColor = Cesium.Color.BLUE.withAlpha(0.5);

    const ringColor = hlColor.withAlpha(1.0);
    const fillColor = hlColor.withAlpha(fillAlpha);
    this.getPrimitiveBatch().setColors(id, ringColor, fillColor);
    (entity as OverlayEntity)._isHighlighted = true;
  }

  public restorePrimitiveHighlight(entity: OverlayEntity): void {
    if (entity._overlayType !== 'rectangle-primitive') return;
    const root = entity._highlightEntities && entity._highlightEntities.length > 0
      ? (entity._highlightEntities[0] as OverlayEntity)
      : entity;
    const id = String(root.id);
    if (root._primitiveRingBaseColor && root._primitiveFillBaseColor) {
      this.getPrimitiveBatch().setColors(id, root._primitiveRingBaseColor, root._primitiveFillBaseColor);
    }
    (entity as OverlayEntity)._isHighlighted = false;
  }
} 

