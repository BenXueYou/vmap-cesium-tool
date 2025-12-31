import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference, LabelStyle, VerticalOrigin, HorizontalOrigin } from "cesium";
import type { OverlayPosition, OverlayEntity } from './types';

/**
 * Label 选项
 */
export interface LabelOptions {
  position: OverlayPosition;
  text: string;
  font?: string;
  fillColor?: Color | string;
  outlineColor?: Color | string;
  outlineWidth?: number;
  style?: LabelStyle;
  pixelOffset?: Cesium.Cartesian2;
  eyeOffset?: Cesium.Cartesian3;
  horizontalOrigin?: HorizontalOrigin;
  verticalOrigin?: VerticalOrigin;
  heightReference?: HeightReference;
  scale?: number;
  showBackground?: boolean;
  backgroundColor?: Color | string;
  backgroundPadding?: Cesium.Cartesian2;
  disableDepthTestDistance?: number;
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * Label 工具类
 */
export class MapLabel {
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
   * 添加 Label（文本标签）
   */
  public add(options: LabelOptions): Entity {
    const position = this.convertPosition(options.position);
    const id = options.id || `label_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const entity = this.entities.add({
      id,
      position,
      label: {
        text: options.text,
        font: options.font ?? '14px sans-serif',
        fillColor: options.fillColor ? this.resolveColor(options.fillColor) : Cesium.Color.WHITE,
        outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK,
        outlineWidth: options.outlineWidth ?? 2,
        style: options.style ?? Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: options.pixelOffset,
        eyeOffset: options.eyeOffset,
        horizontalOrigin: options.horizontalOrigin ?? Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: options.verticalOrigin ?? Cesium.VerticalOrigin.BOTTOM,
        heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
        scale: options.scale ?? 1.0,
        showBackground: options.showBackground ?? false,
        backgroundColor: options.backgroundColor ? this.resolveColor(options.backgroundColor) : undefined,
        backgroundPadding: options.backgroundPadding,
        disableDepthTestDistance: options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY,
      },
    });

    if (options.onClick) {
      const overlayEntity = entity as OverlayEntity;
      overlayEntity._onClick = options.onClick;
    }

    return entity;
  }

  /**
   * 更新 Label 位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const newPosition = this.convertPosition(position);
    entity.position = new Cesium.ConstantPositionProperty(newPosition);
  }

  /**
   * 更新 Label 文本
   */
  public updateText(entity: Entity, text: string): void {
    if (entity.label) {
      entity.label.text = new Cesium.ConstantProperty(text);
    }
  }

  /**
   * 更新 Label 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<LabelOptions, 'fillColor' | 'outlineColor' | 'outlineWidth' | 'font' | 'scale'>>): void {
    if (entity.label) {
      if (options.fillColor !== undefined) {
        entity.label.fillColor = new Cesium.ConstantProperty(this.resolveColor(options.fillColor));
      }
      if (options.outlineColor !== undefined) {
        entity.label.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor));
      }
      if (options.outlineWidth !== undefined) {
        entity.label.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      }
      if (options.font !== undefined) {
        entity.label.font = new Cesium.ConstantProperty(options.font);
      }
      if (options.scale !== undefined) {
        entity.label.scale = new Cesium.ConstantProperty(options.scale);
      }
    }
  }

  /**
   * 移除 Label（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.getById(entityOrId) : entityOrId;
    if (!entity) return false;
    (entity as OverlayEntity)._onClick = undefined;
    return this.entities.remove(entity);
  }
} 

