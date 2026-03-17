import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color } from "cesium";
import type { OverlayPosition, OverlayEntity } from './types';

/**
 * Polyline 选项
 */
export interface PolylineOptions {
  positions: OverlayPosition[];
  width?: number;
  material?: Cesium.MaterialProperty | Color | string;
  clampToGround?: boolean;
  /** 贴地抬高量（米，clampToGround=true 时生效） */
  groundHeightEpsilon?: number;
  /** 点击该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  clickHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  /** 鼠标移入该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  hoverHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
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
  private resolveMaterial(material?: Cesium.MaterialProperty | Color | string): Cesium.MaterialProperty {
    if (!material) {
      return new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW);
    }
    if (typeof material === 'string') {
      return new Cesium.ColorMaterialProperty(this.resolveColor(material));
    }
    if (material instanceof Cesium.Color) {
      return new Cesium.ColorMaterialProperty(material);
    }
    return material as Cesium.MaterialProperty;
  }

  private elevatePositions(positions: Cesium.Cartesian3[], heightMeters: number): Cesium.Cartesian3[] {
    return positions.map((p) => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, heightMeters);
    });
  }

  /**
   * 添加 Polyline（折线）
   */
  public add(options: PolylineOptions): Entity {
    const positions = options.positions.map(pos => this.convertPosition(pos));
    const id = options.id || `polyline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const material = this.resolveMaterial(options.material);

    const clampToGround = options.clampToGround ?? false;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const finalPositions = (clampToGround && groundHeightEpsilon > 0)
      ? this.elevatePositions(positions, groundHeightEpsilon)
      : positions;

    const entity = this.entities.add({
      id,
      polyline: {
        positions: finalPositions,
        width: options.width ?? 2,
        material,
        clampToGround,
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
    overlayEntity._groundHeightEpsilon = groundHeightEpsilon;

    return entity;
  }

  /**
   * 更新 Polyline 位置
   */
  public updatePositions(entity: Entity, positions: OverlayPosition[]): void {
    const newPositions = positions.map(pos => this.convertPosition(pos));
    if (entity.polyline) {
      const overlay = entity as OverlayEntity;
      const clampToGround = (entity.polyline as any).clampToGround?.getValue?.(Cesium.JulianDate.now?.()) ?? (entity.polyline as any).clampToGround;
      const isClamp = typeof clampToGround === 'boolean' ? clampToGround : false;
      const groundHeightEpsilon = overlay._groundHeightEpsilon ?? 0;
      const finalPositions = (isClamp && groundHeightEpsilon > 0)
        ? this.elevatePositions(newPositions, groundHeightEpsilon)
        : newPositions;
      entity.polyline.positions = new Cesium.ConstantProperty(finalPositions);
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
    (entity as OverlayEntity)._onClick = undefined;
    return this.entities.remove(entity);
  }
} 

