import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference } from "cesium";
import type { OverlayPosition, OverlayEntity } from './types';
import { PolygonPrimitiveBatch } from './primitives/PolygonPrimitiveBatch';
import { PolygonPrimitiveLayerStack } from './primitives/PolygonPrimitiveLayerStack';

/**
 * Polygon 选项
 */
export interface PolygonOptions {
  positions: OverlayPosition[];
  /**
   * 渲染模式：
   * - auto：自动选择（默认；当前仅在“粗边框+贴地+纯色”场景下会切到 primitive）
   * - entity：使用 Cesium Entity
   * - primitive：使用 Cesium GroundPrimitive / GroundPolylinePrimitive（大批量静态贴地场景）
   */
  renderMode?: 'auto' | 'entity' | 'primitive';
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
  /** 贴地抬高量（米，clampToGround=true 时生效） */
  groundHeightEpsilon?: number;
  heightReference?: HeightReference;
  extrudedHeight?: number;
  /** 点击该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  clickHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  /** 鼠标移入该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  hoverHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  /**
   * Primitive 模式分层渲染 key。
   * - 相同 layerKey 的 polygon 会被合并到同一个批次中（更高性能）
   * - 不同 layerKey 会进入不同的“图层空间”，并按首次出现顺序确定上下层
   * - 只对 primitive 生效；entity 模式忽略
   */
  layerKey?: string;
  id?: string;
}

/**
 * Polygon 工具类
 */
export class MapPolygon {
  private viewer: Viewer;
  private entities: Cesium.EntityCollection;
  private primitiveBatch: PolygonPrimitiveBatch | null = null;
  private primitiveLayerStack: PolygonPrimitiveLayerStack | null = null;
  private primitiveBatchesByLayer: Map<string, PolygonPrimitiveBatch> = new Map();

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.entities = viewer.entities;
  }

  private getPrimitiveBatch(): PolygonPrimitiveBatch {
    if (!this.primitiveBatch) {
      this.primitiveBatch = new PolygonPrimitiveBatch(this.viewer);
    }
    return this.primitiveBatch;
  }

  private getLayeredPrimitiveBatch(layerKey: string): PolygonPrimitiveBatch {
    const key = String(layerKey);
    const existing = this.primitiveBatchesByLayer.get(key);
    if (existing) return existing;

    if (!this.primitiveLayerStack) {
      this.primitiveLayerStack = new PolygonPrimitiveLayerStack(this.viewer);
    }
    const { fillCollection, borderCollection } = this.primitiveLayerStack.getLayerCollections(key);
    const batch = new PolygonPrimitiveBatch(this.viewer, { fillCollection, borderCollection });
    this.primitiveBatchesByLayer.set(key, batch);
    return batch;
  }

  private getPrimitiveBatchForOverlay(overlay: OverlayEntity): PolygonPrimitiveBatch {
    const layerKey = (overlay as any)._primitiveLayerKey as string | undefined;
    if (layerKey) return this.getLayeredPrimitiveBatch(layerKey);
    return this.getPrimitiveBatch();
  }

  private resolveMaterialColor(material?: Cesium.MaterialProperty | Color | string): Cesium.Color | null {
    if (!material) return Cesium.Color.BLUE.withAlpha(0.5);
    if (typeof material === 'string') return this.resolveColor(material);
    if (material instanceof Cesium.Color) return material;
    if (material instanceof Cesium.ColorMaterialProperty) {
      try {
        const c: any = (material as any).color;
        const v = c && typeof c.getValue === 'function' ? c.getValue(Cesium.JulianDate.now()) : c;
        if (v instanceof Cesium.Color) return v;
        if (typeof v === 'string') return this.resolveColor(String(v));
      } catch {
        // ignore
      }
    }
    return null;
  }

  private canUsePrimitive(options: PolygonOptions): boolean {
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    if (!(ringThickness > 0)) return false;
    const clampToGround = options.clampToGround ?? true;
    if (!clampToGround) return false;
    if (options.extrudedHeight !== undefined) return false;
    if (this.resolveMaterialColor(options.material ?? Cesium.Color.ORANGE.withAlpha(0.5)) === null) return false;
    // borderColor 也要求纯色（Color / css string）
    if (options.outlineColor !== undefined && this.resolveColor(options.outlineColor as any) === null) return false;
    return true;
  }

  private addPrimitivePolygon(options: PolygonOptions): Entity {
    const positions = options.positions.map(pos => this.convertPosition(pos));
    const id = options.id || `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const layerKey = options.layerKey;

    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    if (!(ringThickness > 0) || !clampToGround || options.extrudedHeight !== undefined) {
      console.warn('[vmap-cesium-tool] Polygon renderMode=primitive is not supported for the given options; falling back to Entity.');
      return this.add({ ...options, renderMode: 'entity' });
    }

    const fillColor = this.resolveMaterialColor(options.material ?? Cesium.Color.ORANGE.withAlpha(0.5));
    if (!fillColor) {
      console.warn('[vmap-cesium-tool] Polygon renderMode=primitive requires solid color material; falling back to Entity.');
      return this.add({ ...options, renderMode: 'entity' });
    }

    const borderColor = options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.ORANGE;
    const borderWidth = Math.max(1, Number(ringThickness) || 1);

    // Primitive 使用 proxy entity 作为 pick id（不加入 viewer.entities）
    const fill = new Cesium.Entity({ id });
    const border = new Cesium.Entity({ id: `${id}__border` });

    const fillEntity = fill as OverlayEntity;
    const borderEntity = border as OverlayEntity;
    fillEntity._overlayType = 'polygon-primitive';
    borderEntity._overlayType = 'polygon-primitive';

    if (layerKey) {
      (fillEntity as any)._primitiveLayerKey = layerKey;
      (borderEntity as any)._primitiveLayerKey = layerKey;
    }

    if (options.onClick) {
      fillEntity._onClick = options.onClick;
      borderEntity._onClick = options.onClick;
    }

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
    fillEntity._outlineWidth = borderWidth;
    fillEntity._clampToGround = true;
    fillEntity._baseHeight = 0;
    fillEntity._groundHeightEpsilon = groundHeightEpsilon;

    // 保存原始颜色，供高亮恢复使用
    fillEntity._primitiveFillBaseColor = fillColor;
    fillEntity._primitiveBorderBaseColor = borderColor;
    borderEntity._primitiveFillBaseColor = fillColor;
    borderEntity._primitiveBorderBaseColor = borderColor;
    borderEntity._groundHeightEpsilon = groundHeightEpsilon;

    // 贴地：统一把高度压到 0
    const surfacePositions = this.elevatePositions(positions, groundHeightEpsilon);
    const borderBase = surfacePositions;
    const borderPositions: Cesium.Cartesian3[] = borderBase.slice();
    if (borderPositions.length >= 2) borderPositions.push(borderBase[0]);

    // 记录边界（闭合），供高亮时绘制 glow 边框使用
    fillEntity._primitiveOutlinePositions = borderPositions;
    borderEntity._primitiveOutlinePositions = borderPositions;

    const batch = layerKey ? this.getLayeredPrimitiveBatch(layerKey) : this.getPrimitiveBatch();
    batch.upsertGeometry({
      polygonId: id,
      parts: { fill, border },
      fillPositions: surfacePositions,
      borderPositions,
      borderWidth,
      fillColor,
      borderColor,
      visible: true,
    });

    return fill;
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
    const renderMode = options.renderMode ?? 'auto';
    if ((renderMode === 'primitive' || renderMode === 'auto') && this.canUsePrimitive(options)) {
      return this.addPrimitivePolygon(options);
    }

    const positions = options.positions.map(pos => this.convertPosition(pos));
    const id = options.id || `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const material = this.resolveMaterial(options.material);

    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    if (ringThickness && ringThickness > 0) {
      const clampToGround = options.clampToGround ?? true;
      const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
      const baseHeight = clampToGround ? 0 : (Cesium.Cartographic.fromCartesian(positions[0])?.height ?? 0);
      const heightReference = clampToGround
        ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
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
          ...(!clampToGround && baseHeight !== undefined ? { height: baseHeight } : {}),
          ...(clampToGround && groundHeightEpsilon > 0 ? { height: groundHeightEpsilon } : {}),
          extrudedHeight: options.extrudedHeight,
        },
      });

      // 构造闭合边界路径
      const borderPositionsBase = this.elevatePositions(positions, clampToGround ? groundHeightEpsilon : baseHeight);
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
      fillEntity._groundHeightEpsilon = groundHeightEpsilon;

      borderEntity._groundHeightEpsilon = groundHeightEpsilon;

      return fill;
    }

    // 非粗边框：默认贴地（可通过 clampToGround:false 或传入 heightReference 覆盖）
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const heightReference =
      options.heightReference ?? (clampToGround
        ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
        : Cesium.HeightReference.NONE);
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
        ...(clampToGround && groundHeightEpsilon > 0 ? { height: groundHeightEpsilon } : {}),
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
    (entity as OverlayEntity)._groundHeightEpsilon = groundHeightEpsilon;

    return entity;
  }

  /**
   * 更新 Polygon 位置
   */
  public updatePositions(entity: Entity, positions: OverlayPosition[]): void {
    const newPositions = positions.map(pos => this.convertPosition(pos));
    const overlayEntity = entity as OverlayEntity;

    // primitive
    if (overlayEntity._overlayType === 'polygon-primitive') {
      const root = overlayEntity._highlightEntities && overlayEntity._highlightEntities.length > 0
        ? (overlayEntity._highlightEntities[0] as OverlayEntity)
        : overlayEntity;
      const border = root._borderEntity;
      if (!border) return;
      const id = String(root.id);
      const groundHeightEpsilon = root._groundHeightEpsilon ?? 0;
      const surfacePositions = this.elevatePositions(newPositions, groundHeightEpsilon);
      const borderBase = surfacePositions;
      const borderPositions: Cesium.Cartesian3[] = borderBase.slice();
      if (borderPositions.length >= 2) borderPositions.push(borderBase[0]);

      root._primitiveOutlinePositions = borderPositions;
      const borderPart = root._borderEntity as OverlayEntity | undefined;
      if (borderPart) borderPart._primitiveOutlinePositions = borderPositions;

      const fillColor = root._primitiveFillBaseColor ?? Cesium.Color.ORANGE.withAlpha(0.5);
      const borderColor = root._primitiveBorderBaseColor ?? Cesium.Color.ORANGE;
      const borderWidth = Math.max(1, Number(root._outlineWidth ?? 2) || 2);

      this.getPrimitiveBatchForOverlay(root).upsertGeometry({
        polygonId: id,
        parts: { fill: root, border },
        fillPositions: surfacePositions,
        borderPositions,
        borderWidth,
        fillColor,
        borderColor,
        visible: entity.show !== false,
      });
      return;
    }

    const border = overlayEntity._borderEntity;
    const isThick = overlayEntity._isThickOutline;
    if (entity.polygon && border && isThick) {
      const clampToGround = overlayEntity._clampToGround ?? true;
      const groundHeightEpsilon = overlayEntity._groundHeightEpsilon ?? 0;
      const baseHeight = clampToGround ? 0 : (Cesium.Cartographic.fromCartesian(newPositions[0])?.height ?? 0);
      overlayEntity._baseHeight = baseHeight;

      // 更新填充：保持与 add() 一致的 height 策略
      const surfacePositions = this.elevatePositions(newPositions, 0);
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(surfacePositions));
      if (clampToGround) {
        (entity.polygon as any).heightReference = new Cesium.ConstantProperty(
          groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND
        );
        (entity.polygon as any).height = groundHeightEpsilon > 0 ? new Cesium.ConstantProperty(groundHeightEpsilon) : undefined;
      } else {
        (entity.polygon as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
        (entity.polygon as any).height = new Cesium.ConstantProperty(baseHeight);
      }

      // 更新边框折线（闭合）
      const borderBase = this.elevatePositions(newPositions, clampToGround ? groundHeightEpsilon : baseHeight);
      const closed = borderBase.slice();
      if (closed.length >= 2) closed.push(borderBase[0]);
      if (border.polyline) {
        border.polyline.positions = new Cesium.ConstantProperty(closed);
        (border.polyline as any).clampToGround = new Cesium.ConstantProperty(clampToGround);
      }
    } else if (entity.polygon) {
      const clampToGround = overlayEntity._clampToGround ?? false;
      const groundHeightEpsilon = overlayEntity._groundHeightEpsilon ?? 0;
      const hierarchy = clampToGround ? this.elevatePositions(newPositions, 0) : newPositions;
      entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(hierarchy));
      if (clampToGround) {
        entity.polygon.heightReference = new Cesium.ConstantProperty(
          groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND
        );
        (entity.polygon as any).height = groundHeightEpsilon > 0 ? new Cesium.ConstantProperty(groundHeightEpsilon) : undefined;
      }
    }
  }

  /**
   * 更新 Polygon 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<PolygonOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    const overlayEntity = entity as OverlayEntity;

    // primitive
    if (overlayEntity._overlayType === 'polygon-primitive') {
      const root = overlayEntity._highlightEntities && overlayEntity._highlightEntities.length > 0
        ? (overlayEntity._highlightEntities[0] as OverlayEntity)
        : overlayEntity;
      const id = String(root.id);
      if (options.material !== undefined) {
        const c = this.resolveMaterialColor(options.material as any);
        if (c) {
          root._primitiveFillBaseColor = c;
          const border = root._borderEntity;
          if (border) (border as OverlayEntity)._primitiveFillBaseColor = c;
        }
      }
      if (options.outlineColor !== undefined) {
        const c = this.resolveColor(options.outlineColor as any);
        root._primitiveBorderBaseColor = c;
        const border = root._borderEntity;
        if (border) (border as OverlayEntity)._primitiveBorderBaseColor = c;
      }
      if (options.outlineWidth !== undefined) {
        const w = Math.max(1, Number(options.outlineWidth) || 1);
        root._outlineWidth = w;
        this.getPrimitiveBatchForOverlay(root).setBorderWidth(id, w);
      }

      const fillColor = root._primitiveFillBaseColor ?? Cesium.Color.ORANGE.withAlpha(0.5);
      const borderColor = root._primitiveBorderBaseColor ?? Cesium.Color.ORANGE;
      this.getPrimitiveBatchForOverlay(root).setColors(id, borderColor, fillColor);
      return;
    }

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
    const direct = (typeof entityOrId !== 'string') ? entityOrId : entity;
    const anyOverlay = direct as OverlayEntity;
    if (anyOverlay && anyOverlay._overlayType === 'polygon-primitive') {
      const root = anyOverlay._highlightEntities && anyOverlay._highlightEntities.length > 0
        ? (anyOverlay._highlightEntities[0] as OverlayEntity)
        : anyOverlay;
      const id = String((root as any).id);
      try {
        this.getPrimitiveBatchForOverlay(root).remove(id);
      } catch {
        // ignore
      }
      const border = root._borderEntity;
      if (border) {
        (border as OverlayEntity)._onClick = undefined;
        root._borderEntity = undefined;
      }
      root._onClick = undefined;
      return true;
    }

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

  public setPrimitiveVisible(entity: Entity, visible: boolean): void {
    const overlay = entity as OverlayEntity;
    if (overlay._overlayType !== 'polygon-primitive') return;
    const root = overlay._highlightEntities && overlay._highlightEntities.length > 0
      ? (overlay._highlightEntities[0] as OverlayEntity)
      : overlay;
    const id = String(root.id);
    this.getPrimitiveBatchForOverlay(root).setVisible(id, visible);
  }

  public applyPrimitiveHighlight(entity: OverlayEntity, hlColor: Cesium.Color, fillAlpha: number): void {
    if (entity._overlayType !== 'polygon-primitive') return;
    const root = entity._highlightEntities && entity._highlightEntities.length > 0
      ? (entity._highlightEntities[0] as OverlayEntity)
      : entity;
    const id = String(root.id);

    if (!root._primitiveBorderBaseColor) root._primitiveBorderBaseColor = Cesium.Color.ORANGE;
    if (!root._primitiveFillBaseColor) root._primitiveFillBaseColor = Cesium.Color.ORANGE.withAlpha(0.5);

    const borderColor = hlColor.withAlpha(1.0);
    const fillColor = root._primitiveFillBaseColor ?? Cesium.Color.ORANGE.withAlpha(0.5);
    // 仅高亮边框，不改变填充
    this.getPrimitiveBatchForOverlay(root).setColors(id, borderColor, fillColor);
    entity._isHighlighted = true;
  }

  public restorePrimitiveHighlight(entity: OverlayEntity): void {
    if (entity._overlayType !== 'polygon-primitive') return;
    const root = entity._highlightEntities && entity._highlightEntities.length > 0
      ? (entity._highlightEntities[0] as OverlayEntity)
      : entity;
    const id = String(root.id);
    if (root._primitiveBorderBaseColor && root._primitiveFillBaseColor) {
      this.getPrimitiveBatchForOverlay(root).setColors(id, root._primitiveBorderBaseColor, root._primitiveFillBaseColor);
    }
    entity._isHighlighted = false;
  }
}

