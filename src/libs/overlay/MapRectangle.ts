import * as Cesium from "cesium";
import type { Viewer, Entity, Color, HeightReference } from "cesium";

/**
 * Rectangle 选项
 */
export interface RectangleOptions {
  coordinates: Cesium.Rectangle;
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
   * 添加 Rectangle（矩形）
   */
  public add(options: RectangleOptions): Entity {
    const id = options.id || `rectangle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const material = this.resolveMaterial(options.material);

    const entity = this.entities.add({
      id,
      rectangle: {
        coordinates: options.coordinates,
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
   * 更新 Rectangle 坐标
   */
  public updateCoordinates(entity: Entity, coordinates: Cesium.Rectangle): void {
    if (entity.rectangle) {
      entity.rectangle.coordinates = new Cesium.ConstantProperty(coordinates);
    }
  }

  /**
   * 更新 Rectangle 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<RectangleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    if (entity.rectangle) {
      if (options.material !== undefined) {
        entity.rectangle.material = new Cesium.ColorMaterialProperty(this.resolveMaterial(options.material));
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
    delete (entity as any)._onClick;
    return this.entities.remove(entity);
  }
} 

