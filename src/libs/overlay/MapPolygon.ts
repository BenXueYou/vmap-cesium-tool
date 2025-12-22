import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference } from "cesium";
import type { OverlayPosition } from './types';

/**
 * Polygon 选项
 */
export interface PolygonOptions {
  positions: OverlayPosition[];
  material?: Cesium.MaterialProperty | Color | string;
  outline?: boolean;
  outlineColor?: Color | string;
  outlineWidth?: number;
  heightReference?: HeightReference;
  extrudedHeight?: number;
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * Polygon 工具类
 */
export class MapPolygon {
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
   * 添加 Polygon（多边形）
   */
  public add(options: PolygonOptions): Entity {
    const positions = options.positions.map(pos => this.convertPosition(pos));
    const id = options.id || `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const material = this.resolveMaterial(options.material);

    const entity = this.entities.add({
      id,
      polygon: {
        hierarchy: positions,
        material,
        outline: options.outline ?? true,
        outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK,
        outlineWidth: options.outlineWidth ?? 1,
        heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
        extrudedHeight: options.extrudedHeight,
      },
    });

    if (options.onClick) {
      (entity as any)._onClick = options.onClick;
    }

    return entity;
  }

  /**
   * 更新 Polygon 位置
   */
  public updatePositions(entity: Entity, positions: OverlayPosition[]): void {
    const newPositions = positions.map(pos => this.convertPosition(pos));
    if (entity.polygon) {
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(newPositions));
    }
  }

  /**
   * 更新 Polygon 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<PolygonOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    if (entity.polygon) {
      if (options.material !== undefined) {
        entity.polygon.material = this.resolveMaterial(options.material);
      }
      if (options.outline !== undefined) {
        entity.polygon.outline = new Cesium.ConstantProperty(options.outline);
      }
      if (options.outlineColor !== undefined) {
        entity.polygon.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor));
      }
      if (options.outlineWidth !== undefined) {
        entity.polygon.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      }
    }
  }

  /**
   * 移除 Polygon（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.getById(entityOrId) : entityOrId;
    if (!entity) return false;
    delete (entity as any)._onClick;
    return this.entities.remove(entity);
  }
} 

