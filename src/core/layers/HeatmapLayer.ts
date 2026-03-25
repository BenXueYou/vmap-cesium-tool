import * as Cesium from 'cesium';

/**
 * 热力点数据
 */
export interface HeatPoint {
  /** 经度（度） */
  lon: number;
  /** 纬度（度） */
  lat: number;
  /** 强度值 */
  value: number;
}

/**
 * 热力图渐变配置
 */
export interface HeatmapGradient {
  [stop: number]: string;
}

/**
 * 热力图选项
 */
export interface HeatmapOptions {
  /** Canvas 宽度（默认 512） */
  width?: number;
  /** Canvas 高度（默认 512） */
  height?: number;
  /** 渲染模式：heat=热力渐变，discrete=分段纯色 */
  mode?: 'heat' | 'discrete';
  /** 点影响半径（像素，默认 30） */
  radius?: number;
  /** 伽马校正值（默认 0.7） */
  gamma?: number;
  /** 最小透明度（默认 0.03） */
  minAlpha?: number;
  /** 最小值（用于归一化） */
  minValue?: number;
  /** 最大值（用于归一化） */
  maxValue?: number;
  /** 全局不透明度（0-1） */
  opacity?: number;
  /** 颜色梯度 */
  gradient?: HeatmapGradient;
  /** 离散模式阈值数组 */
  discreteThresholds?: number[];
  /** 离散模式颜色数组 */
  discreteColors?: string[];
  /** 重叠处理方式：max=取高分段，last=后绘制覆盖 */
  discreteOverlap?: 'max' | 'last';
}

/**
 * Cesium 热力图图层
 * 
 * 使用离屏 Canvas 渲染热力图，通过 SingleTileImageryProvider 叠加到地球。
 * 
 * @example
 * ```typescript
 * const heatmap = new HeatmapLayer(viewer, {
 *   radius: 30,
 *   gradient: {
 *     0.0: '#0000ff',
 *     0.5: '#00ffff',
 *     1.0: '#ff0000'
 *   }
 * });
 * heatmap.setData([
 *   { lon: 120.1, lat: 30.2, value: 50 },
 *   { lon: 120.2, lat: 30.3, value: 80 }
 * ]);
 * ```
 */
export class HeatmapLayer {
  private viewer: Cesium.Viewer;
  private imageryLayer: Cesium.ImageryLayer | null = null;
  private rectangle: Cesium.Rectangle | null = null;
  private fullDataRectangle: Cesium.Rectangle | null = null;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private options: Required<HeatmapOptions>;
  private data: HeatPoint[] = [];
  private gradientLUT: Uint8ClampedArray;

  constructor(viewer: Cesium.Viewer, options: HeatmapOptions = {}) {
    this.viewer = viewer;

    const width = options.width ?? 512;
    const height = options.height ?? 512;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context for heatmap layer.');
    }

    this.canvas = canvas;
    this.ctx = ctx;

    this.options = {
      width,
      height,
      mode: options.mode ?? 'heat',
      radius: options.radius ?? 30,
      gamma: options.gamma ?? 0.7,
      minAlpha: options.minAlpha ?? 0.03,
      minValue: options.minValue ?? 0,
      maxValue: options.maxValue ?? 1,
      opacity: options.opacity ?? 1,
      gradient: options.gradient ?? {
        0.0: '#0000ff',
        0.4: '#00ffff',
        0.7: '#ffff00',
        1.0: '#ff0000',
      },
      discreteThresholds: options.discreteThresholds ?? [],
      discreteColors: options.discreteColors ?? [],
      discreteOverlap: options.discreteOverlap ?? 'max',
    };

    this.gradientLUT = new Uint8ClampedArray(256 * 4);
    this.buildGradientLUT();
  }

  /**
   * 解析颜色为 RGBA
   */
  private parseColorToRGBA(color: string): { r: number; g: number; b: number; a: number } | null {
    const c = String(color || '').trim();
    if (!c) return null;

    if (c[0] === '#') {
      const hex = c.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return { r, g, b, a: 255 };
      }
      if (hex.length >= 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
        return { r, g, b, a: Number.isNaN(a) ? 255 : a };
      }
    }

    const m = c.replace(/\s+/g, '').match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,(\d*\.?\d+))?\)$/i);
    if (m) {
      const r = Math.min(255, Math.max(0, Number(m[1])));
      const g = Math.min(255, Math.max(0, Number(m[2])));
      const b = Math.min(255, Math.max(0, Number(m[3])));
      const aF = m[4] != null ? Math.min(1, Math.max(0, Number(m[4]))) : 1;
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: Math.round(aF * 255) };
    }

    return null;
  }

  /**
   * 构建颜色查找表
   */
  private buildGradientLUT(): void {
    const stops = Object.keys(this.options.gradient)
      .map((k) => Number(k))
      .filter((v) => !Number.isNaN(v))
      .sort((a, b) => a - b);

    if (stops.length === 0) {
      this.options.gradient = { 0: '#0000ff', 1: '#ff0000' };
      stops.push(0, 1);
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 256;
    tempCanvas.height = 1;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const grad = tempCtx.createLinearGradient(0, 0, 256, 0);
    for (const s of stops) {
      const color = this.options.gradient[s];
      if (!color) continue;
      grad.addColorStop(Math.min(1, Math.max(0, s)), color);
    }

    tempCtx.fillStyle = grad;
    tempCtx.fillRect(0, 0, 256, 1);

    const imgData = tempCtx.getImageData(0, 0, 256, 1).data;
    this.gradientLUT.set(imgData);
  }

  /**
   * 设置热力图数据
   */
  setData(points: HeatPoint[]): void {
    this.data = points.slice();
    if (this.data.length === 0) {
      this.clearLayer();
      return;
    }

    let minLon = Number.POSITIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLon = Number.NEGATIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    for (const p of this.data) {
      if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
      if (p.lon < minLon) minLon = p.lon;
      if (p.lon > maxLon) maxLon = p.lon;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
    }

    if (!Number.isFinite(minLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLon) || !Number.isFinite(maxLat)) {
      this.clearLayer();
      return;
    }

    const padding = 0.01;
    minLon -= padding;
    maxLon += padding;
    minLat -= padding;
    maxLat += padding;

    this.rectangle = Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat);
    this.fullDataRectangle = Cesium.Rectangle.clone(this.rectangle);

    this.renderHeatmap(this.data);
  }

  /**
   * 渲染热力图
   */
  private renderHeatmap(points: HeatPoint[]): void {
    if (!this.fullDataRectangle || points.length === 0) return;

    const { width, height, radius, gamma, minAlpha } = this.options;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    let minV = this.options.minValue;
    let maxV = this.options.maxValue;
    if (minV === 0 && maxV === 1) {
      minV = Number.POSITIVE_INFINITY;
      maxV = Number.NEGATIVE_INFINITY;
      for (const p of points) {
        if (!Number.isFinite(p.value)) continue;
        if (p.value < minV) minV = p.value;
        if (p.value > maxV) maxV = p.value;
      }
      if (!Number.isFinite(minV) || !Number.isFinite(maxV) || minV === maxV) {
        minV = 0;
        maxV = 1;
      }
    }

    const minLon = Cesium.Math.toDegrees(this.fullDataRectangle.west);
    const maxLon = Cesium.Math.toDegrees(this.fullDataRectangle.east);
    const minLat = Cesium.Math.toDegrees(this.fullDataRectangle.south);
    const maxLat = Cesium.Math.toDegrees(this.fullDataRectangle.north);

    const lonRange = maxLon - minLon || 1;
    const latRange = maxLat - minLat || 1;

    const intensity = new Float32Array(width * height);
    const r = Math.max(1, Math.round(radius));

    for (const p of points) {
      if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
      const t = (p.value - minV) / (maxV - minV || 1);
      if (t <= 0) continue;

      const x = Math.round(((p.lon - minLon) / lonRange) * (width - 1));
      const y = Math.round((1 - (p.lat - minLat) / latRange) * (height - 1));
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r * r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const w = 1 - Math.sqrt(d2) / r;
          intensity[ny * width + nx] += t * w;
        }
      }
    }

    const img = ctx.createImageData(width, height);
    const data = img.data;
    const g = Math.max(0.01, gamma ?? 1);

    for (let i = 0; i < intensity.length; i++) {
      const val = Math.min(1, Math.max(0, intensity[i]));
      if (val <= 0) {
        data[i * 4 + 3] = 0;
        continue;
      }
      const boosted = Math.pow(val, g);
      const alphaN = Math.max(minAlpha ?? 0.03, boosted);
      const alpha8 = Math.min(255, Math.max(0, Math.round(alphaN * 255)));
      const lutIndex = Math.min(255, Math.max(0, Math.round(val * 255))) * 4;
      data[i * 4] = this.gradientLUT[lutIndex];
      data[i * 4 + 1] = this.gradientLUT[lutIndex + 1];
      data[i * 4 + 2] = this.gradientLUT[lutIndex + 2];
      data[i * 4 + 3] = Math.round(alpha8 * this.options.opacity);
    }

    ctx.putImageData(img, 0, 0);
    this.updateImageryLayer();
  }

  /**
   * 更新影像图层
   */
  private updateImageryLayer(): void {
    if (!this.fullDataRectangle) return;

    if (this.imageryLayer) {
      try {
        this.viewer.imageryLayers.remove(this.imageryLayer, true);
      } catch { /* ignore */ }
      this.imageryLayer = null;
    }

    const dataUrl = this.canvas.toDataURL('image/png');
    const provider = new Cesium.SingleTileImageryProvider({
      url: dataUrl,
      rectangle: this.fullDataRectangle,
      tileWidth: this.options.width,
      tileHeight: this.options.height,
    });

    this.imageryLayer = this.viewer.imageryLayers.addImageryProvider(provider);
    this.imageryLayer.alpha = this.options.opacity;
    this.imageryLayer.show = true;
  }

  /**
   * 设置透明度
   */
  setOpacity(opacity: number): void {
    this.options.opacity = Math.min(1, Math.max(0, opacity));
    if (this.imageryLayer) {
      this.imageryLayer.alpha = this.options.opacity;
    }
  }

  /**
   * 设置可见性
   */
  setVisible(visible: boolean): void {
    if (this.imageryLayer) {
      this.imageryLayer.show = visible;
    }
  }

  /**
   * 清除图层
   */
  clearLayer(): void {
    if (this.imageryLayer) {
      try {
        this.viewer.imageryLayers.remove(this.imageryLayer, true);
      } catch { /* ignore */ }
      this.imageryLayer = null;
    }
    this.fullDataRectangle = null;
  }

  /**
   * 销毁图层
   */
  destroy(): void {
    this.clearLayer();
  }
}