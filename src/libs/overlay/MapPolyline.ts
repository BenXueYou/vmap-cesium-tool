import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color } from "cesium";
import type { OverlayPosition } from './types';

/**
 * Polyline 选项
 */
export interface PolylineOptions {
  positions: OverlayPosition[];
  width?: number;
  material?: Cesium.MaterialProperty | Color | string;
  clampToGround?: boolean;
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * Polyline 工具类
 */
export class MapPolyline {
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
      return Cesium.Color.YELLOW;
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
   * 添加 Polyline（折线）
   */
  public add(options: PolylineOptions): Entity {
    const positions = options.positions.map(pos => this.convertPosition(pos));
    const id = options.id || `polyline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const material = this.resolveMaterial(options.material);

    const entity = this.entities.add({
      id,
      polyline: {
        positions,
        width: options.width ?? 2,
        material,
        clampToGround: options.clampToGround ?? false,
      },
    });

    if (options.onClick) {
      (entity as any)._onClick = options.onClick;
    }

    return entity;
  }

  /**
   * 更新 Polyline 位置
   */
  public updatePositions(entity: Entity, positions: OverlayPosition[]): void {
    const newPositions = positions.map(pos => this.convertPosition(pos));
    if (entity.polyline) {
      entity.polyline.positions = new Cesium.ConstantProperty(newPositions);
    }
  }

  /**
   * 更新 Polyline 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<PolylineOptions, 'width' | 'material'>>): void {
    if (entity.polyline) {
      if (options.width !== undefined) {
        entity.polyline.width = new Cesium.ConstantProperty(options.width);
      }
      if (options.material !== undefined) {
        entity.polyline.material = this.resolveMaterial(options.material);
      }
    }
  }

  /**
   * 移除 Polyline（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.getById(entityOrId) : entityOrId;
    if (!entity) return false;
    delete (entity as any)._onClick;
    return this.entities.remove(entity);
  }
} 

