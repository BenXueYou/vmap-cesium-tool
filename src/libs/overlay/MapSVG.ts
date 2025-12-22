import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference, VerticalOrigin, HorizontalOrigin } from "cesium";
import type { OverlayPosition } from './types';

/**
 * SVG 选项
 */
export interface SvgOptions {
  position: OverlayPosition;
  svg: string; // SVG字符串
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
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * SVG 工具类
 */
export class MapSVG {
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
   * 将 SVG 字符串转换为 data URL
   */
  private svgToDataUrl(svg: string): string {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  /**
   * 添加 SVG（使用 Billboard）
   */
  public add(options: SvgOptions): Entity {
    const position = this.convertPosition(options.position);
    const id = options.id || `svg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 将 SVG 字符串转换为 data URL
    const svgDataUrl = this.svgToDataUrl(options.svg);
    
    const entity = this.entities.add({
      id,
      position,
      billboard: {
        image: svgDataUrl,
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
      (entity as any)._onClick = options.onClick;
    }

    return entity;
  }

  /**
   * 更新 SVG 位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const newPosition = this.convertPosition(position);
    entity.position = new Cesium.ConstantPositionProperty(newPosition);
  }

  /**
   * 更新 SVG 内容
   */
  public updateSvg(entity: Entity, svg: string): void {
    if (entity.billboard) {
      const svgDataUrl = this.svgToDataUrl(svg);
      entity.billboard.image = new Cesium.ConstantProperty(svgDataUrl);
    }
  }

  /**
   * 更新 SVG 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<SvgOptions, 'scale' | 'rotation' | 'color'>>): void {
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
   * 移除 SVG（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.getById(entityOrId) : entityOrId;
    if (!entity) return false;
    delete (entity as any)._onClick;
    return this.entities.remove(entity);
  }
} 

