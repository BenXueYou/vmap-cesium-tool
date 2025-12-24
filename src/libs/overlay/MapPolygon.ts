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
   * 计算二维多边形方向（正值为 CCW）
   */
  private polygonArea2D(points: Cesium.Cartesian2[]): number {
    let sum = 0;
    for (let i = 0, n = points.length; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      sum += a.x * b.y - b.x * a.y;
    }
    return sum * 0.5;
  }

  /**
   * 向内偏移二维多边形顶点（线偏移 + 邻边相交）。厚度单位：米。
   * 对复杂凹形可能產生伪影，更适合凸多边形或温和凹形。
   */
  private offsetPolygon2DInward(points: Cesium.Cartesian2[], thickness: number): Cesium.Cartesian2[] {
    const n = points.length;
    if (n < 3) return points.slice();
    const area = this.polygonArea2D(points);
    const ccw = area > 0; // CCW
    const normals: Cesium.Cartesian2[] = [];
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // 外法线（CCW 时旋左 90° 得到外法线）
      const nx_out = ccw ? -uy : uy;
      const ny_out = ccw ? ux : -ux;
      // 内法线 = -外法线
      normals.push(new Cesium.Cartesian2(-nx_out, -ny_out));
    }
    // 每条边的偏移直线：n·x = c，其中 c = n·p + thickness
    const constants: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const nrm = normals[i];
      constants.push(nrm.x * p.x + nrm.y * p.y + thickness);
    }
    // 相邻边偏移直线求交，得到顶点
    const result: Cesium.Cartesian2[] = [];
    for (let i = 0; i < n; i++) {
      const iPrev = (i - 1 + n) % n;
      const n1 = normals[iPrev];
      const c1 = constants[iPrev];
      const n2 = normals[i];
      const c2 = constants[i];
      const det = n1.x * n2.y - n2.x * n1.y;
      if (Math.abs(det) < 1e-8) {
        // 平行，退化为沿当前内法线平移当前点
        const p = points[i];
        result.push(new Cesium.Cartesian2(p.x + n2.x * thickness, p.y + n2.y * thickness));
      } else {
        const x = (c1 * n2.y - c2 * n1.y) / det;
        const y = (n1.x * c2 - n2.x * c1) / det;
        result.push(new Cesium.Cartesian2(x, y));
      }
    }
    return result;
  }

  /**
   * 计算内偏移后的 3D 顶点：使用切平面近似进行 2D 偏移再投回椭球，并统一高度。
   */
  private computeInnerOffsetPositions(positions: Cesium.Cartesian3[], thicknessMeters: number, heightMeters: number): Cesium.Cartesian3[] {
    const plane = Cesium.EllipsoidTangentPlane.fromPoints(positions);
    const pts2 = plane.projectPointsOntoPlane(positions);
    const inner2 = this.offsetPolygon2DInward(pts2, thicknessMeters);
    const inner3 = plane.projectPointsOntoEllipsoid(inner2);
    return inner3.map((p) => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, heightMeters);
    });
  }

  /**
   * 为多边形顶点统一高度（含微小抬升）
   */
  private elevatePositions(positions: Cesium.Cartesian3[], heightMeters: number): Cesium.Cartesian3[] {
    return positions.map((p) => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, heightMeters);
    });
  }

  /**
   * 添加 Polygon（多边形）
   */
  public add(options: PolygonOptions): Entity {
    const positions = options.positions.map(pos => this.convertPosition(pos));
    const id = options.id || `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const material = this.resolveMaterial(options.material);

    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    if (ringThickness && ringThickness > 0) {
      const heights = positions.map(p => Cesium.Cartographic.fromCartesian(p).height || 0);
      const baseHeight = heights.length ? Math.min(...heights) : 0;
      const heightEpsilon = 0.1;
      const outerPositions = this.elevatePositions(positions, baseHeight + heightEpsilon);
      const innerPositions = this.computeInnerOffsetPositions(positions, ringThickness, baseHeight);

      const outer = this.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]),
          material: new Cesium.ColorMaterialProperty(options.material ? this.resolveColor(options.material) : Cesium.Color.BLACK),
          outline: false,
          heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
        },
      });

      const inner = this.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(innerPositions),
          material: new Cesium.ColorMaterialProperty(options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK),
          outline: false,
          heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
          extrudedHeight: options.extrudedHeight,
        },
      });

      if (options.onClick) {
        (outer as any)._onClick = options.onClick;
        (inner as any)._onClick = options.onClick;
      }

      (outer as any)._innerEntity = inner;
      (outer as any)._isRing = true;
      (outer as any)._ringThickness = ringThickness;
      (outer as any)._outerPositions = positions;

      return outer;
    }

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
    const inner = (entity as any)._innerEntity as Entity | undefined;
    const thickness = (entity as any)._ringThickness as number | undefined;
    if (entity.polygon && inner && thickness) {
      const heights = newPositions.map(p => Cesium.Cartographic.fromCartesian(p).height || 0);
      const baseHeight = heights.length ? Math.min(...heights) : 0;
      const heightEpsilon = 0.1;
      const outerPositions = this.elevatePositions(newPositions, baseHeight + heightEpsilon);
      const innerPositions = this.computeInnerOffsetPositions(newPositions, thickness, baseHeight);
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]));
      inner.polygon!.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(innerPositions));
      (entity as any)._outerPositions = newPositions;
    } else if (entity.polygon) {
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(newPositions));
    }
  }

  /**
   * 更新 Polygon 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<PolygonOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    const inner = (entity as any)._innerEntity as Entity | undefined;
    const isRing = (entity as any)._isRing as boolean | undefined;
    if (isRing && entity.polygon && inner) {
      if (options.outlineColor !== undefined) {
        entity.polygon.material = new Cesium.ColorMaterialProperty(this.resolveColor(options.outlineColor));
      }
      if (options.material !== undefined) {
        inner.polygon!.material = this.resolveMaterial(options.material);
      }
      if (options.outlineWidth !== undefined) {
        const thickness = Math.max(0, options.outlineWidth);
        (entity as any)._ringThickness = thickness;
        const outerPositions = ((entity as any)._outerPositions as Cesium.Cartesian3[]) ?? undefined;
        if (outerPositions && outerPositions.length >= 3) {
          const heights = outerPositions.map(p => Cesium.Cartographic.fromCartesian(p).height || 0);
          const baseHeight = heights.length ? Math.min(...heights) : 0;
          const heightEpsilon = 0.1;
          const outerElev = this.elevatePositions(outerPositions, baseHeight + heightEpsilon);
          const innerPositions = this.computeInnerOffsetPositions(outerPositions, thickness, baseHeight);
          entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(outerElev, [new Cesium.PolygonHierarchy(innerPositions)]));
          inner.polygon!.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(innerPositions));
        }
      }
    } else if (entity.polygon) {
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
    const inner = (entity as any)._innerEntity as Entity | undefined;
    if (inner) {
      delete (inner as any)._onClick;
      this.entities.remove(inner);
    }
    return this.entities.remove(entity);
  }
}

