import * as Cesium from "cesium";

export interface HeatPoint {
  /** 经度（度） */
  lon: number;
  /** 纬度（度） */
  lat: number;
  /** 强度值，用于控制热度（0~maxValue） */
  value: number;
}

export interface HeatmapGradient {
  /**
   * 0~1 的比例到颜色字符串的映射，例如：
   * { 0.0: "#0000ff", 0.5: "#ffff00", 1.0: "#ff0000" }
   */
  [stop: number]: string;
}

export interface HeatmapOptions {
  /** Canvas 分辨率，越大越清晰但开销越大 */
  width?: number;
  height?: number;
  /** 单个点的影响半径（像素） */
  radius?: number;
  /** 最小/最大值，用于归一化 value，如果不传则自动根据数据计算 */
  minValue?: number;
  maxValue?: number;
  /** 全局不透明度 0~1 */
  opacity?: number;
  /** 颜色梯度 */
  gradient?: HeatmapGradient;
}

/**
 * Cesium 热力图图层封装
 * - 使用离屏 Canvas 绘制热力图
 * - 通过 SingleTileImageryProvider 叠加到地球上
 */
export default class CesiumHeatmapLayer {
  private viewer: Cesium.Viewer;
  private imageryLayer: Cesium.ImageryLayer | null = null;
  private rectangle: Cesium.Rectangle | null = null;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private options: Required<HeatmapOptions>;
  private data: HeatPoint[] = [];
  private gradientLUT: Uint8ClampedArray; // 长度 256 * 4 (RGBA)

  constructor(viewer: Cesium.Viewer, options: HeatmapOptions = {}) {
    this.viewer = viewer;

    const width = options.width ?? 512;
    const height = options.height ?? 512;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for heatmap canvas.");
    }

    this.canvas = canvas;
    this.ctx = ctx;

    this.options = {
      width,
      height,
      radius: options.radius ?? 30,
      minValue: options.minValue ?? 0,
      maxValue: options.maxValue ?? 1,
      opacity: options.opacity ?? 1,
      gradient:
        options.gradient ??
        {
          0.0: "#0000ff",
          0.4: "#00ffff",
          0.7: "#ffff00",
          1.0: "#ff0000",
        },
    };

    this.gradientLUT = new Uint8ClampedArray(256 * 4);
    this.buildGradientLUT();
  }

  /**
   * 设置/替换热力图数据（度为单位）
   */
  public setData(points: HeatPoint[]): void {
    this.data = points.slice();
    if (this.data.length === 0) {
      this.clearLayer();
      return;
    }

    // 计算经纬度包络框
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

    // 给范围稍微扩一点，避免刚好落在边缘
    const padding = 1e-3; // 约 0.001 度
    minLon -= padding;
    maxLon += padding;
    minLat -= padding;
    maxLat += padding;

    this.rectangle = Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat);

    this.renderHeatmap();
  }

  /**
   * 更新调色板
   */
  public setGradient(gradient: HeatmapGradient): void {
    this.options.gradient = gradient;
    this.buildGradientLUT();
    if (this.data.length > 0) {
      this.renderHeatmap();
    }
  }

  /**
   * 设置透明度
   */
  public setOpacity(opacity: number): void {
    this.options.opacity = Math.min(1, Math.max(0, opacity));
    if (this.imageryLayer) {
      this.imageryLayer.alpha = this.options.opacity;
    }
  }

  /**
   * 显隐控制
   */
  public setVisible(visible: boolean): void {
    if (this.imageryLayer) {
      this.imageryLayer.show = visible;
    }
  }

  /**
   * 销毁并移除图层
   */
  public destroy(): void {
    this.clearLayer();
  }

  private clearLayer(): void {
    if (this.imageryLayer) {
      try {
        this.viewer.imageryLayers.remove(this.imageryLayer, true);
      } catch {
        // ignore
      }
      this.imageryLayer = null;
    }
  }

  /**
   * 构建颜色查找表（0-255 -> RGBA）
   */
  private buildGradientLUT(): void {
    const stops = Object.keys(this.options.gradient)
      .map((k) => Number(k))
      .filter((v) => !Number.isNaN(v))
      .sort((a, b) => a - b);

    if (stops.length === 0) {
      // 默认蓝→红
      this.options.gradient = { 0: "#0000ff", 1: "#ff0000" };
      stops.push(0, 1);
    }

    const ctx = this.ctx;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 256;
    tempCanvas.height = 1;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    const grad = tempCtx.createLinearGradient(0, 0, 256, 0);
    for (const s of stops) {
      const color = this.options.gradient[s];
      if (!color) continue;
      const offset = Math.min(1, Math.max(0, s));
      grad.addColorStop(offset, color as any);
    }
    tempCtx.fillStyle = grad;
    tempCtx.fillRect(0, 0, 256, 1);

    const imgData = tempCtx.getImageData(0, 0, 256, 1).data;
    this.gradientLUT.set(imgData);
  }

  /**
   * 在离屏 canvas 上绘制热力图，并更新到 Cesium 图层
   */
  private renderHeatmap(): void {
    if (!this.rectangle || this.data.length === 0) return;

    const { width, height, radius } = this.options;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // 自动计算 min/max（如果调用方没指定）
    let minV = this.options.minValue;
    let maxV = this.options.maxValue;
    if (this.options.minValue === 0 && this.options.maxValue === 1) {
      minV = Number.POSITIVE_INFINITY;
      maxV = Number.NEGATIVE_INFINITY;
      for (const p of this.data) {
        if (!Number.isFinite(p.value)) continue;
        if (p.value < minV) minV = p.value;
        if (p.value > maxV) maxV = p.value;
      }
      if (!Number.isFinite(minV) || !Number.isFinite(maxV) || minV === maxV) {
        minV = 0;
        maxV = 1;
      }
      this.options.minValue = minV;
      this.options.maxValue = maxV;
    }

    const rect = this.rectangle;
    const minLon = Cesium.Math.toDegrees(rect.west);
    const maxLon = Cesium.Math.toDegrees(rect.east);
    const minLat = Cesium.Math.toDegrees(rect.south);
    const maxLat = Cesium.Math.toDegrees(rect.north);

    // 第一阶段：用黑白（alpha）累积强度
    for (const p of this.data) {
      if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
      const t = (p.value - minV) / (maxV - minV || 1);
      if (t <= 0) continue;

      const x = ((p.lon - minLon) / (maxLon - minLon || 1)) * width;
      const y = (1 - (p.lat - minLat) / (maxLat - minLat || 1)) * height;

      const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grd.addColorStop(0, "rgba(0,0,0,1)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.globalAlpha = t;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // 第二阶段：读取灰度图的 alpha，根据梯度 LUT 重新着色
    const img = ctx.getImageData(0, 0, width, height);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      const idx = Math.min(255, Math.max(0, alpha));
      const lutIndex = idx * 4;
      data[i] = this.gradientLUT[lutIndex];
      data[i + 1] = this.gradientLUT[lutIndex + 1];
      data[i + 2] = this.gradientLUT[lutIndex + 2];
      // 使用原有 alpha，再乘以全局不透明度
      data[i + 3] = Math.round(alpha * this.options.opacity);
    }
    ctx.putImageData(img, 0, 0);

    this.updateImageryLayer();
  }

  /**
   * 将当前 canvas 映射为 Cesium 影像图层
   */
  private updateImageryLayer(): void {
    if (!this.rectangle) return;

    // 简单处理：每次重建 SingleTileImageryProvider
    if (this.imageryLayer) {
      try {
        this.viewer.imageryLayers.remove(this.imageryLayer, true);
      } catch {
        // ignore
      }
      this.imageryLayer = null;
    }

    // 使用 dataURL 作为图片来源，并显式指定 tileWidth/tileHeight，
    // 避免部分 Cesium 版本中对非字符串 url 要求提供 tile 尺寸而报错。
    const dataUrl = this.canvas.toDataURL("image/png");
    const provider = new Cesium.SingleTileImageryProvider({
      url: dataUrl,
      rectangle: this.rectangle,
      tileWidth: this.options.width,
      tileHeight: this.options.height,
    });

    this.imageryLayer = this.viewer.imageryLayers.addImageryProvider(provider);
    this.imageryLayer.alpha = this.options.opacity;
    this.imageryLayer.show = true;
  }
}
