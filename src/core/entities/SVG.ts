import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, HeightReference, VerticalOrigin, HorizontalOrigin } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * SVG 配置选项
 */
export interface SvgOptions extends BaseOverlayOptions {
  /** SVG 字符串 */
  svg: string;
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
 * SVG 图标类
 * 
 * 用于在地图上创建 SVG 图标标记，使用 Billboard 实现。
 * 支持自定义 SVG 内容、大小、旋转、颜色等样式。
 * 
 * @example
 * ```typescript
 * const svg = new SVG(viewer, {
 *   position: [120.1, 30.2],
 *   svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="red"/></svg>',
 *   width: 32,
 *   height: 32
 * });
 * viewer.entities.add(svg.getEntity());
 * ```
 */
export class SVG extends BaseOverlay {
  private svgOptions: SvgOptions;

  constructor(viewer: Viewer, options: SvgOptions) {
    super(viewer, options);
    this.svgOptions = options;
    
    // 设置图标属性
    this.entity.billboard = this.createBillboardGraphics(options);
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'svg';
  }

  /**
   * 将 SVG 字符串转换为 data URL
   */
  private svgToDataUrl(svg: string): string {
    // 处理浏览器环境差异
    if (typeof btoa !== 'undefined') {
      // 浏览器环境
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    } else {
      // 降级处理
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
  }

  /**
   * 创建 BillboardGraphics 对象
   */
  private createBillboardGraphics(options: SvgOptions): Cesium.BillboardGraphics {
    const svgDataUrl = this.svgToDataUrl(options.svg);
    
    return new Cesium.BillboardGraphics({
      image: svgDataUrl,
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
   * 更新 SVG 配置
   */
  update(options: Partial<SvgOptions>): void {
    if (this.destroyed) return;
    
    this.svgOptions = { ...this.svgOptions, ...options };
    
    if (!this.entity.billboard) {
      this.entity.billboard = this.createBillboardGraphics(options as SvgOptions);
      return;
    }
    
    // 更新 SVG 内容
    if (options.svg !== undefined) {
      const svgDataUrl = this.svgToDataUrl(options.svg);
      this.entity.billboard.image = new Cesium.ConstantProperty(svgDataUrl);
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
   * 更新 SVG 内容
   */
  setSvg(svg: string): void {
    if (this.destroyed) return;
    if (this.entity.billboard) {
      const svgDataUrl = this.svgToDataUrl(svg);
      this.entity.billboard.image = new Cesium.ConstantProperty(svgDataUrl);
    }
  }

  /**
   * 获取 SVG 字符串
   */
  getSvg(): string {
    return this.svgOptions.svg || '';
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
   * 获取 SVG 样式
   */
  getStyle(): Partial<SvgOptions> {
    const billboard = this.entity.billboard;
    if (!billboard) return {};
    
    const now = Cesium.JulianDate.now();
    return {
      svg: this.svgOptions.svg,
      width: billboard.width?.getValue(now),
      height: billboard.height?.getValue(now),
      scale: billboard.scale?.getValue(now),
      rotation: billboard.rotation?.getValue(now),
      color: billboard.color?.getValue(now),
    };
  }
}