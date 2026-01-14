import * as Cesium from "cesium";
import type { Viewer, Entity, Color, HeightReference } from "cesium";
import type { OverlayEntity } from './types';

/**
 * Rectangle 选项
 */
export interface RectangleOptions {
  coordinates: Cesium.Rectangle;
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

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.entities = viewer.entities;
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
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]),
          material: new Cesium.ColorMaterialProperty(options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK),
          outline: false,
          heightReference,
          ...(clampToGround ? {} : { height: ringHeight }),
        },
      });

      const inner = this.entities.add({
        rectangle: {
          coordinates: innerRect,
          material,
          outline: false,
          heightReference,
          height: ringHeight,
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
        (inner.rectangle as any).height = new Cesium.ConstantProperty(ringHeight);
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
            (inner.rectangle as any).height = new Cesium.ConstantProperty(ringHeight);
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
} 

