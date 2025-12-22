import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference } from "cesium";
import type { OverlayPosition } from './types';

/**
 * Marker 选项
 */
export interface MarkerOptions {
  position: OverlayPosition;
  pixelSize?: number;
  color?: Color | string;
  outlineColor?: Color | string;
  outlineWidth?: number;
  heightReference?: HeightReference;
  scaleByDistance?: Cesium.NearFarScalar;
  disableDepthTestDistance?: number;
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * Marker 工具类
 */
export class MapMarker {
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
      return position;
    }
    if (Array.isArray(position)) {
      if (position.length === 2) {
        return Cesium.Cartesian3.fromDegrees(position[0], position[1]);
      } else if (position.length === 3) {
        return Cesium.Cartesian3.fromDegrees(position[0], position[1], position[2]);
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
   * 添加 Marker（点标记）
   */
  public add(options: MarkerOptions): Entity {
    const position = this.convertPosition(options.position);
    const id = options.id || `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const entity = this.entities.add({
      id,
      position,
      point: {
        pixelSize: options.pixelSize ?? 10,
        color: options.color ? this.resolveColor(options.color) : Cesium.Color.RED,
        outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.WHITE,
        outlineWidth: options.outlineWidth ?? 2,
        heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
        scaleByDistance: options.scaleByDistance,
        disableDepthTestDistance: options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY,
      },
    });

    if (options.onClick) {
      (entity as any)._onClick = options.onClick;
    }

    return entity;
  }

  /**
   * 更新 Marker 位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const newPosition = this.convertPosition(position);
    entity.position = new Cesium.ConstantPositionProperty(newPosition);
  }

  /**
   * 更新 Marker 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<MarkerOptions, 'color' | 'outlineColor' | 'outlineWidth' | 'pixelSize'>>): void {
    if (entity.point) {
      if (options.color !== undefined) {
        entity.point.color = new Cesium.ConstantProperty(this.resolveColor(options.color));
      }
      if (options.outlineColor !== undefined) {
        entity.point.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor));
      }
      if (options.outlineWidth !== undefined) {
        entity.point.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      }
      if (options.pixelSize !== undefined) {
        entity.point.pixelSize = new Cesium.ConstantProperty(options.pixelSize);
      }
    }
  }
}

