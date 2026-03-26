import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, MaterialProperty, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

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
  private circleOptions: CircleOptions;
  private innerEntity?: Entity;

  constructor(viewer: Viewer, options: CircleOptions) {
    super(viewer, options);
    this.circleOptions = options;
    
    // 检查是否需要创建粗边框（环形）效果
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    
    if (ringThickness && ringThickness > 1) {
      // 创建粗边框圆形（使用双层椭圆方式）
      this.createThickCircle(options, ringThickness);
    } else {
      // 普通圆形
      this.entity.ellipse = this.createEllipseGraphics(options);
    }
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'circle';
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

    (this.entity as any)._innerEntity = this.innerEntity;
    (this.entity as any)._isRing = true;
    (this.entity as any)._ringThickness = ringThickness;
    (this.entity as any)._outerRadius = outerRadius;
    (this.entity as any)._innerRadius = innerRadius;
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

  /**
   * 从场景中移除圆形
   */
  remove(): void {
    if (this.destroyed) return;
    
    // 移除内层实体
    if (this.innerEntity) {
      this.viewer.entities.remove(this.innerEntity);
      this.innerEntity = undefined;
    }
    
    // 调用父类方法移除 Entity
    super.remove();
  }
}