import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, HeightReference, LabelStyle, VerticalOrigin, HorizontalOrigin } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * Label 配置选项
 */
export interface LabelOptions extends BaseOverlayOptions {
  /** 文本内容 */
  text: string;
  /** 字体（默认 '14px sans-serif'） */
  font?: string;
  /** 填充颜色（默认白色） */
  fillColor?: Color | string;
  /** 描边颜色（默认黑色） */
  outlineColor?: Color | string;
  /** 描边宽度（默认 2） */
  outlineWidth?: number;
  /** 标签样式（默认 FILL_AND_OUTLINE） */
  style?: LabelStyle;
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
  /** 缩放比例（默认 1.0） */
  scale?: number;
  /** 显示背景（默认 false） */
  showBackground?: boolean;
  /** 背景颜色 */
  backgroundColor?: Color | string;
  /** 背景内边距 */
  backgroundPadding?: Cesium.Cartesian2;
  /** 禁用深度测试距离 */
  disableDepthTestDistance?: number;
}

/**
 * Label 文本标签类
 * 
 * 用于在地图上创建文本标签，支持自定义字体、颜色、背景等样式。
 * 
 * @example
 * ```typescript
 * const label = new Label(viewer, {
 *   position: [120.1, 30.2],
 *   text: '杭州市',
 *   font: 'bold 16px sans-serif',
 *   fillColor: '#FFFFFF'
 * });
 * viewer.entities.add(label.getEntity());
 * ```
 */
export class Label extends BaseOverlay {
  private labelOptions: LabelOptions;

  constructor(viewer: Viewer, options: LabelOptions) {
    super(viewer, options);
    this.labelOptions = options;
    
    // 设置标签属性
    this.entity.label = this.createLabelGraphics(options);
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'label';
  }

  /**
   * 创建 LabelGraphics 对象
   */
  private createLabelGraphics(options: LabelOptions): Cesium.LabelGraphics {
    return new Cesium.LabelGraphics({
      text: options.text,
      font: options.font ?? '14px sans-serif',
      fillColor: this.resolveColor(options.fillColor, Cesium.Color.WHITE),
      outlineColor: this.resolveColor(options.outlineColor, Cesium.Color.BLACK),
      outlineWidth: options.outlineWidth ?? 2,
      style: options.style ?? Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: options.pixelOffset,
      eyeOffset: options.eyeOffset,
      horizontalOrigin: options.horizontalOrigin ?? Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: options.verticalOrigin ?? Cesium.VerticalOrigin.BOTTOM,
      heightReference: options.heightReference ?? Cesium.HeightReference.NONE,
      scale: options.scale ?? 1.0,
      showBackground: options.showBackground ?? false,
      backgroundColor: options.backgroundColor ? this.resolveColor(options.backgroundColor, Cesium.Color.BLACK) : undefined,
      backgroundPadding: options.backgroundPadding,
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
   * 更新 Label 配置
   */
  update(options: Partial<LabelOptions>): void {
    if (this.destroyed) return;
    
    this.labelOptions = { ...this.labelOptions, ...options };
    
    if (!this.entity.label) {
      // 创建新的 label 时需要 text 属性，从当前 options 或已有配置中获取
      const newOptions = { ...this.labelOptions, ...options };
      this.entity.label = this.createLabelGraphics(newOptions as LabelOptions);
      return;
    }
    
    // 更新文本
    if (options.text !== undefined) {
      this.entity.label.text = new Cesium.ConstantProperty(options.text);
    }
    
    // 更新样式
    if (options.font !== undefined) {
      this.entity.label.font = new Cesium.ConstantProperty(options.font);
    }
    if (options.fillColor !== undefined) {
      this.entity.label.fillColor = new Cesium.ConstantProperty(this.resolveColor(options.fillColor, Cesium.Color.WHITE));
    }
    if (options.outlineColor !== undefined) {
      this.entity.label.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor, Cesium.Color.BLACK));
    }
    if (options.outlineWidth !== undefined) {
      this.entity.label.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
    }
    if (options.style !== undefined) {
      this.entity.label.style = new Cesium.ConstantProperty(options.style);
    }
    if (options.scale !== undefined) {
      this.entity.label.scale = new Cesium.ConstantProperty(options.scale);
    }
    if (options.showBackground !== undefined) {
      this.entity.label.showBackground = new Cesium.ConstantProperty(options.showBackground);
    }
    if (options.backgroundColor !== undefined) {
      this.entity.label.backgroundColor = new Cesium.ConstantProperty(
        this.resolveColor(options.backgroundColor, Cesium.Color.BLACK)
      );
    }
    if (options.pixelOffset !== undefined) {
      this.entity.label.pixelOffset = new Cesium.ConstantProperty(options.pixelOffset);
    }
    if (options.eyeOffset !== undefined) {
      this.entity.label.eyeOffset = new Cesium.ConstantProperty(options.eyeOffset);
    }
    if (options.horizontalOrigin !== undefined) {
      this.entity.label.horizontalOrigin = new Cesium.ConstantProperty(options.horizontalOrigin);
    }
    if (options.verticalOrigin !== undefined) {
      this.entity.label.verticalOrigin = new Cesium.ConstantProperty(options.verticalOrigin);
    }
    if (options.heightReference !== undefined) {
      this.entity.label.heightReference = new Cesium.ConstantProperty(options.heightReference);
    }
    if (options.disableDepthTestDistance !== undefined) {
      this.entity.label.disableDepthTestDistance = new Cesium.ConstantProperty(options.disableDepthTestDistance);
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
   * 更新文本
   */
  setText(text: string): void {
    if (this.destroyed) return;
    if (this.entity.label) {
      this.entity.label.text = new Cesium.ConstantProperty(text);
    }
  }

  /**
   * 获取文本内容
   */
  getText(): string {
    return this.entity.label?.text?.getValue(Cesium.JulianDate.now()) || '';
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
   * 获取标签样式
   */
  getStyle(): Partial<LabelOptions> {
    const label = this.entity.label;
    if (!label) return {};
    
    const now = Cesium.JulianDate.now();
    return {
      text: label.text?.getValue(now),
      font: label.font?.getValue(now),
      fillColor: label.fillColor?.getValue(now),
      outlineColor: label.outlineColor?.getValue(now),
      outlineWidth: label.outlineWidth?.getValue(now),
      style: label.style?.getValue(now),
      scale: label.scale?.getValue(now),
      showBackground: label.showBackground?.getValue(now),
      backgroundColor: label.backgroundColor?.getValue(now),
    };
  }
}