import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, MaterialProperty } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * Polyline 配置选项
 */
export interface PolylineOptions extends BaseOverlayOptions {
  /** 位置数组（至少 2 个点） */
  positions: OverlayPosition[];
  /** 线宽（默认 2） */
  width?: number;
  /** 材质（颜色、字符串或 MaterialProperty） */
  material?: MaterialProperty | Color | string;
  /** 是否贴地（默认 false） */
  clampToGround?: boolean;
  /** 贴地抬高量（米，clampToGround=true 时生效） */
  groundHeightEpsilon?: number;
}

/**
 * Polyline 折线类
 * 
 * 用于在地图上创建折线，支持自定义宽度、材质和贴地属性。
 * 
 * @example
 * ```typescript
 * const polyline = new Polyline(viewer, {
 *   positions: [
 *     [120.1, 30.2],
 *     [120.2, 30.3],
 *     [120.3, 30.4]
 *   ],
 *   width: 4,
 *   material: '#FF0000'
 * });
 * viewer.entities.add(polyline.getEntity());
 * ```
 */
export class Polyline extends BaseOverlay {
  private polylineOptions: PolylineOptions;

  constructor(viewer: Viewer, options: PolylineOptions) {
    super(viewer, options);
    this.polylineOptions = options;
    
    // 设置折线属性
    this.entity.polyline = this.createPolylineGraphics(options);
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'polyline';
  }

  /**
   * 创建 PolylineGraphics 对象
   */
  private createPolylineGraphics(options: PolylineOptions): Cesium.PolylineGraphics {
    const positions = options.positions.map(pos => this.toCartesian3(pos)!);
    
    return new Cesium.PolylineGraphics({
      positions,
      width: options.width ?? 2,
      material: this.resolveMaterial(options.material),
      clampToGround: options.clampToGround ?? false,
    });
  }

  /**
   * 解析材质
   */
  private resolveMaterial(material?: MaterialProperty | Color | string): MaterialProperty {
    if (!material) {
      return new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW);
    }
    if (typeof material === 'string') {
      return new Cesium.ColorMaterialProperty(this.resolveColor(material, Cesium.Color.WHITE));
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
   * 抬高位置点
   */
  private elevatePositions(positions: Cesium.Cartesian3[], heightMeters: number): Cesium.Cartesian3[] {
    return positions.map((p) => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, heightMeters);
    });
  }

  /**
   * 更新 Polyline 配置
   */
  update(options: Partial<PolylineOptions>): void {
    if (this.destroyed) return;
    
    this.polylineOptions = { ...this.polylineOptions, ...options };
    
    if (!this.entity.polyline) {
      this.entity.polyline = this.createPolylineGraphics(options as PolylineOptions);
      return;
    }
    
    // 更新位置
    if (options.positions !== undefined) {
      const positions = options.positions.map(pos => this.toCartesian3(pos)!);
      const clampToGround = options.clampToGround ?? this.polylineOptions.clampToGround ?? false;
      const groundHeightEpsilon = options.groundHeightEpsilon ?? this.polylineOptions.groundHeightEpsilon ?? 0;
      
      const finalPositions = (clampToGround && groundHeightEpsilon > 0)
        ? this.elevatePositions(positions, groundHeightEpsilon)
        : positions;
      
      this.entity.polyline.positions = new Cesium.ConstantProperty(finalPositions);
    }
    
    // 更新样式
    if (options.width !== undefined) {
      this.entity.polyline.width = new Cesium.ConstantProperty(options.width);
    }
    if (options.material !== undefined) {
      this.entity.polyline.material = this.resolveMaterial(options.material);
    }
    if (options.clampToGround !== undefined) {
      this.entity.polyline.clampToGround = new Cesium.ConstantProperty(options.clampToGround);
    }
    
    // 更新可见性
    if (options.show !== undefined) {
      this.entity.show = options.show;
    }
  }

  /**
   * 更新位置
   */
  setPositions(positions: OverlayPosition[]): void {
    if (this.destroyed) return;
    
    const cartesianPositions = positions.map(pos => this.toCartesian3(pos)!);
    const clampToGround = this.polylineOptions.clampToGround ?? false;
    const groundHeightEpsilon = this.polylineOptions.groundHeightEpsilon ?? 0;
    
    const finalPositions = (clampToGround && groundHeightEpsilon > 0)
      ? this.elevatePositions(cartesianPositions, groundHeightEpsilon)
      : cartesianPositions;
    
    if (this.entity.polyline) {
      this.entity.polyline.positions = new Cesium.ConstantProperty(finalPositions);
    }
  }

  /**
   * 获取位置数组（经纬度）
   */
  getPositions(): [number, number][] {
    const positions = this.entity.polyline?.positions?.getValue(Cesium.JulianDate.now());
    if (Array.isArray(positions)) {
      return positions.map(pos => this.toLngLat(pos));
    }
    return [];
  }

  /**
   * 获取折线样式
   */
  getStyle(): Partial<PolylineOptions> {
    const polyline = this.entity.polyline;
    if (!polyline) return {};
    
    const now = Cesium.JulianDate.now();
    return {
      width: polyline.width?.getValue(now),
      material: polyline.material?.getValue(now),
      clampToGround: polyline.clampToGround?.getValue(now),
    };
  }
}