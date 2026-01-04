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

export interface HeatmapAutoUpdateOptions {
  /** 是否启用随视角变化自动重绘（默认 true） */
  enabled?: boolean;
  /** 视域范围 padding（比例，默认 0.15） */
  viewPaddingRatio?: number;
  /** 聚合网格边长（米）。不传则根据相机高度自动估算 */
  cellSizeMeters?: number;
  /** 根据相机高度（米）动态返回网格边长（米）。优先级高于 cellSizeMeters */
  cellSizeMetersByHeight?: (cameraHeightMeters: number) => number;
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

  // auto update / aggregation
  private autoUpdateEnabled = false;
  private autoUpdateOptions: Required<HeatmapAutoUpdateOptions> = {
    enabled: true,
    viewPaddingRatio: 0.15,
    cellSizeMeters: 1000,
    cellSizeMetersByHeight: (h: number) => {
      // 粗略的 LOD：相机越高，网格越粗（单位：米）
      if (h > 2_000_000) return 20_000;
      if (h > 1_000_000) return 12_000;
      if (h > 500_000) return 8_000;
      if (h > 200_000) return 4_000;
      if (h > 100_000) return 2_000;
      if (h > 50_000) return 1_000;
      if (h > 20_000) return 600;
      return 300;
    },
  };
  private removeMoveEndListener: (() => void) | null = null;
  private aggregateWorker: Worker | null = null;
  private workerReady = false;
  private pendingUpdate = false;
  private lastUpdateKey = "";

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

    // 如果启用了自动更新，渲染将由 moveEnd 驱动（且采用聚合后的视域数据）。
    if (!this.autoUpdateEnabled) {
      this.renderHeatmap(this.data, this.rectangle, { persistMinMax: true });
    } else {
      this.ensureWorker();
      this.pushDataToWorker();
      this.requestAutoUpdate();
    }
  }

  /**
   * 更新调色板
   */
  public setGradient(gradient: HeatmapGradient): void {
    this.options.gradient = gradient;
    this.buildGradientLUT();
    if (this.data.length > 0) {
      if (!this.autoUpdateEnabled) {
        if (this.rectangle) this.renderHeatmap(this.data, this.rectangle, { persistMinMax: true });
      } else {
        this.requestAutoUpdate();
      }
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
    this.stopAutoUpdate();
    if (this.aggregateWorker) {
      try {
        this.aggregateWorker.terminate();
      } catch {
        // ignore
      }
      this.aggregateWorker = null;
      this.workerReady = false;
    }
    this.clearLayer();
  }

  /**
   * 启用/关闭基于视域与缩放的自动聚合重绘（方格聚合 + moveEnd + WebWorker）。
   * - 启用后：热力图仅渲染当前视域范围内的聚合结果，缩放/平移后自动更新。
   * - 关闭后：回退为 setData() 时按全量范围绘制一张 SingleTile。
   */
  public setAutoUpdate(options: HeatmapAutoUpdateOptions = {}): void {
    const enabled = options.enabled ?? true;
    this.autoUpdateOptions = {
      ...this.autoUpdateOptions,
      ...options,
      enabled,
      viewPaddingRatio: options.viewPaddingRatio ?? this.autoUpdateOptions.viewPaddingRatio,
      cellSizeMeters: options.cellSizeMeters ?? this.autoUpdateOptions.cellSizeMeters,
      cellSizeMetersByHeight: options.cellSizeMetersByHeight ?? this.autoUpdateOptions.cellSizeMetersByHeight,
    };

    if (enabled) {
      this.startAutoUpdateInternal();
    } else {
      this.stopAutoUpdate();
      if (this.data.length > 0 && this.rectangle) {
        this.renderHeatmap(this.data, this.rectangle, { persistMinMax: true });
      }
    }
  }

  public stopAutoUpdate(): void {
    this.autoUpdateEnabled = false;
    if (this.removeMoveEndListener) {
      try {
        this.removeMoveEndListener();
      } catch {
        // ignore
      }
      this.removeMoveEndListener = null;
    }
    this.pendingUpdate = false;
    this.lastUpdateKey = "";
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

  private startAutoUpdateInternal(): void {
    if (this.autoUpdateEnabled) return;
    this.autoUpdateEnabled = true;
    this.ensureWorker();
    this.pushDataToWorker();

    const handler = () => {
      this.requestAutoUpdate();
    };

    // Cesium Event addEventListener 通常会返回一个移除函数
    const remove = (this.viewer.camera.moveEnd as any)?.addEventListener?.(handler);
    this.removeMoveEndListener = typeof remove === "function" ? remove : null;

    // 立即触发一次
    this.requestAutoUpdate();
  }

  private requestAutoUpdate(): void {
    if (!this.autoUpdateEnabled) return;
    if (!this.workerReady) {
      // worker 还没 ready，先标记 pending
      this.pendingUpdate = true;
      return;
    }

    const view = this.getPaddedViewRectangleDegrees(this.autoUpdateOptions.viewPaddingRatio);
    if (!view) return;

    const cameraHeight = this.viewer.camera.positionCartographic?.height ?? 0;
    const cellMeters = this.autoUpdateOptions.cellSizeMetersByHeight
      ? this.autoUpdateOptions.cellSizeMetersByHeight(cameraHeight)
      : this.autoUpdateOptions.cellSizeMeters;

    const key = `${view.west.toFixed(4)},${view.south.toFixed(4)},${view.east.toFixed(4)},${view.north.toFixed(4)}|${Math.round(
      cameraHeight
    )}|${Math.round(cellMeters)}`;
    if (key === this.lastUpdateKey) return;
    this.lastUpdateKey = key;

    this.aggregateWorker?.postMessage({
      type: "aggregate",
      bbox: view,
      cellMeters,
    });
  }

  private getPaddedViewRectangleDegrees(paddingRatio: number): { west: number; south: number; east: number; north: number } | null {
    const rect = this.viewer.camera.computeViewRectangle(this.viewer.scene.globe.ellipsoid);
    if (!rect) return null;

    const west = Cesium.Math.toDegrees(rect.west);
    const east = Cesium.Math.toDegrees(rect.east);
    const south = Cesium.Math.toDegrees(rect.south);
    const north = Cesium.Math.toDegrees(rect.north);

    // 跨日界线的情况先简单跳过（否则需要拆分为两个 bbox）
    if (west > east) return null;

    const dx = (east - west) * paddingRatio;
    const dy = (north - south) * paddingRatio;
    return {
      west: west - dx,
      east: east + dx,
      south: south - dy,
      north: north + dy,
    };
  }

  private ensureWorker(): void {
    if (this.aggregateWorker) return;

    const workerCode = `
      let lons = null;
      let lats = null;
      let values = null;

      function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

      function degLatPerMeter() { return 1.0 / 110540.0; }
      function degLonPerMeter(latDeg) {
        const rad = latDeg * Math.PI / 180.0;
        const cos = Math.cos(rad);
        const denom = 111320.0 * (cos === 0 ? 1e-6 : cos);
        return 1.0 / denom;
      }

      function aggregate(bbox, cellMeters) {
        if (!lons || !lats || !values) return { points: [], stats: { min: 0, max: 1 } };

        const west = bbox.west;
        const east = bbox.east;
        const south = bbox.south;
        const north = bbox.north;
        const lat0 = (south + north) * 0.5;

        const dLat = cellMeters * degLatPerMeter();
        const dLon = cellMeters * degLonPerMeter(lat0);
        const cols = Math.max(1, Math.ceil((east - west) / (dLon || 1e-9)));

        const sums = new Map();
        const counts = new Map();

        const n = lons.length;
        for (let idx = 0; idx < n; idx++) {
          const lon = lons[idx];
          const lat = lats[idx];
          if (!(lon >= west && lon <= east && lat >= south && lat <= north)) continue;
          const v = values[idx];
          if (!Number.isFinite(v)) continue;
          const i = Math.floor((lon - west) / (dLon || 1e-9));
          const j = Math.floor((lat - south) / (dLat || 1e-9));
          const key = j * cols + i;
          sums.set(key, (sums.get(key) || 0) + v);
          counts.set(key, (counts.get(key) || 0) + 1);
        }

        const points = [];
        let minV = Infinity;
        let maxV = -Infinity;
        for (const [key, sum] of sums.entries()) {
          const j = Math.floor(key / cols);
          const i = key - j * cols;
          const lonC = west + (i + 0.5) * dLon;
          const latC = south + (j + 0.5) * dLat;
          const val = sum;
          if (val < minV) minV = val;
          if (val > maxV) maxV = val;
          points.push({ lon: lonC, lat: latC, value: val, count: counts.get(key) || 1 });
        }
        if (!Number.isFinite(minV) || !Number.isFinite(maxV) || minV === maxV) {
          minV = 0;
          maxV = 1;
        }
        return { points, stats: { min: minV, max: maxV } };
      }

      self.onmessage = (e) => {
        const msg = e.data;
        if (!msg || !msg.type) return;
        if (msg.type === 'init') {
          lons = msg.lons ? new Float64Array(msg.lons) : null;
          lats = msg.lats ? new Float64Array(msg.lats) : null;
          values = msg.values ? new Float32Array(msg.values) : null;
          self.postMessage({ type: 'ready' });
          return;
        }
        if (msg.type === 'aggregate') {
          const bbox = msg.bbox;
          const cellMeters = msg.cellMeters;
          const result = aggregate(bbox, cellMeters);
          self.postMessage({ type: 'result', bbox, points: result.points, stats: result.stats });
          return;
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    this.aggregateWorker = new Worker(url);
    URL.revokeObjectURL(url);

    this.aggregateWorker.onmessage = (e: MessageEvent) => {
      const msg = e.data as any;
      if (!msg || !msg.type) return;
      if (msg.type === "ready") {
        this.workerReady = true;
        if (this.pendingUpdate) {
          this.pendingUpdate = false;
          this.requestAutoUpdate();
        }
        return;
      }
      if (msg.type === "result") {
        if (!this.autoUpdateEnabled) return;
        const bbox = msg.bbox as { west: number; south: number; east: number; north: number };
        const points = (msg.points as HeatPoint[]) ?? [];
        const rect = Cesium.Rectangle.fromDegrees(bbox.west, bbox.south, bbox.east, bbox.north);
        this.rectangle = rect;
        // 动态聚合：每次都按当前视域重新计算 min/max，不持久化到 options
        this.renderHeatmap(points, rect, { persistMinMax: false });
      }
    };
  }

  private pushDataToWorker(): void {
    if (!this.aggregateWorker) return;
    if (this.data.length === 0) return;

    // 将全量数据打包为 TypedArray，传给 worker（只在 setData 或启用 autoUpdate 时传一次）
    const n = this.data.length;
    const lons = new Float64Array(n);
    const lats = new Float64Array(n);
    const values = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = this.data[i];
      lons[i] = p.lon;
      lats[i] = p.lat;
      values[i] = p.value;
    }

    this.workerReady = false;
    this.aggregateWorker.postMessage(
      {
        type: "init",
        lons: lons.buffer,
        lats: lats.buffer,
        values: values.buffer,
      },
      [lons.buffer, lats.buffer, values.buffer]
    );
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
  private renderHeatmap(
    points: HeatPoint[],
    rectangle: Cesium.Rectangle,
    opts: { persistMinMax: boolean }
  ): void {
    if (!rectangle || points.length === 0) return;

    const { width, height, radius } = this.options;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // 自动计算 min/max（如果调用方没指定）
    const hasExplicitRange = !(this.options.minValue === 0 && this.options.maxValue === 1);
    let minV = this.options.minValue;
    let maxV = this.options.maxValue;
    if (!hasExplicitRange) {
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
      if (opts.persistMinMax) {
        this.options.minValue = minV;
        this.options.maxValue = maxV;
      }
    }

    const minLon = Cesium.Math.toDegrees(rectangle.west);
    const maxLon = Cesium.Math.toDegrees(rectangle.east);
    const minLat = Cesium.Math.toDegrees(rectangle.south);
    const maxLat = Cesium.Math.toDegrees(rectangle.north);

    // 第一阶段：用黑白（alpha）累积强度
    for (const p of points) {
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

    this.updateImageryLayer(rectangle);
  }

  /**
   * 将当前 canvas 映射为 Cesium 影像图层
   */
  private updateImageryLayer(rectangle: Cesium.Rectangle): void {
    if (!rectangle) return;

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
      rectangle,
      tileWidth: this.options.width,
      tileHeight: this.options.height,
    });

    this.imageryLayer = this.viewer.imageryLayers.addImageryProvider(provider);
    this.imageryLayer.alpha = this.options.opacity;
    this.imageryLayer.show = true;
  }
}
