import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * Marker 配置选项
 */
export interface MarkerOptions extends BaseOverlayOptions {
  /** 点像素大小（默认 10） */
  pixelSize?: number;
  /** 填充颜色（默认红色） */
  color?: Color | string;
  /** 描边颜色（默认白色） */
  outlineColor?: Color | string;
  /** 描边宽度（默认 2） */
  outlineWidth?: number;
  /** 高度参考（默认 NONE） */
  heightReference?: HeightReference;
  /** 根据距离缩放 */
  scaleByDistance?: Cesium.NearFarScalar;
  /** 禁用深度测试距离 */
  disableDepthTestDistance?: number;
}

/**
 * Marker 点标记类
 * 
 * 用于在地图上创建一个点标记，支持自定义颜色、大小、描边等样式。
 * 
 * @example
 * ```typescript
 * const marker = new Marker(viewer, {
 *   position: [120.1, 30.2],
 *   pixelSize: 12,
 *   color: '#FF0000',
 *   onClick: (entity) => console.log('Marker clicked')
 * });
 * viewer.entities.add(marker.getEntity());
 * ```
 */
export class Marker extends BaseOverlay {
  private markerOptions: MarkerOptions;

  constructor(viewer: Viewer, options: MarkerOptions) {
    super(viewer, options);
    this.markerOptions = options;
    
    // 设置点标记属性
    this.entity.point = this.createPointGraphics(options);
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'marker';
  }

  /**
   * 创建 PointGraphics 对象
   */
  private createPointGraphics(options: MarkerOptions): Cesium.PointGraphics {
    return new Cesium.PointGraphics({
      pixelSize: options.pixelSize ?? 10,
      color: this.resolveColor(options.color, Cesium.Color.RED),
      outlineColor: this.resolveColor(options.outlineColor, Cesium.Color.WHITE),
      outlineWidth: options.outlineWidth ?? 2,
      heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
      scaleByDistance: options.scaleByDistance,
      disableDepthTestDistance: options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY,
    });
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
   * 更新 Marker 配置
   */
  update(options: Partial<MarkerOptions>): void {
    if (this.destroyed) return;
    
    this.markerOptions = { ...this.markerOptions, ...options };
    
    if (!this.entity.point) {
      this.entity.point = this.createPointGraphics(options);
      return;
    }
    
    // 更新点属性
    if (options.pixelSize !== undefined) {
      this.entity.point.pixelSize = new Cesium.ConstantProperty(options.pixelSize);
    }
    if (options.color !== undefined) {
      this.entity.point.color = new Cesium.ConstantProperty(this.resolveColor(options.color, Cesium.Color.RED));
    }
    if (options.outlineColor !== undefined) {
      this.entity.point.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor, Cesium.Color.WHITE));
    }
    if (options.outlineWidth !== undefined) {
      this.entity.point.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
    }
    if (options.heightReference !== undefined) {
      this.entity.point.heightReference = new Cesium.ConstantProperty(options.heightReference);
    }
    if (options.scaleByDistance !== undefined) {
      this.entity.point.scaleByDistance = new Cesium.ConstantProperty(options.scaleByDistance);
    }
    if (options.disableDepthTestDistance !== undefined) {
      this.entity.point.disableDepthTestDistance = new Cesium.ConstantProperty(options.disableDepthTestDistance);
    }
    
    // 更新位置
    if (options.position !== undefined) {
      const position = this.toCartesian3(options.position);
      if (position) {
        this.entity.position = new Cesium.ConstantPositionProperty(position);
      }
    }
    
    // 更新可见性
    if (options.show !== undefined) {
      this.entity.show = options.show;
    }
  }

  /**
   * 更新位置
   */
  setPosition(position: OverlayPosition): void {
    if (this.destroyed) return;
    const cartesian = this.toCartesian3(position);
    if (cartesian) {
      this.entity.position = new Cesium.ConstantPositionProperty(cartesian);
    }
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
   * 获取点样式
   */
  getStyle(): Partial<MarkerOptions> {
    const point = this.entity.point;
    if (!point) return {};
    
    const now = Cesium.JulianDate.now();
    return {
      pixelSize: point.pixelSize?.getValue(now),
      color: point.color?.getValue(now),
      outlineColor: point.outlineColor?.getValue(now),
      outlineWidth: point.outlineWidth?.getValue(now),
      heightReference: point.heightReference?.getValue(now),
      scaleByDistance: point.scaleByDistance?.getValue(now),
      disableDepthTestDistance: point.disableDepthTestDistance?.getValue(now),
    };
  }
}