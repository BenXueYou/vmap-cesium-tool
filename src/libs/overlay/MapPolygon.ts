import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference } from "cesium";
import type { OverlayPosition, OverlayEntity } from './types';

/**
 * Polygon 选项
 */
export interface PolygonOptions {
  positions: OverlayPosition[];
  material?: Cesium.MaterialProperty | Color | string;
  outline?: boolean;
  outlineColor?: Color | string;
  outlineWidth?: number;
  /**
   * 是否贴地（默认：在粗边框模式下为 true）。
   * - true：填充与边框都贴地（避免一贴地一悬空导致缝隙）。
   * - false：填充与边框都在统一的 baseHeight 上悬空。
   */
  clampToGround?: boolean;
  heightReference?: HeightReference;
  extrudedHeight?: number;
  /** 点击该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  clickHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  /** 鼠标移入该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  hoverHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
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
      const clampToGround = options.clampToGround ?? true;
      const baseHeight = clampToGround ? 0 : (Cesium.Cartographic.fromCartesian(positions[0])?.height ?? 0);
      const heightReference = clampToGround
        ? Cesium.HeightReference.CLAMP_TO_GROUND
        : (options.heightReference ?? Cesium.HeightReference.NONE);

      // 填充多边形：使用统一的 height/heightReference（不要和边框的 clampToGround 混用）
      const surfacePositions = this.elevatePositions(positions, 0);

      // 方案改为：填充用 Polygon；粗边框用 Polyline（闭合折线），避免双层多边形叠加产生的视觉问题
      const fill = this.entities.add({
        id,
        polygon: {
          hierarchy: surfacePositions,
          material: this.resolveMaterial(options.material ?? Cesium.Color.ORANGE.withAlpha(0.5)),
          outline: false,
          heightReference,
          ...(clampToGround ? {} : { height: baseHeight }),
          extrudedHeight: options.extrudedHeight,
        },
      });

      // 构造闭合边界路径
      const borderPositionsBase = this.elevatePositions(positions, baseHeight);
      const borderPositions: Cesium.Cartesian3[] = borderPositionsBase.slice();
      if (borderPositions.length >= 2) borderPositions.push(borderPositionsBase[0]);

      const border = this.entities.add({
        polyline: {
          positions: borderPositions,
          width: ringThickness,
          material: new Cesium.ColorMaterialProperty(
            this.resolveColor(options.outlineColor ?? Cesium.Color.ORANGE)
          ),
          clampToGround,
          ...(clampToGround ? { zIndex: 1 } : {}),
        },
      });

      if (options.onClick) {
        const fillEntity = fill as OverlayEntity;
        const borderEntity = border as OverlayEntity;
        fillEntity._onClick = options.onClick;
        borderEntity._onClick = options.onClick;
      }

      const fillEntity = fill as OverlayEntity;
      const borderEntity = border as OverlayEntity;
      const group = [fill, border];
      const clickHighlight = options.clickHighlight ?? false;
      const hoverHighlight = options.hoverHighlight ?? false;
      fillEntity._clickHighlight = clickHighlight;
      borderEntity._clickHighlight = clickHighlight;
      fillEntity._hoverHighlight = hoverHighlight;
      borderEntity._hoverHighlight = hoverHighlight;
      fillEntity._highlightEntities = group;
      borderEntity._highlightEntities = group;

      fillEntity._borderEntity = border;
      fillEntity._isThickOutline = true;
      fillEntity._outlineWidth = ringThickness;
      fillEntity._clampToGround = clampToGround;
      fillEntity._baseHeight = baseHeight;

      return fill;
    }

    // 非粗边框：默认贴地（可通过 clampToGround:false 或传入 heightReference 覆盖）
    const clampToGround = options.clampToGround ?? true;
    const heightReference =
      options.heightReference ?? (clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE);
    const hierarchy = clampToGround ? this.elevatePositions(positions, 0) : positions;

    const entity = this.entities.add({
      id,
      polygon: {
        hierarchy,
        material,
        outline: options.outline ?? true,
        outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK,
        outlineWidth: options.outlineWidth ?? 1,
        heightReference,
        extrudedHeight: options.extrudedHeight,
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

    (entity as OverlayEntity)._clampToGround = clampToGround;

    return entity;
  }

  /**
   * 更新 Polygon 位置
   */
  public updatePositions(entity: Entity, positions: OverlayPosition[]): void {
    const newPositions = positions.map(pos => this.convertPosition(pos));
    const overlayEntity = entity as OverlayEntity;
    const border = overlayEntity._borderEntity;
    const isThick = overlayEntity._isThickOutline;
    if (entity.polygon && border && isThick) {
      const clampToGround = overlayEntity._clampToGround ?? true;
      const baseHeight = clampToGround ? 0 : (Cesium.Cartographic.fromCartesian(newPositions[0])?.height ?? 0);
      overlayEntity._baseHeight = baseHeight;

      // 更新填充：保持与 add() 一致的 height 策略
      const surfacePositions = this.elevatePositions(newPositions, 0);
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(surfacePositions));
      if (!clampToGround) {
        (entity.polygon as any).height = new Cesium.ConstantProperty(baseHeight);
      }

      // 更新边框折线（闭合）
      const borderBase = this.elevatePositions(newPositions, baseHeight);
      const closed = borderBase.slice();
      if (closed.length >= 2) closed.push(borderBase[0]);
      if (border.polyline) {
        border.polyline.positions = new Cesium.ConstantProperty(closed);
        (border.polyline as any).clampToGround = new Cesium.ConstantProperty(clampToGround);
      }
    } else if (entity.polygon) {
      const clampToGround = overlayEntity._clampToGround ?? false;
      const hierarchy = clampToGround ? this.elevatePositions(newPositions, 0) : newPositions;
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(hierarchy));
      if (clampToGround) {
        entity.polygon.heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.CLAMP_TO_GROUND);
      }
    }
  }

  /**
   * 更新 Polygon 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<PolygonOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    const overlayEntity = entity as OverlayEntity;
    const border = overlayEntity._borderEntity;
    const isThick = overlayEntity._isThickOutline;
    if (isThick && entity.polygon && border) {
      if (options.material !== undefined) {
        entity.polygon.material = this.resolveMaterial(options.material);
      }
      if (options.outlineColor !== undefined && border.polyline) {
        border.polyline.material = new Cesium.ColorMaterialProperty(this.resolveColor(options.outlineColor));
      }
      if (options.outlineWidth !== undefined && border.polyline) {
        border.polyline.width = new Cesium.ConstantProperty(Math.max(0, options.outlineWidth));
        overlayEntity._outlineWidth = options.outlineWidth;
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
    const overlayEntity = entity as OverlayEntity;
    const border = overlayEntity._borderEntity;
    if (border) {
      (border as OverlayEntity)._onClick = undefined;
      this.entities.remove(border);
    }
    overlayEntity._onClick = undefined;
    return this.entities.remove(entity);
  }
}

