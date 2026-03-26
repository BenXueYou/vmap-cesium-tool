import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, MaterialProperty, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * Rectangle 配置选项
 */
export interface RectangleOptions extends BaseOverlayOptions {
  /** 矩形坐标范围 */
  coordinates: Cesium.Rectangle;
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
  /** 基准高度（米，clampToGround=false 时有效） */
  height?: number;
  /** 高度参考 */
  heightReference?: HeightReference;
  /** 拉伸高度 */
  extrudedHeight?: number;
  /** 兼容旧版渲染模式配置 */
  renderMode?: 'auto' | 'entity' | 'primitive';
}

/**
 * Rectangle 矩形类
 * 
 * 用于在地图上创建矩形区域，支持自定义填充、边框和贴地属性。
 * 
 * @example
 * ```typescript
 * const rectangle = new Rectangle(viewer, {
 *   coordinates: Cesium.Rectangle.fromDegrees(120, 30, 121, 31),
 *   material: 'rgba(0, 255, 0, 0.3)',
 *   outline: true,
 *   outlineColor: '#00FF00'
 * });
 * viewer.entities.add(rectangle.getEntity());
 * ```
 */
export class Rectangle extends BaseOverlay {
  private rectangleOptions: RectangleOptions;
  private innerEntity?: Entity;

  constructor(viewer: Viewer, options: RectangleOptions) {
    super(viewer, options);
    this.rectangleOptions = options;
    
    // 检查是否需要创建粗边框（环形）效果
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    
    if (ringThickness && ringThickness > 1) {
      // 创建粗边框矩形（使用 polygon + hole 方式）
      this.createThickRectangle(options, ringThickness);
    } else {
      // 普通矩形
      this.entity.rectangle = this.createRectangleGraphics(options);
    }
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'rectangle';
  }

  /**
   * 创建粗边框矩形（环形）
   */
  private createThickRectangle(options: RectangleOptions, ringThickness: number): void {
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const baseHeight = clampToGround ? 0 : (options.height ?? 0);
    const heightReference = clampToGround
      ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
      : (options.heightReference ?? Cesium.HeightReference.NONE);
    const ringHeight = clampToGround ? groundHeightEpsilon : (baseHeight + 0.1);

    // 计算外框和内框顶点
    const outerPositions = this.rectangleToPositions(options.coordinates, 0);
    const innerRect = this.shrinkRectangle(options.coordinates, ringThickness);
    const innerPositions = this.rectangleToPositions(innerRect, 0);

    // 创建外框（作为多边形带洞）
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

    // 创建内框填充
    this.innerEntity = this.viewer.entities.add({
      rectangle: {
        coordinates: innerRect,
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
    (this.entity as any)._outerRectangle = options.coordinates;
  }

  /**
   * 创建 RectangleGraphics 对象
   */
  private createRectangleGraphics(options: RectangleOptions): Cesium.RectangleGraphics {
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    
    const heightReference = options.heightReference ?? (
      clampToGround
        ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
        : Cesium.HeightReference.NONE
    );

    return new Cesium.RectangleGraphics({
      coordinates: options.coordinates,
      material: this.resolveMaterial(options.material),
      outline: options.outline ?? true,
      outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor, Cesium.Color.BLACK) : undefined,
      outlineWidth: options.outlineWidth ?? 1,
      heightReference,
      ...(!clampToGround && options.height !== undefined ? { height: options.height } : {}),
      ...(clampToGround && groundHeightEpsilon > 0 ? { height: groundHeightEpsilon } : {}),
      extrudedHeight: options.extrudedHeight,
    });
  }

  /**
   * 将 Rectangle 转为四点多边形顶点
   */
  private rectangleToPositions(rect: Cesium.Rectangle, heightMeters: number): Cesium.Cartesian3[] {
    const w = rect.west;
    const s = rect.south;
    const e = rect.east;
    const n = rect.north;
    return [
      Cesium.Cartesian3.fromRadians(w, s, heightMeters),
      Cesium.Cartesian3.fromRadians(e, s, heightMeters),
      Cesium.Cartesian3.fromRadians(e, n, heightMeters),
      Cesium.Cartesian3.fromRadians(w, n, heightMeters),
    ];
  }

  /**
   * 按米单位向内收缩矩形边界
   */
  private shrinkRectangle(rect: Cesium.Rectangle, thicknessMeters: number): Cesium.Rectangle {
    const R = 6378137.0;
    const centerLat = (rect.north + rect.south) / 2;
    const deltaLat = thicknessMeters / R;
    const deltaLon = thicknessMeters / (R * Math.cos(centerLat));
    const maxDeltaLon = (rect.east - rect.west) / 2 * 0.999;
    const maxDeltaLat = (rect.north - rect.south) / 2 * 0.999;
    const dLon = Math.min(deltaLon, maxDeltaLon);
    const dLat = Math.min(deltaLat, maxDeltaLat);
    return new Cesium.Rectangle(rect.west + dLon, rect.south + dLat, rect.east - dLon, rect.north - dLat);
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
   * 更新 Rectangle 配置
   */
  update(options: Partial<RectangleOptions>): void {
    if (this.destroyed) return;
    
    this.rectangleOptions = { ...this.rectangleOptions, ...options };
    
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;
    
    // 如果从普通矩形变为粗边框矩形，或反之，需要重建
    const wasThick = !!(this.entity as any)._isRing;
    const isThickNow = ringThickness && ringThickness > 1;
    
    if (wasThick !== isThickNow) {
      // 需要重建，先清理旧实体
      if (this.innerEntity) {
        this.viewer.entities.remove(this.innerEntity);
        this.innerEntity = undefined;
      }
      this.entity.polygon = undefined;
      this.entity.rectangle = undefined;
      
      // 重新创建
      if (isThickNow) {
        this.createThickRectangle(options as RectangleOptions, ringThickness);
      } else {
        this.entity.rectangle = this.createRectangleGraphics(options as RectangleOptions);
      }
      return;
    }
    
    if (isThickNow) {
      // 更新粗边框矩形
      if (options.coordinates !== undefined) {
        this.updateCoordinates(options.coordinates);
      }
      if (options.material !== undefined && this.innerEntity?.rectangle) {
        this.innerEntity.rectangle.material = this.resolveMaterial(options.material);
      }
      if (options.outlineColor !== undefined && this.entity.polygon) {
        this.entity.polygon.material = new Cesium.ColorMaterialProperty(
          this.resolveColor(options.outlineColor, Cesium.Color.BLACK)
        );
      }
    } else if (this.entity.rectangle) {
      // 更新普通矩形
      if (options.coordinates !== undefined) {
        this.entity.rectangle.coordinates = new Cesium.ConstantProperty(options.coordinates);
      }
      if (options.material !== undefined) {
        this.entity.rectangle.material = this.resolveMaterial(options.material);
      }
      if (options.outline !== undefined) {
        this.entity.rectangle.outline = new Cesium.ConstantProperty(options.outline);
      }
      if (options.outlineColor !== undefined) {
        this.entity.rectangle.outlineColor = new Cesium.ConstantProperty(
          this.resolveColor(options.outlineColor, Cesium.Color.BLACK)
        );
      }
      if (options.outlineWidth !== undefined) {
        this.entity.rectangle.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      }
      if (options.extrudedHeight !== undefined) {
        this.entity.rectangle.extrudedHeight = new Cesium.ConstantProperty(options.extrudedHeight);
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
   * 更新坐标
   */
  setCoordinates(coordinates: Cesium.Rectangle): void {
    if (this.destroyed) return;
    this.updateCoordinates(coordinates);
  }

  /**
   * 更新坐标（内部方法）
   */
  private updateCoordinates(coordinates: Cesium.Rectangle): void {
    const ringThickness = (this.entity as any)._ringThickness as number | undefined;
    
    if (ringThickness && this.entity.polygon && this.innerEntity) {
      const clampToGround = this.rectangleOptions.clampToGround ?? true;
      const groundHeightEpsilon = clampToGround ? Math.max(0, Number(this.rectangleOptions.groundHeightEpsilon ?? 0)) : 0;
      const baseHeight = clampToGround ? 0 : (this.rectangleOptions.height ?? 0);
      const ringHeight = clampToGround ? groundHeightEpsilon : (baseHeight + 0.1);
      const heightReference = clampToGround
        ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
        : (this.rectangleOptions.heightReference ?? Cesium.HeightReference.NONE);

      const outerPositions = this.rectangleToPositions(coordinates, 0);
      const innerRect = this.shrinkRectangle(coordinates, ringThickness);
      const innerPositions = this.rectangleToPositions(innerRect, 0);

      this.entity.polygon.hierarchy = new Cesium.ConstantProperty(
        new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)])
      );
      
      if (this.innerEntity.rectangle) {
        this.innerEntity.rectangle.coordinates = new Cesium.ConstantProperty(innerRect);
        (this.innerEntity.rectangle as any).heightReference = new Cesium.ConstantProperty(heightReference);
        (this.innerEntity.rectangle as any).height = ringHeight > 0 ? new Cesium.ConstantProperty(ringHeight) : undefined;
      }
      
      (this.entity.polygon as any).heightReference = new Cesium.ConstantProperty(heightReference);
      (this.entity.polygon as any).height = ringHeight > 0 ? new Cesium.ConstantProperty(ringHeight) : undefined;
      
      (this.entity as any)._outerRectangle = coordinates;
    } else if (this.entity.rectangle) {
      this.entity.rectangle.coordinates = new Cesium.ConstantProperty(coordinates);
    }
  }

  /**
   * 获取矩形坐标
   */
  getCoordinates(): Cesium.Rectangle | null {
    if (this.entity.rectangle) {
      return this.entity.rectangle.coordinates?.getValue(Cesium.JulianDate.now()) || null;
    }
    return (this.entity as any)._outerRectangle || null;
  }

  /**
   * 获取矩形样式
   */
  getStyle(): Partial<RectangleOptions> {
    const rectangle = this.entity.rectangle;
    if (!rectangle) return {};
    
    const now = Cesium.JulianDate.now();
    return {
      material: rectangle.material?.getValue(now),
      outline: rectangle.outline?.getValue(now),
      outlineColor: rectangle.outlineColor?.getValue(now),
      outlineWidth: rectangle.outlineWidth?.getValue(now),
      extrudedHeight: rectangle.extrudedHeight?.getValue(now),
    };
  }

  /**
   * 从场景中移除矩形
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