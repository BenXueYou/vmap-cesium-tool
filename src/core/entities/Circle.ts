import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, MaterialProperty, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';
import { CirclePrimitiveBatch } from './primitives/CirclePrimitiveBatch';
import { CirclePrimitiveLayerStack } from './primitives/CirclePrimitiveLayerStack';

/**
 * Circle 配置选项
 */
export interface CircleOptions extends BaseOverlayOptions {
  /** 圆心位置 */
  position: OverlayPosition;
  /** 半径（米） */
  radius: number;
  /** 填充材质 */
  material?: MaterialProperty | Color | string;
  /** 是否显示边框（默认 true） */
  outline?: boolean;
  /** 边框颜色 */
  outlineColor?: Color | string;
  /** 边框宽度（默认 1） */
  outlineWidth?: number;
  /** 是否贴地（默认 true） */
  clampToGround?: boolean;
  /** 贴地抬高量（米，clampToGround=true 时生效） */
  groundHeightEpsilon?: number;
  /** 高度参考 */
  heightReference?: HeightReference;
  /** 拉伸高度 */
  extrudedHeight?: number;
  /** 兼容旧版渲染模式配置 */
  renderMode?: 'auto' | 'entity' | 'primitive';
  /** 兼容旧版圆周分段数 */
  segments?: number;
}

class CirclePrimitiveManager {
  private readonly defaultBatch: CirclePrimitiveBatch;
  private readonly batchesByLayer = new Map<string, CirclePrimitiveBatch>();
  private layerStack: CirclePrimitiveLayerStack | null = null;

  constructor(private readonly viewer: Viewer) {
    this.defaultBatch = new CirclePrimitiveBatch(viewer);
  }

  private getBatchByLayerKey(layerKey?: string): CirclePrimitiveBatch {
    if (!layerKey) {
      return this.defaultBatch;
    }

    const key = String(layerKey);
    const existing = this.batchesByLayer.get(key);
    if (existing) {
      return existing;
    }

    if (!this.layerStack) {
      this.layerStack = new CirclePrimitiveLayerStack(this.viewer);
    }

    const { fillCollection, ringCollection } = this.layerStack.getLayerCollections(key);
    const batch = new CirclePrimitiveBatch(this.viewer, { fillCollection, ringCollection });
    this.batchesByLayer.set(key, batch);
    return batch;
  }

  private getBatchForOverlay(overlay: any): CirclePrimitiveBatch {
    return this.getBatchByLayerKey(overlay?._primitiveLayerKey);
  }

  public upsertGeometry(
    root: any,
    parts: { outer: Entity; inner: Entity },
    ringPositions: Cesium.Cartesian3[],
    fillPositions: Cesium.Cartesian3[],
    ringColor: Cesium.Color,
    fillColor: Cesium.Color,
    visible: boolean,
  ): void {
    this.getBatchForOverlay(root).upsertGeometry({
      circleId: String(root.id),
      parts,
      ringPositions,
      fillPositions,
      ringColor,
      fillColor,
      visible,
    });
  }

  public setVisible(root: any, visible: boolean): void {
    this.getBatchForOverlay(root).setVisible(String(root.id), visible);
  }

  public setColors(root: any, ringColor: Cesium.Color, fillColor: Cesium.Color): void {
    this.getBatchForOverlay(root).setColors(String(root.id), ringColor, fillColor);
  }

  public remove(root: any): void {
    this.getBatchForOverlay(root).remove(String(root.id));
  }

  public destroy(): void {
    this.defaultBatch.destroy();
    this.batchesByLayer.forEach((batch) => batch.destroy());
    this.batchesByLayer.clear();
    this.layerStack?.destroy();
    this.layerStack = null;
  }
}

/**
 * Circle 圆形类
 * 
 * 用于在地图上创建圆形区域，支持自定义填充、边框和贴地属性。
 * 使用 Cesium Ellipse 实现。
 * 
 * @example
 * ```typescript
 * const circle = new Circle(viewer, {
 *   position: [120.1, 30.2],
 *   radius: 1000,
 *   material: 'rgba(255, 0, 0, 0.3)',
 *   outline: true,
 *   outlineColor: '#FF0000'
 * });
 * viewer.entities.add(circle.getEntity());
 * ```
 */
export class Circle extends BaseOverlay {
  private static primitiveManagers = new WeakMap<Viewer, CirclePrimitiveManager>();

  private circleOptions: CircleOptions;
  private innerEntity?: Entity;
  private primitiveMode = false;
  private primitiveManager: CirclePrimitiveManager | null = null;

  constructor(viewer: Viewer, options: CircleOptions) {
    super(viewer, options);
    this.circleOptions = options;
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    const renderMode = options.renderMode ?? 'auto';

    if ((renderMode === 'primitive' || renderMode === 'auto') && this.canUsePrimitive(options)) {
      this.initPrimitiveCircle(options, ringThickness);
    } else if (ringThickness && ringThickness > 1) {
      // 创建粗边框圆形（使用双层椭圆方式）
      this.createThickCircle(options, ringThickness);
    } else {
      // 普通圆形
      this.entity.ellipse = this.createEllipseGraphics(options);
    }
    
    // 设置覆盖物类型标识
    if (!this.primitiveMode) {
      (this.entity as any)._overlayType = 'circle';
    }
  }

  private static getPrimitiveManager(viewer: Viewer): CirclePrimitiveManager {
    const existing = Circle.primitiveManagers.get(viewer);
    if (existing) {
      return existing;
    }

    const manager = new CirclePrimitiveManager(viewer);
    Circle.primitiveManagers.set(viewer, manager);
    return manager;
  }

  private canUsePrimitive(options: CircleOptions): boolean {
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    if (!(ringThickness > 0)) return false;
    if ((options.clampToGround ?? true) !== true) return false;
    if (options.extrudedHeight !== undefined) return false;
    return this.resolveMaterialColor(options.material) !== null;
  }

  private resolveMaterialColor(material?: MaterialProperty | Color | string): Cesium.Color | null {
    if (!material) return Cesium.Color.BLUE.withAlpha(0.5);
    if (typeof material === 'string') return this.resolveColor(material, Cesium.Color.BLUE.withAlpha(0.5));
    if (material instanceof Cesium.Color) return material;
    if (material instanceof Cesium.ColorMaterialProperty) {
      try {
        const c: any = (material as any).color;
        const v = c && typeof c.getValue === 'function' ? c.getValue(Cesium.JulianDate.now()) : c;
        if (v instanceof Cesium.Color) return v;
        if (typeof v === 'string') return this.resolveColor(String(v), Cesium.Color.BLUE.withAlpha(0.5));
      } catch {
        // ignore
      }
    }
    return null;
  }

  private getDefaultSegmentsForRadius(radiusMeters: number): number {
    const r = Math.max(0, Number(radiusMeters));
    if (!Number.isFinite(r)) return 96;
    if (r <= 200) return 48;
    if (r <= 1000) return 64;
    if (r <= 5000) return 96;
    return 128;
  }

  private initPrimitiveCircle(options: CircleOptions, ringThickness: number): void {
    this.primitiveMode = true;
    this.primitiveManager = Circle.getPrimitiveManager(this.viewer);

    const id = String(this.getId());
    const position = this.toCartesian3(options.position)!;
    const carto = Cesium.Cartographic.fromCartesian(position);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const baseCarto = new Cesium.Cartographic(carto.longitude, carto.latitude, groundHeightEpsilon);
    const baseHeight = clampToGround ? 0 : (carto.height ?? 0);
    const outerRadius = options.radius;
    const innerRadius = Math.max(0, options.radius - ringThickness);
    const ringSegments = Math.max(16, Math.floor(options.segments ?? this.getDefaultSegmentsForRadius(outerRadius)));

    const outerPositions = this.generateCirclePositions(baseCarto, outerRadius, groundHeightEpsilon, ringSegments);
    const innerPositions = this.generateCirclePositions(baseCarto, innerRadius, groundHeightEpsilon, ringSegments);
    const ringClosed = outerPositions.slice();
    if (ringClosed.length >= 2) {
      ringClosed.push(ringClosed[0]);
    }

    const ringColor = options.outlineColor
      ? this.resolveColor(options.outlineColor, Cesium.Color.BLACK)
      : Cesium.Color.BLACK;
    const fillColor = this.resolveMaterialColor(options.material) ?? Cesium.Color.BLUE.withAlpha(0.5);

    const root: any = this.entity as any;
    const inner = new Cesium.Entity({ id: `${id}__fill` });
    const innerAny: any = inner as any;
    this.innerEntity = inner;

    root._overlayType = 'circle-primitive';
    root._primitiveLayerKey = options.layerKey;
    root._innerEntity = inner;
    root._isRing = true;
    root._ringThickness = ringThickness;
    root._outerRadius = outerRadius;
    root._innerRadius = innerRadius;
    root._ringSegments = ringSegments;
    root._fillMaterial = fillColor;
    root._primitiveRingBaseColor = ringColor;
    root._primitiveFillBaseColor = fillColor;
    root._clampToGround = true;
    root._baseHeight = baseHeight;
    root._groundHeightEpsilon = groundHeightEpsilon;
    root._centerCartographic = new Cesium.Cartographic(carto.longitude, carto.latitude, baseHeight);
    root._primitiveOutlinePositions = ringClosed;
    innerAny._overlayType = 'circle-primitive';
    innerAny._primitiveLayerKey = options.layerKey;
    innerAny._primitiveRingBaseColor = ringColor;
    innerAny._primitiveFillBaseColor = fillColor;
    innerAny._groundHeightEpsilon = groundHeightEpsilon;
    innerAny._primitiveOutlinePositions = ringClosed;

    const group = [this.entity, inner];
    const clickHighlight = options.clickHighlight ?? false;
    const selectionHighlight = options.selectionHighlight;
    const hoverHighlight = options.hoverHighlight ?? false;
    root._clickHighlight = clickHighlight;
    if (selectionHighlight !== undefined) {
      root._selectionHighlight = selectionHighlight;
    }
    root._hoverHighlight = hoverHighlight;
    root._highlightEntities = group;
    innerAny._clickHighlight = clickHighlight;
    if (selectionHighlight !== undefined) {
      innerAny._selectionHighlight = selectionHighlight;
    }
    innerAny._hoverHighlight = hoverHighlight;
    innerAny._highlightEntities = group;
    if (options.onClick) {
      root._onClick = options.onClick;
      innerAny._onClick = options.onClick;
    }

    this.primitiveManager.upsertGeometry(
      root,
      { outer: this.entity, inner },
      outerPositions,
      innerPositions,
      ringColor,
      fillColor,
      this.entity.show !== false,
    );
  }

  private updatePrimitiveGeometry(): void {
    if (!this.primitiveManager || !this.primitiveMode) {
      return;
    }

    const root = this.entity as any;
    const id = String(this.getId());
    const position = this.toCartesian3(this.circleOptions.position)!;
    const carto = Cesium.Cartographic.fromCartesian(position);
    const groundHeightEpsilon = Math.max(0, Number(this.circleOptions.groundHeightEpsilon ?? 0));
    const outerRadius = this.circleOptions.radius;
    const ringThickness = Math.max(0, Number(root._ringThickness ?? this.circleOptions.outlineWidth ?? 0));
    const innerRadius = Math.max(0, outerRadius - ringThickness);
    const segments = Math.max(16, Math.floor(this.circleOptions.segments ?? root._ringSegments ?? this.getDefaultSegmentsForRadius(outerRadius)));
    const baseCarto = new Cesium.Cartographic(carto.longitude, carto.latitude, groundHeightEpsilon);

    root._outerRadius = outerRadius;
    root._innerRadius = innerRadius;
    root._ringSegments = segments;
    root._centerCartographic = new Cesium.Cartographic(carto.longitude, carto.latitude, groundHeightEpsilon);
    root._baseHeight = carto.height ?? 0;
    root._groundHeightEpsilon = groundHeightEpsilon;

    const outerPositions = this.generateCirclePositions(baseCarto, outerRadius, groundHeightEpsilon, segments);
    const innerPositions = this.generateCirclePositions(baseCarto, innerRadius, groundHeightEpsilon, segments);
    const ringClosed = outerPositions.slice();
    if (ringClosed.length >= 2) {
      ringClosed.push(ringClosed[0]);
    }
    const ringColor = root._primitiveRingBaseColor ?? Cesium.Color.BLACK;
    const fillColor = root._primitiveFillBaseColor ?? (this.resolveMaterialColor(this.circleOptions.material) ?? Cesium.Color.BLUE.withAlpha(0.5));
    root._primitiveOutlinePositions = ringClosed;
    if (this.innerEntity) {
      (this.innerEntity as any)._primitiveOutlinePositions = ringClosed;
    }

    this.primitiveManager.upsertGeometry(
      root,
      { outer: this.entity, inner: this.innerEntity as Entity },
      outerPositions,
      innerPositions,
      ringColor,
      fillColor,
      this.entity.show !== false,
    );
  }

  private getPrimitiveRoot(): any {
    return this.entity as any;
  }

  private getPrimitiveBatchColorFallback(): Cesium.Color {
    return this.resolveMaterialColor(this.circleOptions.material) ?? Cesium.Color.BLUE.withAlpha(0.5);
  }

  /**
   * 创建粗边框圆形（环形）
   */
  private createThickCircle(options: CircleOptions, ringThickness: number): void {
    const position = this.toCartesian3(options.position)!;
    const carto = Cesium.Cartographic.fromCartesian(position);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const baseHeight = clampToGround ? 0 : (carto.height ?? 0);
    const heightReference = clampToGround
      ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
      : (options.heightReference ?? Cesium.HeightReference.NONE);
    const ringHeight = clampToGround ? groundHeightEpsilon : (baseHeight + 0.1);

    const outerRadius = options.radius;
    const innerRadius = Math.max(0, options.radius - ringThickness);
    const segments = Math.max(32, Math.floor(outerRadius / 10));

    // 生成外圆和内圆顶点
    const outerPositions = this.generateCirclePositions(carto, outerRadius, 0, segments);
    const innerPositions = this.generateCirclePositions(carto, innerRadius, 0, segments);

    // 创建外环（作为多边形带洞）
    this.entity.polygon = new Cesium.PolygonGraphics({
      hierarchy: new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]),
      material: new Cesium.ColorMaterialProperty(
        this.resolveColor(options.outlineColor, Cesium.Color.BLACK)
      ),
      outline: false,
      heightReference,
      ...(!clampToGround ? { height: ringHeight } : {}),
      ...(clampToGround && ringHeight > 0 ? { height: ringHeight } : {}),
    });

    // 创建内圆填充
    const surfacePosition = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
    this.innerEntity = this.viewer.entities.add({
      position: surfacePosition,
      ellipse: {
        semiMajorAxis: innerRadius,
        semiMinorAxis: innerRadius,
        material: this.resolveMaterial(options.material),
        outline: false,
        heightReference,
        ...(!clampToGround ? { height: ringHeight } : {}),
        ...(clampToGround && ringHeight > 0 ? { height: ringHeight } : {}),
        extrudedHeight: options.extrudedHeight,
      },
    });

    const root: any = this.entity as any;
    const innerAny: any = this.innerEntity as any;
    const group = [this.entity, this.innerEntity];
    root._innerEntity = this.innerEntity;
    root._isRing = true;
    root._ringThickness = ringThickness;
    root._outerRadius = outerRadius;
    root._innerRadius = innerRadius;
    root._highlightEntities = group;
    innerAny._highlightEntities = group;
    if (this.circleOptions.onClick) {
      root._onClick = this.circleOptions.onClick;
      innerAny._onClick = this.circleOptions.onClick;
    }
    if (this.circleOptions.clickHighlight) {
      root._clickHighlight = this.circleOptions.clickHighlight;
      innerAny._clickHighlight = this.circleOptions.clickHighlight;
    }
    if (this.circleOptions.selectionHighlight !== undefined) {
      root._selectionHighlight = this.circleOptions.selectionHighlight;
      innerAny._selectionHighlight = this.circleOptions.selectionHighlight;
    }
    if (this.circleOptions.hoverHighlight) {
      root._hoverHighlight = this.circleOptions.hoverHighlight;
      innerAny._hoverHighlight = this.circleOptions.hoverHighlight;
    }
  }

  /**
   * 创建 EllipseGraphics 对象
   */
  private createEllipseGraphics(options: CircleOptions): Cesium.EllipseGraphics {
    const position = this.toCartesian3(options.position)!;
    const carto = Cesium.Cartographic.fromCartesian(position);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    
    const heightReference = options.heightReference ?? (
      clampToGround
        ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
        : Cesium.HeightReference.NONE
    );

    // 使用地表位置，高度通过 height 属性表达
    const surfacePosition = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
    this.entity.position = new Cesium.ConstantPositionProperty(surfacePosition);

    return new Cesium.EllipseGraphics({
      semiMajorAxis: options.radius,
      semiMinorAxis: options.radius,
      material: this.resolveMaterial(options.material),
      outline: options.outline ?? true,
      outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor, Cesium.Color.BLACK) : undefined,
      outlineWidth: options.outlineWidth ?? 1,
      heightReference,
      height: clampToGround ? groundHeightEpsilon : (carto.height ?? 0),
      extrudedHeight: options.extrudedHeight,
    });
  }

  /**
   * 生成近似圆（多边形）顶点
   */
  private generateCirclePositions(center: Cesium.Cartographic, radiusMeters: number, heightMeters: number, segments: number): Cesium.Cartesian3[] {
    const R = 6378137.0;
    const lat1 = center.latitude;
    const lon1 = center.longitude;
    const d = radiusMeters / R;
    const positions: Cesium.Cartesian3[] = [];

    for (let i = 0; i < segments; i++) {
      const bearing = (i / segments) * Cesium.Math.TWO_PI;
      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
      const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
      positions.push(Cesium.Cartesian3.fromRadians(lon2, lat2, heightMeters));
    }
    return positions;
  }

  /**
   * 解析材质
   */
  private resolveMaterial(material?: MaterialProperty | Color | string): MaterialProperty {
    if (!material) {
      return new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.5));
    }
    if (typeof material === 'string') {
      return new Cesium.ColorMaterialProperty(this.resolveColor(material, Cesium.Color.BLUE.withAlpha(0.5)));
    }
    if (material instanceof Cesium.Color) {
      return new Cesium.ColorMaterialProperty(material);
    }
    return material;
  }

  /**
   * 解析颜色值
   */
  private resolveColor(color: Color | string | undefined, fallback: Color): Color {
    if (!color) return fallback;
    if (color instanceof Cesium.Color) return color;
    try {
      return Cesium.Color.fromCssColorString(color);
    } catch {
      return fallback;
    }
  }

  /**
   * 更新 Circle 配置
   */
  update(options: Partial<CircleOptions>): void {
    if (this.destroyed) return;
    
    this.circleOptions = { ...this.circleOptions, ...options };

    if (this.primitiveMode) {
      const root = this.getPrimitiveRoot();
      const nextRingThickness = (this.circleOptions.outlineWidth && this.circleOptions.outlineWidth > 1)
        ? this.circleOptions.outlineWidth
        : 0;

      if (options.material !== undefined) {
        const fillColor = this.resolveMaterialColor(options.material) ?? this.getPrimitiveBatchColorFallback();
        root._primitiveFillBaseColor = fillColor;
        root._fillMaterial = fillColor;
      }
      if (options.outlineColor !== undefined) {
        root._primitiveRingBaseColor = this.resolveColor(options.outlineColor, Cesium.Color.BLACK);
      }
      if (options.outlineWidth !== undefined) {
        root._ringThickness = nextRingThickness;
      }
      if (options.material !== undefined || options.outlineColor !== undefined || options.outlineWidth !== undefined) {
        const ringColor = root._primitiveRingBaseColor ?? Cesium.Color.BLACK;
        const fillColor = root._primitiveFillBaseColor ?? this.getPrimitiveBatchColorFallback();
        this.primitiveManager?.setColors(root, ringColor, fillColor);
      }
      if (options.position !== undefined || options.radius !== undefined || options.outlineWidth !== undefined) {
        this.updatePrimitiveGeometry();
      }
      if (options.show !== undefined) {
        this.entity.show = options.show;
        if (this.innerEntity) {
          this.innerEntity.show = options.show;
        }
        this.primitiveManager?.setVisible(root, options.show);
      } else {
        this.primitiveManager?.setVisible(root, this.entity.show !== false);
      }
      return;
    }
    
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    const wasThick = !!(this.entity as any)._isRing;
    const isThickNow = ringThickness && ringThickness > 1;
    
    if (wasThick !== isThickNow) {
      // 需要重建
      if (this.innerEntity) {
        this.viewer.entities.remove(this.innerEntity);
        this.innerEntity = undefined;
      }
      this.entity.polygon = undefined;
      this.entity.ellipse = undefined;
      
      if (isThickNow) {
        this.createThickCircle(options as CircleOptions, ringThickness);
      } else {
        this.entity.ellipse = this.createEllipseGraphics(options as CircleOptions);
      }
      return;
    }
    
    if (isThickNow && this.entity.polygon) {
      // 更新粗边框圆形
      if (options.position !== undefined || options.radius !== undefined) {
        this.updateGeometry();
      }
      if (options.outlineColor !== undefined) {
        this.entity.polygon.material = new Cesium.ColorMaterialProperty(
          this.resolveColor(options.outlineColor, Cesium.Color.BLACK)
        );
      }
      if (options.material !== undefined && this.innerEntity?.ellipse) {
        this.innerEntity.ellipse.material = this.resolveMaterial(options.material);
      }
    } else if (this.entity.ellipse) {
      // 更新普通圆形
      if (options.position !== undefined) {
        const position = this.toCartesian3(options.position)!;
        const carto = Cesium.Cartographic.fromCartesian(position);
        const clampToGround = this.circleOptions.clampToGround ?? true;
        const groundHeightEpsilon = clampToGround ? Math.max(0, Number(this.circleOptions.groundHeightEpsilon ?? 0)) : 0;
        const surfacePosition = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
        this.entity.position = new Cesium.ConstantPositionProperty(surfacePosition);
        this.entity.ellipse.height = new Cesium.ConstantProperty(clampToGround ? groundHeightEpsilon : (carto.height ?? 0));
      }
      if (options.radius !== undefined) {
        this.entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(options.radius);
        this.entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(options.radius);
      }
      if (options.material !== undefined) {
        this.entity.ellipse.material = this.resolveMaterial(options.material);
      }
      if (options.outline !== undefined) {
        this.entity.ellipse.outline = new Cesium.ConstantProperty(options.outline);
      }
      if (options.outlineColor !== undefined) {
        this.entity.ellipse.outlineColor = new Cesium.ConstantProperty(
          this.resolveColor(options.outlineColor, Cesium.Color.BLACK)
        );
      }
      if (options.outlineWidth !== undefined) {
        this.entity.ellipse.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      }
    }
    
    // 更新可见性
    if (options.show !== undefined) {
      this.entity.show = options.show;
      if (this.innerEntity) {
        this.innerEntity.show = options.show;
      }
    }
  }

  /**
   * 更新几何形状（位置和半径）
   */
  private updateGeometry(): void {
    const position = this.toCartesian3(this.circleOptions.position)!;
    const carto = Cesium.Cartographic.fromCartesian(position);
    const ringThickness = (this.entity as any)._ringThickness as number;
    const outerRadius = this.circleOptions.radius;
    const innerRadius = Math.max(0, outerRadius - ringThickness);
    const segments = Math.max(32, Math.floor(outerRadius / 10));
    
    const clampToGround = this.circleOptions.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(this.circleOptions.groundHeightEpsilon ?? 0)) : 0;
    const baseHeight = clampToGround ? 0 : (carto.height ?? 0);
    const ringHeight = clampToGround ? groundHeightEpsilon : (baseHeight + 0.1);
    const heightReference = clampToGround
      ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
      : (this.circleOptions.heightReference ?? Cesium.HeightReference.NONE);

    const outerPositions = this.generateCirclePositions(carto, outerRadius, 0, segments);
    const innerPositions = this.generateCirclePositions(carto, innerRadius, 0, segments);

    if (this.entity.polygon) {
      this.entity.polygon.hierarchy = new Cesium.ConstantProperty(
        new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)])
      );
      (this.entity.polygon as any).heightReference = new Cesium.ConstantProperty(heightReference);
      (this.entity.polygon as any).height = ringHeight > 0 ? new Cesium.ConstantProperty(ringHeight) : undefined;
    }

    if (this.innerEntity?.ellipse) {
      const surfacePosition = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
      this.innerEntity.position = new Cesium.ConstantPositionProperty(surfacePosition);
      this.innerEntity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(innerRadius);
      this.innerEntity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(innerRadius);
      (this.innerEntity.ellipse as any).heightReference = new Cesium.ConstantProperty(heightReference);
      (this.innerEntity.ellipse as any).height = ringHeight > 0 ? new Cesium.ConstantProperty(ringHeight) : undefined;
    }

    (this.entity as any)._outerRadius = outerRadius;
    (this.entity as any)._innerRadius = innerRadius;
  }

  /**
   * 更新位置
   */
  setPosition(position: OverlayPosition): void {
    if (this.destroyed) return;
    this.update({ position });
  }

  /**
   * 更新半径
   */
  setRadius(radius: number): void {
    if (this.destroyed) return;
    this.update({ radius });
  }

  /**
   * 获取位置（经纬度）
   */
  getPosition(): [number, number] | null {
    if (this.primitiveMode) {
      const pos = this.circleOptions.position;
      const cartesian = this.toCartesian3(pos);
      if (cartesian) {
        return this.toLngLat(cartesian);
      }
      return null;
    }
    const pos = this.entity.position?.getValue(Cesium.JulianDate.now());
    if (pos) {
      return this.toLngLat(pos);
    }
    return null;
  }

  /**
   * 获取半径
   */
  getRadius(): number {
    return this.circleOptions.radius;
  }

  setPrimitiveVisible(entity: Entity, visible: boolean): void {
    if (!this.primitiveMode || !this.primitiveManager) return;
    this.primitiveManager.setVisible(entity as any, visible);
  }

  applyPrimitiveHighlight(entity: Entity, hlColor: Cesium.Color, _fillAlpha: number): void {
    if (!this.primitiveMode || !this.primitiveManager) return;
    const root = this.getPrimitiveRoot();
    const ringColor = hlColor.withAlpha(1.0);
    const fillColor = root._primitiveFillBaseColor ?? this.getPrimitiveBatchColorFallback();
    this.primitiveManager.setColors(root, ringColor, fillColor);
    (entity as any)._isHighlighted = true;
  }

  restorePrimitiveHighlight(entity: Entity): void {
    if (!this.primitiveMode || !this.primitiveManager) return;
    const root = this.getPrimitiveRoot();
    const ringColor = root._primitiveRingBaseColor ?? Cesium.Color.BLACK;
    const fillColor = root._primitiveFillBaseColor ?? this.getPrimitiveBatchColorFallback();
    this.primitiveManager.setColors(root, ringColor, fillColor);
    (entity as any)._isHighlighted = false;
  }

  setVisible(show: boolean): void {
    if (this.destroyed) return;
    if (this.primitiveMode) {
      this.entity.show = show;
      if (this.innerEntity) {
        this.innerEntity.show = show;
      }
      if (this.primitiveManager) {
        this.primitiveManager.setVisible(this.getPrimitiveRoot(), show);
      }
      return;
    }

    super.setVisible(show);
  }

  /**
   * 从场景中移除圆形
   */
  remove(): void {
    if (this.destroyed) return;

    if (this.primitiveMode) {
      try {
        this.primitiveManager?.remove(this.getPrimitiveRoot());
      } catch {
        // ignore
      }

      this.innerEntity = undefined;
      this.destroyed = true;
      return;
    }
    
    // 移除内层实体
    if (this.innerEntity) {
      this.viewer.entities.remove(this.innerEntity);
      this.innerEntity = undefined;
    }
    
    // 调用父类方法移除 Entity
    super.remove();
  }
}
