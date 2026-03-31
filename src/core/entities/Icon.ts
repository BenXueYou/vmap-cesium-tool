import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, HeightReference, VerticalOrigin, HorizontalOrigin } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * Icon 配置选项
 */
export interface IconOptions extends BaseOverlayOptions {
  /** 图片 URL 或 base64 */
  image: string;
  /** 宽度（像素） */
  width?: number;
  /** 高度（像素） */
  height?: number;
  /** 缩放比例（默认 1.0） */
  scale?: number;
  /** 旋转角度（弧度） */
  rotation?: number;
  /** 像素偏移 */
  pixelOffset?: Cesium.Cartesian2;
  /** 视线偏移 */
  eyeOffset?: Cesium.Cartesian3;
  /** 水平原点（默认 CENTER） */
  horizontalOrigin?: HorizontalOrigin;
  /** 垂直原点（默认 BOTTOM） */
  verticalOrigin?: VerticalOrigin;
  /** 高度参考（默认 NONE） */
  heightReference?: HeightReference;
  /** 禁用深度测试距离 */
  disableDepthTestDistance?: number;
  /** 颜色（可用于着色） */
  color?: Color | string;
}

/**
 * Icon 图标类
 * 
 * 用于在地图上创建图标标记，使用 Billboard 实现。
 * 支持自定义图片、大小、旋转、颜色等样式。
 * 
 * @example
 * ```typescript
 * const icon = new Icon(viewer, {
 *   position: [120.1, 30.2],
 *   image: '/images/marker.png',
 *   width: 32,
 *   height: 32,
 *   onClick: (entity) => console.log('Icon clicked')
 * });
 * viewer.entities.add(icon.getEntity());
 * ```
 */
export class Icon extends BaseOverlay {
  private iconOptions: IconOptions;

  constructor(viewer: Viewer, options: IconOptions) {
    super(viewer, options);
    this.iconOptions = options;
    
    // 设置图标属性
    this.entity.billboard = this.createBillboardGraphics(options);
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'icon';
  }

  /**
   * 创建 BillboardGraphics 对象
   */
  private createBillboardGraphics(options: IconOptions): Cesium.BillboardGraphics {
    return new Cesium.BillboardGraphics({
      image: options.image,
      width: options.width,
      height: options.height,
      scale: options.scale ?? 1.0,
      rotation: options.rotation,
      pixelOffset: options.pixelOffset,
      eyeOffset: options.eyeOffset,
      horizontalOrigin: options.horizontalOrigin ?? Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: options.verticalOrigin ?? Cesium.VerticalOrigin.BOTTOM,
      heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
      disableDepthTestDistance: options.disableDepthTestDistance ?? Number.POSITIVE_INFINITY,
      color: options.color ? this.resolveColor(options.color) : undefined,
    });
  }

  /**
   * 解析颜色值
   */
  private resolveColor(color: Color | string | undefined, fallback?: Color): Color | undefined {
    if (!color) return fallback;
    if (color instanceof Cesium.Color) return color;
    try {
      return Cesium.Color.fromCssColorString(color);
    } catch {
      return fallback;
    }
  }

  /**
   * 更新 Icon 配置
   */
  update(options: Partial<IconOptions>): void {
    if (this.destroyed) return;
    
    this.iconOptions = { ...this.iconOptions, ...options };
    
    if (!this.entity.billboard) {
      this.entity.billboard = this.createBillboardGraphics(options as IconOptions);
      return;
    }
    
    // 更新图片
    if (options.image !== undefined) {
      this.entity.billboard.image = new Cesium.ConstantProperty(options.image);
    }
    
    // 更新样式
    if (options.width !== undefined) {
      this.entity.billboard.width = new Cesium.ConstantProperty(options.width);
    }
    if (options.height !== undefined) {
      this.entity.billboard.height = new Cesium.ConstantProperty(options.height);
    }
    if (options.scale !== undefined) {
      this.entity.billboard.scale = new Cesium.ConstantProperty(options.scale);
    }
    if (options.rotation !== undefined) {
      this.entity.billboard.rotation = new Cesium.ConstantProperty(options.rotation);
    }
    if (options.color !== undefined) {
      this.entity.billboard.color = new Cesium.ConstantProperty(this.resolveColor(options.color));
    }
    if (options.pixelOffset !== undefined) {
      this.entity.billboard.pixelOffset = new Cesium.ConstantProperty(options.pixelOffset);
    }
    if (options.eyeOffset !== undefined) {
      this.entity.billboard.eyeOffset = new Cesium.ConstantProperty(options.eyeOffset);
    }
    if (options.horizontalOrigin !== undefined) {
      this.entity.billboard.horizontalOrigin = new Cesium.ConstantProperty(options.horizontalOrigin);
    }
    if (options.verticalOrigin !== undefined) {
      this.entity.billboard.verticalOrigin = new Cesium.ConstantProperty(options.verticalOrigin);
    }
    if (options.heightReference !== undefined) {
      this.entity.billboard.heightReference = new Cesium.ConstantProperty(options.heightReference);
    }
    if (options.disableDepthTestDistance !== undefined) {
      this.entity.billboard.disableDepthTestDistance = new Cesium.ConstantProperty(options.disableDepthTestDistance);
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
   * 更新图片
   */
  setImage(image: string): void {
    if (this.destroyed) return;
    if (this.entity.billboard) {
      this.entity.billboard.image = new Cesium.ConstantProperty(image);
    }
  }

  /**
   * 获取图片 URL
   */
  getImage(): string {
    const img = this.entity.billboard?.image?.getValue(Cesium.JulianDate.now());
    return img?.toString() || '';
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
   * 获取图标样式
   */
  getStyle(): Partial<IconOptions> {
    const billboard = this.entity.billboard;
    if (!billboard) return {};
    
    const now = Cesium.JulianDate.now();
    return {
      image: billboard.image?.getValue(now)?.toString() || '',
      width: billboard.width?.getValue(now),
      height: billboard.height?.getValue(now),
      scale: billboard.scale?.getValue(now),
      rotation: billboard.rotation?.getValue(now),
      color: billboard.color?.getValue(now),
    };
  }
}