import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference } from "cesium";
import type { OverlayPosition, OverlayEntity } from './types';

/**
 * Circle 选项
 */
export interface CircleOptions {
  position: OverlayPosition;
  radius: number; // 米
  material?: Cesium.MaterialProperty | Color | string;
  outline?: boolean;
  outlineColor?: Color | string;
  outlineWidth?: number;
  heightReference?: HeightReference;
  extrudedHeight?: number;
  heightEpsilon?: number; // 高度容差，用于环形方案
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * Circle 工具类
 */
export class MapCircle {
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
   * 添加 Circle（圆形）
   */
  public add(options: CircleOptions): Entity {
    const position = this.convertPosition(options.position);
    const id = options.id || `circle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const material = this.resolveMaterial(options.material);

    // 判断是否启用双层椭圆环方案：当 outlineWidth>1 时，将其视为米单位厚度，使用双层椭圆实现粗边框
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;

    if (ringThickness > 0) {
      const baseCarto = Cesium.Cartographic.fromCartesian(position);
      const baseHeight = (baseCarto?.height ?? 0) as number;
      const heightEpsilon = 0.01; // 米：避免共面导致视觉问题

      const outerRadius = options.radius;
      const innerRadius = Math.max(0, options.radius - ringThickness);

      const outerPositions = this.generateCirclePositions(baseCarto, outerRadius, baseHeight + heightEpsilon);
      const innerPositions = this.generateCirclePositions(baseCarto, innerRadius, baseHeight);

      const outer = this.entities.add({
        // 使用带洞的多边形，只渲染环带区域，不填充中心
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]),
          material: new Cesium.ColorMaterialProperty(options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK),
          outline: false,
          heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
        },
      });

      const inner = this.entities.add({
        position,
        ellipse: {
          semiMajorAxis: innerRadius,
          semiMinorAxis: innerRadius,
          material: material instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(material) : (material as Cesium.MaterialProperty),
          outline: false,
          height: baseHeight,
          heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
          extrudedHeight: options.extrudedHeight,
        },
      });

      if (options.onClick) {
        const outerEntity = outer as OverlayEntity;
        const innerEntity = inner as OverlayEntity;
        outerEntity._onClick = options.onClick;
        innerEntity._onClick = options.onClick;
      }

      // 记录元数据，便于更新/移除
      const outerEntity = outer as OverlayEntity;
      outerEntity._innerEntity = inner;
      outerEntity._isRing = true;
      outerEntity._ringThickness = ringThickness;
      outerEntity._fillMaterial = material;
      outerEntity._ringHeightEpsilon = heightEpsilon;
      outerEntity._centerCartographic = baseCarto;
      outerEntity._outerRadius = outerRadius;
      outerEntity._innerRadius = innerRadius;

      return outer;
    } else {
      const entity = this.entities.add({
        id,
        position,
        ellipse: {
          semiMajorAxis: options.radius,
          semiMinorAxis: options.radius,
          material,
          outline: options.outline ?? true,
          outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK,
          outlineWidth: options.outlineWidth ?? 1,
          heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
          extrudedHeight: options.extrudedHeight,
        },
      });

      if (options.onClick) {
        const overlayEntity = entity as OverlayEntity;
        overlayEntity._onClick = options.onClick;
      }

      return entity;
    }
  }

  /**
   * 生成近似圆（多边形）顶点，返回 Cartesian3 数组。
   * 使用大圆航线公式，segments 越大越平滑。
   */
  private generateCirclePositions(center: Cesium.Cartographic, radiusMeters: number, heightMeters: number, segments: number = 128): Cesium.Cartesian3[] {
    const R = 6378137.0; // WGS84 半径近似
    const lat1 = center.latitude;
    const lon1 = center.longitude;
    const d = radiusMeters / R;
    const positions: Cesium.Cartesian3[] = [];
    for (let i = 0; i < segments; i++) {
      const bearing = (i / segments) * Cesium.Math.TWO_PI;
      const sinLat1 = Math.sin(lat1);
      const cosLat1 = Math.cos(lat1);
      const sinD = Math.sin(d);
      const cosD = Math.cos(d);
      const sinBearing = Math.sin(bearing);
      const cosBearing = Math.cos(bearing);
      const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * cosBearing);
      const lon2 = lon1 + Math.atan2(sinBearing * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));
      positions.push(Cesium.Cartesian3.fromRadians(lon2, lat2, heightMeters));
    }
    return positions;
  }

  /**
   * 更新 Circle 位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const newPosition = this.convertPosition(position);
    entity.position = new Cesium.ConstantPositionProperty(newPosition);
    const inner = (entity as OverlayEntity)._innerEntity;
    if (inner) {
      inner.position = new Cesium.ConstantPositionProperty(newPosition);
    }
  }

  /**
   * 更新 Circle 半径
   */
  public updateRadius(entity: Entity, radius: number): void {
    if (entity.ellipse) {
      entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(radius);
      entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(radius);
    }
    const overlayEntity = entity as OverlayEntity;
    const inner = overlayEntity._innerEntity;
    const thickness = overlayEntity._ringThickness;
    if (inner && thickness !== undefined) {
      const innerRadius = Math.max(0, radius - thickness);
      if (inner.ellipse) {
        inner.ellipse.semiMajorAxis = new Cesium.ConstantProperty(innerRadius);
        inner.ellipse.semiMinorAxis = new Cesium.ConstantProperty(innerRadius);
      }
    }
  }

  /**
   * 更新 Circle 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<CircleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    if (entity.ellipse) {
      if (options.material !== undefined) {
        const mat = this.resolveMaterial(options.material);
        // 若为环形方案，material 作为填充色应用到内层；否则应用到当前实体
        const inner = (entity as OverlayEntity)._innerEntity;
        if (inner && inner.ellipse) {
          inner.ellipse.material = mat instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(mat) : (mat as Cesium.MaterialProperty);
        } else {
          entity.ellipse.material = mat instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(mat) : (mat as Cesium.MaterialProperty);
        }
      }
      const inner = (entity as OverlayEntity)._innerEntity;
      if (inner) {
        // 环形方案：outline 开关不再生效，使用外层作为边框
        if (options.outlineColor !== undefined) {
          entity.ellipse.material = new Cesium.ColorMaterialProperty(this.resolveColor(options.outlineColor));
        }
        if (options.outlineWidth !== undefined) {
          const overlayEntity = entity as OverlayEntity;
          const thickness = Math.max(0, options.outlineWidth);
          overlayEntity._ringThickness = thickness;
          const outerRadius = (entity.ellipse.semiMajorAxis as any)?.getValue?.(Cesium.JulianDate.now()) ?? undefined;
          // 如果拿不到，尽量从 ConstantProperty 读取
          const R = typeof outerRadius === 'number' ? outerRadius : undefined;
          if (R !== undefined) {
            const innerRadius = Math.max(0, R - thickness);
            inner.ellipse!.semiMajorAxis = new Cesium.ConstantProperty(innerRadius);
            inner.ellipse!.semiMinorAxis = new Cesium.ConstantProperty(innerRadius);
          }
        }
      } else {
        // 非环形：按原生 outline 逻辑
        if (options.outline !== undefined) {
          entity.ellipse.outline = new Cesium.ConstantProperty(options.outline);
        }
        if (options.outlineColor !== undefined) {
          entity.ellipse.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor));
        }
        if (options.outlineWidth !== undefined) {
          entity.ellipse.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
        }
      }
    }
  }

  /**
   * 移除 Circle（通过实体或实体 id）
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

