import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference, VerticalOrigin, HorizontalOrigin } from "cesium";
import type { OverlayPosition, OverlayEntity } from './types';

/**
 * Icon 选项
 */
export interface IconOptions {
  position: OverlayPosition;
  image: string; // 图片URL或base64
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
  pixelOffset?: Cesium.Cartesian2;
  eyeOffset?: Cesium.Cartesian3;
  horizontalOrigin?: HorizontalOrigin;
  verticalOrigin?: VerticalOrigin;
  heightReference?: HeightReference;
  disableDepthTestDistance?: number;
  color?: Color | string;
  /** 点击该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  clickHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  /** 鼠标移入该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  hoverHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * Icon 工具类
 */
export class MapIcon {
  private viewer: Viewer;
  private entities: Cesium.EntityCollection;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.entities = viewer.entities;
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
   * 添加 Icon（图标，使用 Billboard）
   */
  public add(options: IconOptions): Entity {
    const position = this.convertPosition(options.position);
    const id = options.id || `icon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const entity = this.entities.add({
      id,
      position,
      billboard: {
        image: options.image,
        width: options.width,
        height: options.height,
        scale: options.scale ?? 1.0,
        rotation: options.rotation,
        pixelOffset: options.pixelOffset,
        eyeOffset: options.eyeOffset,
        horizontalOrigin: options.horizontalOrigin ?? Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: options.verticalOrigin ?? Cesium.VerticalOrigin.BOTTOM,
        heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
        disableDepthTestDistance: options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY,
        color: options.color ? this.resolveColor(options.color) : undefined,
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

    return entity;
  }

  /**
   * 更新 Icon 位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const newPosition = this.convertPosition(position);
    entity.position = new Cesium.ConstantPositionProperty(newPosition);
  }

  /**
   * 更新 Icon 图片
   */
  public updateImage(entity: Entity, image: string): void {
    if (entity.billboard) {
      entity.billboard.image = new Cesium.ConstantProperty(image);
    }
  }

  /**
   * 更新 Icon 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<IconOptions, 'scale' | 'rotation' | 'color'>>): void {
    if (entity.billboard) {
      if (options.scale !== undefined) {
        entity.billboard.scale = new Cesium.ConstantProperty(options.scale);
      }
      if (options.rotation !== undefined) {
        entity.billboard.rotation = new Cesium.ConstantProperty(options.rotation);
      }
      if (options.color !== undefined) {
        entity.billboard.color = new Cesium.ConstantProperty(this.resolveColor(options.color));
      }
    }
  }

  /**
   * 移除 Icon（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.getById(entityOrId) : entityOrId;
    if (!entity) return false;
    (entity as OverlayEntity)._onClick = undefined;
    return this.entities.remove(entity);
  }
} 

