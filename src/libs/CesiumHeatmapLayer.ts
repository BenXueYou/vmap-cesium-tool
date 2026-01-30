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
  /** 渲染模式：heat 为热力渐变（默认）；discrete 为严格分段纯色 */
  mode?: "heat" | "discrete";
  /** 单个点的影响半径（像素） */
  radius?: number;
  /** 低强度提升（伽马矫正），< 1 可增强边缘，默认 0.7 */
  gamma?: number;
  /** 最小可见 alpha（0~1），用于避免外圈完全消失，默认 0.03 */
  minAlpha?: number;
  /** 最小/最大值，用于归一化 value，如果不传则自动根据数据计算 */
  minValue?: number;
  maxValue?: number;
  /** 全局不透明度 0~1 */
  opacity?: number;
  /** 颜色梯度 */
  gradient?: HeatmapGradient;

  /**
   * 严格分段（仅 mode=discrete 生效）：
   * thresholds.length + 1 必须等于 colors.length。
   * 例如 thresholds=[40,60,90,110] colors=[蓝,青,绿,黄,红]
   * - value < 40 -> colors[0]
   * - 40 <= value < 60 -> colors[1]
   * - 60 <= value < 90 -> colors[2]
   * - 90 <= value < 110 -> colors[3]
   * - value >= 110 -> colors[4]
   */
  discreteThresholds?: number[];
  discreteColors?: string[];
  /** 重叠像素的决策：max=取更高分段（默认）；last=后绘制覆盖 */
  discreteOverlap?: "max" | "last";
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
  private fullDataRectangle: Cesium.Rectangle | null = null;

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

  private handleWorkerFault(stage: string, error: unknown): void {
    // DataCloneError 通常发生在 postMessage 复制失败（包含不可克隆对象 / 原生内部对象）
    // 这里选择“降级”而不是抛出，避免主线程逻辑被打断。
    try {
      // eslint-disable-next-line no-console
      console.error(`[HeatmapLayer] worker fault at ${stage}`, error);
    } catch {
      // ignore
    }
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
    // 降级为全量渲染（如果有数据）
    if (this.data.length > 0 && this.rectangle) {
      this.renderHeatmap(this.data, { persistMinMax: true });
    }
  }

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
      mode: options.mode ?? "heat",
      radius: options.radius ?? 30,
      gamma: options.gamma ?? 0.7,
      minAlpha: options.minAlpha ?? 0.03,
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
      discreteThresholds: options.discreteThresholds ?? [],
      discreteColors: options.discreteColors ?? [],
      discreteOverlap: options.discreteOverlap ?? "max",
    };

    this.gradientLUT = new Uint8ClampedArray(256 * 4);
    this.buildGradientLUT();
  }

  private parseColorToRGBA(color: string): { r: number; g: number; b: number; a: number } | null {
    const c = String(color || "").trim();
    if (!c) return null;

    // #RRGGBB or #RGB or #RRGGBBAA
    if (c[0] === "#") {
      const hex = c.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        if ([r, g, b].some((v) => Number.isNaN(v))) return null;
        return { r, g, b, a: 255 };
      }
      if (hex.length === 6 || hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some((v) => Number.isNaN(v))) return null;
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
        return { r, g, b, a: Number.isNaN(a) ? 255 : a };
      }
    }

    // rgb()/rgba()
    const m = c
      .replace(/\s+/g, "")
      .match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,(\d*\.?\d+))?\)$/i);
    if (m) {
      const r = Math.min(255, Math.max(0, Number(m[1])));
      const g = Math.min(255, Math.max(0, Number(m[2])));
      const b = Math.min(255, Math.max(0, Number(m[3])));
      const aF = m[4] != null ? Math.min(1, Math.max(0, Number(m[4]))) : 1;
      if ([r, g, b, aF].some((v) => !Number.isFinite(v))) return null;
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: Math.round(aF * 255) };
    }

    return null;
  }

  private getDiscreteBucketIndex(value: number): number {
    const thresholds = this.options.discreteThresholds;
    if (!Array.isArray(thresholds) || thresholds.length === 0) return 0;
    for (let i = 0; i < thresholds.length; i++) {
      const t = thresholds[i];
      if (!Number.isFinite(t)) continue;
      if (value < t) return i;
    }
    return thresholds.length;
  }

  private renderDiscrete(points: HeatPoint[]): void {
    if (!this.fullDataRectangle || points.length === 0) return;

    const { width, height, radius } = this.options;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const thresholds = this.options.discreteThresholds;
    const colors = this.options.discreteColors;
    if (!Array.isArray(thresholds) || !Array.isArray(colors) || colors.length !== thresholds.length + 1) {
      // 配置不完整则回退为 heat
      this.renderHeatmap(points, { persistMinMax: false });
      return;
    }

    const rgbaPalette = colors
      .map((c) => this.parseColorToRGBA(c))
      .map((c) => c ?? { r: 255, g: 0, b: 0, a: 255 });

    const minLon = Cesium.Math.toDegrees(this.fullDataRectangle.west);
    const maxLon = Cesium.Math.toDegrees(this.fullDataRectangle.east);
    const minLat = Cesium.Math.toDegrees(this.fullDataRectangle.south);
    const maxLat = Cesium.Math.toDegrees(this.fullDataRectangle.north);
    const lonRange = maxLon - minLon || 1;
    const latRange = maxLat - minLat || 1;

    const r = Math.max(1, Math.round(radius));
    const offsets: Array<{ dx: number; dy: number }> = [];
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        offsets.push({ dx, dy });
      }
    }

    // 每个像素一个 bucket index，-1 表示透明
    const buckets = new Int16Array(width * height);
    buckets.fill(-1);
    const overlap = this.options.discreteOverlap;

    for (const p of points) {
      if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat) || !Number.isFinite(p.value)) continue;
      const bucket = this.getDiscreteBucketIndex(p.value);
      const x = Math.round(((p.lon - minLon) / lonRange) * (width - 1));
      const y = Math.round((1 - (p.lat - minLat) / latRange) * (height - 1));
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      for (const o of offsets) {
        const nx = x + o.dx;
        const ny = y + o.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const idx = ny * width + nx;
        if (overlap === "last") {
          buckets[idx] = bucket;
        } else {
          if (bucket > buckets[idx]) buckets[idx] = bucket;
        }
      }
    }

    const img = ctx.createImageData(width, height);
    const data = img.data;
    const outAlpha = Math.min(255, Math.max(0, Math.round(255 * this.options.opacity)));

    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b < 0) {
        data[i * 4 + 3] = 0;
        continue;
      }
      const c = rgbaPalette[Math.min(rgbaPalette.length - 1, Math.max(0, b))];
      data[i * 4] = c.r;
      data[i * 4 + 1] = c.g;
      data[i * 4 + 2] = c.b;
      // 颜色自带 alpha * 全局 opacity
      data[i * 4 + 3] = Math.round((c.a / 255) * outAlpha);
    }

    ctx.putImageData(img, 0, 0);
    this.updateImageryLayer();
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
    const padding = 1e-2; // 约 0.01 度，单点也可见
    minLon -= padding;
    maxLon += padding;
    minLat -= padding;
    maxLat += padding;

    this.rectangle = Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat);
    this.fullDataRectangle = Cesium.Rectangle.clone(this.rectangle);

    // 如果启用了自动更新，渲染将由 moveEnd 驱动（且采用聚合后的视域数据）。
    if (!this.autoUpdateEnabled) {
      this.renderHeatmap(this.data, { persistMinMax: true });
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
        if (this.rectangle) this.renderHeatmap(this.data, { persistMinMax: true });
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
        this.renderHeatmap(this.data, { persistMinMax: true });
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
    this.fullDataRectangle = null;
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
    if (!this.fullDataRectangle) return;
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

    try {
      this.aggregateWorker?.postMessage({
        type: "aggregate",
        bbox: view,
        cellMeters,
      });
    } catch (e) {
      this.handleWorkerFault('postMessage(aggregate)', e);
    }
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
      let originLon = 0;
      let originLat = 0;
      let refLat = 0;

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

        const dLat = cellMeters * degLatPerMeter();
        const dLon = cellMeters * degLonPerMeter(refLat || 0);

        const sums = new Map();
        const counts = new Map();

        const n = lons.length;
        for (let idx = 0; idx < n; idx++) {
          const lon = lons[idx];
          const lat = lats[idx];
          if (!(lon >= west && lon <= east && lat >= south && lat <= north)) continue;
          const v = values[idx];
          if (!Number.isFinite(v)) continue;
          const i = Math.floor((lon - originLon) / (dLon || 1e-9));
          const j = Math.floor((lat - originLat) / (dLat || 1e-9));
          const key = i + ',' + j;
          sums.set(key, (sums.get(key) || 0) + v);
          counts.set(key, (counts.get(key) || 0) + 1);
        }

        const points = [];
        let minV = Infinity;
        let maxV = -Infinity;
        for (const [key, sum] of sums.entries()) {
          const parts = String(key).split(',');
          const i = Number(parts[0]);
          const j = Number(parts[1]);
          const lonC = originLon + (i + 0.5) * dLon;
          const latC = originLat + (j + 0.5) * dLat;
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
          originLon = typeof msg.originLon === 'number' ? msg.originLon : 0;
          originLat = typeof msg.originLat === 'number' ? msg.originLat : 0;
          refLat = typeof msg.refLat === 'number' ? msg.refLat : 0;
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

    this.aggregateWorker.onerror = (e: any) => {
      this.handleWorkerFault('worker.onerror', e);
    };
    (this.aggregateWorker as any).onmessageerror = (e: any) => {
      this.handleWorkerFault('worker.onmessageerror', e);
    };

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
        // 动态聚合：每次都按当前视域重新计算 min/max，不持久化到 options
        this.renderHeatmap(points, { persistMinMax: false });
      }
    };
  }

  private pushDataToWorker(): void {
    if (!this.aggregateWorker) return;
    if (this.data.length === 0) return;
    if (!this.fullDataRectangle) return;

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
    const originLon = Cesium.Math.toDegrees(this.fullDataRectangle.west);
    const originLat = Cesium.Math.toDegrees(this.fullDataRectangle.south);
    const refLat = Cesium.Math.toDegrees(
      (this.fullDataRectangle.south + this.fullDataRectangle.north) * 0.5
    );

    try {
      this.aggregateWorker.postMessage(
        {
          type: "init",
          lons: lons.buffer,
          lats: lats.buffer,
          values: values.buffer,
          originLon,
          originLat,
          refLat,
        },
        [lons.buffer, lats.buffer, values.buffer]
      );
    } catch (e) {
      this.handleWorkerFault('postMessage(init)', e);
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
  private renderHeatmap(points: HeatPoint[], opts: { persistMinMax: boolean }): void {
    if (this.options.mode === "discrete") {
      this.renderDiscrete(points);
      return;
    }
    if (!this.fullDataRectangle || points.length === 0) return;

    const { width, height, radius, gamma, minAlpha } = this.options;
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

    const minLon = Cesium.Math.toDegrees(this.fullDataRectangle.west);
    const maxLon = Cesium.Math.toDegrees(this.fullDataRectangle.east);
    const minLat = Cesium.Math.toDegrees(this.fullDataRectangle.south);
    const maxLat = Cesium.Math.toDegrees(this.fullDataRectangle.north);

    const lonRange = maxLon - minLon || 1;
    const latRange = maxLat - minLat || 1;

    const intensity = new Float32Array(width * height);

    // 预计算影响核
    const r = Math.max(1, Math.round(radius));
    const kernel: Array<{ dx: number; dy: number; w: number }> = [];
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const dist = Math.sqrt(d2);
        const w = 1 - dist / r;
        if (w <= 0) continue;
        kernel.push({ dx, dy, w });
      }
    }

    // 第一阶段：累加强度
    for (const p of points) {
      if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
      const t = (p.value - minV) / (maxV - minV || 1);
      if (t <= 0) continue;

      const x = Math.round(((p.lon - minLon) / lonRange) * (width - 1));
      const y = Math.round((1 - (p.lat - minLat) / latRange) * (height - 1));
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      for (const k of kernel) {
        const nx = x + k.dx;
        const ny = y + k.dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        intensity[ny * width + nx] += t * k.w;
      }
    }

    const img = ctx.createImageData(width, height);
    const data = img.data;
    const g = Math.max(0.01, gamma ?? 1);
    const minA = Math.min(1, Math.max(0, minAlpha ?? 0));

    for (let i = 0; i < intensity.length; i++) {
      const val = Math.min(1, Math.max(0, intensity[i]));
      if (val <= 0) {
        data[i * 4 + 3] = 0;
        continue;
      }
      const boosted = Math.pow(val, g);
      const alphaN = Math.max(minA, boosted);
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
   * 将当前 canvas 映射为 Cesium 影像图层
   */
  private updateImageryLayer(): void {
    if (!this.fullDataRectangle) return;

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
      rectangle: this.fullDataRectangle,
      tileWidth: this.options.width,
      tileHeight: this.options.height,
    });

    this.imageryLayer = this.viewer.imageryLayers.addImageryProvider(provider);
    this.imageryLayer.alpha = this.options.opacity;
    this.imageryLayer.show = true;
  }
}

// Add named export for CesiumHeatmapLayer
export { CesiumHeatmapLayer };
