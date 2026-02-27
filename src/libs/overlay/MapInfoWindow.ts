import * as Cesium from 'cesium';
import type { Viewer, Entity, Cartesian3 } from 'cesium';
import type { OverlayPosition } from './types';

export interface InfoWindowOptions {
  position: OverlayPosition;
  content: string | HTMLElement;
  width?: number;
  height?: number;
  pixelOffset?: Cesium.Cartesian2; // x：向右，y：向上（单位：CSS 像素）
  show?: boolean;
  onClick?: (entity: Entity) => void;
  id?: string;
  closable?: boolean;
  onClose?: (entity: Entity) => void;
  backgroundColor?: string;
  color?: string;
  font?: string;
  // 自定义样式与类名（通过对象合并实现覆盖默认样式）
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  // 是否显示箭头（根据位置在底部/顶部/左右显示）
  showArrow?: boolean;
  // 箭头大小（px）
  arrowSize?: number;
  // 信息窗相对 marker 的方位（默认 top）
  positionOffset?:
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'left-top'
    | 'left-bottom'
    | 'right-top'
    | 'right-bottom';
  hideWhenOutOfView?: boolean; // 新增：是否在视锥外自动隐藏（默认 true）
  // anchorHeight（米）用于计算屏幕上的 marker 高度以便将 infoWindow 锚定在 marker 顶部
  anchorHeight?: number;
  // anchorPixel（像素）优先：以像素为单位指定 marker 顶部距离，用于将 infoWindow 锚定在 marker 顶部
  anchorPixel?: number;
  // tailGap（像素）弹窗底部与 marker 顶部之间的间隙（默认 8px）
  tailGap?: number;
  // updateInterval（毫秒）用于节流更新位置（默认 0，每帧更新），可提高大量 infoWindow 时的性能
  updateInterval?: number;
}

interface InternalEntityData {
  domElement: HTMLElement;
  options: InfoWindowOptions;
  cameraListener: () => void;
  postRenderListener: Cesium.Event.RemoveCallback;
  zIndex: number; // 新增：用于层级管理
  lastUpdate: number; // 毫秒时间戳（来自 performance.now()），用于节流
  arrowEl?: HTMLElement | null;
}

// 全局 zIndex 基准（可配置）
const BASE_Z_INDEX = 1000;
let nextZIndex = BASE_Z_INDEX;
const INFO_WINDOW_DATA_KEY = '_infoWindowData';
/**
 * 面向 Cesium 的 HTML 信息窗口管理器
 * 要求 container 为 position: relative 的 DOM 容器（通常与 viewer.canvas 同级或包裹）
 */
export class MapInfoWindow {
  private viewer: Viewer;
  private container: HTMLElement;
  private entityMap = new Map<string, InternalEntityData>();
  private currentTopZIndex = BASE_Z_INDEX;
  private defaultUpdateInterval = 0; // ms, 默认 0 = 每帧更新
  private isCameraMoving = false;
  private cameraMoveStartListener?: Cesium.Event.RemoveCallback;
  private cameraMoveEndListener?: Cesium.Event.RemoveCallback;

  /**
   * 合并用户传入的 InfoWindowOptions 与默认值，提升入参灵活性。
   * 注意：必填项 position / content 由调用方提供，不在默认值内。
   */
  private mergeOptions(options: InfoWindowOptions): InfoWindowOptions {
    const defaults: Partial<InfoWindowOptions> = {
      show: true,
      hideWhenOutOfView: true,
      anchorHeight: 10,
      tailGap: 8,
      updateInterval: 0,
      className: 'cesium-info-window',
      showArrow: false,
      arrowSize: 8,
      positionOffset: 'top',
    };
    // style 需要做浅合并，保持引用独立
    const style = options.style ? { ...options.style } : undefined;
    return { ...defaults, ...options, style } as InfoWindowOptions;
  }

  constructor(viewer: Viewer, container: HTMLElement) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('Container must be a valid HTMLElement');
    }
    this.viewer = viewer;
    this.container = container;

    // 监听相机开始/结束移动，用以在移动期间绕过节流并在移动结束时强制同步位置
    this.cameraMoveStartListener = this.viewer.camera.moveStart.addEventListener(() => {
      this.isCameraMoving = true;
    });
    this.cameraMoveEndListener = this.viewer.camera.moveEnd.addEventListener(() => {
      this.isCameraMoving = false;
      // 相机停止后强制更新所有信息窗以确保位置与标记严格同步
      this.forceUpdateAll();
    });
  }

  /**
   * 设置默认的位置更新间隔（毫秒）：当 InfoWindow 未指定 `updateInterval` 时使用。
   * 0 表示每帧更新。
   */
  public setDefaultUpdateInterval(ms: number): void {
    this.defaultUpdateInterval = Math.max(0, ms);
  }

  /**
   * 强制立即更新（重新计算位置）所有已管理的信息窗。
   */
  public forceUpdateAll(): void {
    const entities = this.viewer.entities.values.slice();
    for (const entity of entities) {
      if ((entity as any)[INFO_WINDOW_DATA_KEY]) {
        this.updateDomPosition(entity);
      }
    }
  }

  private convertPosition(position: OverlayPosition): Cartesian3 {
    if (position instanceof Cesium.Cartesian3) {
      if (
        Number.isFinite((position as any).x) &&
        Number.isFinite((position as any).y) &&
        Number.isFinite((position as any).z)
      ) {
        return position;
      }
      throw new Error('Invalid position: Cartesian3 has NaN/Infinity components');
    }
    if (Array.isArray(position)) {
      if (position.length !== 2 && position.length !== 3) {
        throw new Error('Invalid position: expected [lon, lat] or [lon, lat, height]');
      }
      const lon = Number((position as any)[0]);
      const lat = Number((position as any)[1]);
      const height = position.length === 3 ? Number((position as any)[2]) : 0;

      if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(height)) {
        throw new Error('Invalid position: lon/lat/height must be finite numbers');
      }

      const cart = Cesium.Cartesian3.fromDegrees(lon, lat, height);
      if (!Number.isFinite((cart as any).x) || !Number.isFinite((cart as any).y) || !Number.isFinite((cart as any).z)) {
        throw new Error('Invalid position: converted Cartesian3 has NaN/Infinity components');
      }
      return cart;
    }
    throw new Error('Invalid position: expected [lon, lat] or [lon, lat, height] or Cartesian3');
  }

  /**
   * 将世界坐标转换为相对于 container 的 CSS 像素坐标
   */
  private getContainerPixelPosition(worldPos: Cartesian3): { x: number; y: number } | null {
    const scene = this.viewer.scene;
    const canvas = scene.canvas;

    // 1. 转换为窗口像素坐标（Cesium 返回的 window 坐标，原点左上）
    const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(scene, worldPos);
    if (!screenPos || !Cesium.defined(screenPos)) return null;

    if (isNaN(screenPos.x) || isNaN(screenPos.y)) return null;

    // 2. 获取 canvas 和 container 的布局信息
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    // 3. 使用 Cesium 返回的窗口坐标（单位：CSS 像素，原点左上），并换算为 container 内坐标
    const x = screenPos.x - containerRect.left;
    const y = screenPos.y - containerRect.top;

    return { x, y };
  }

  /**
   * 更新单个 infoWindow 的显示状态和位置
   */
  private updateDomPosition(entity: Entity): void {
    const data = (entity as any)[INFO_WINDOW_DATA_KEY] as InternalEntityData | undefined;
    if (!data) return;

    const { domElement, options } = data;
    const worldPos = entity.position?.getValue(this.viewer.clock.currentTime) as Cartesian3 | undefined;
    if (!worldPos) {
      domElement.style.display = 'none';
      return;
    }
    
    if (entity.show === false || options.show === false) {
      domElement.style.display = 'none';
      return;
    }

    // 相机背面检测（可选）。为避免相机拖动/旋转时出现闪烁，移动期间会跳过该检测。
    if (options.hideWhenOutOfView !== false && !this.isCameraMoving) {
      const cam = this.viewer.camera;
      const toPoint = Cesium.Cartesian3.subtract(worldPos, cam.positionWC, new Cesium.Cartesian3());
      if (Cesium.Cartesian3.dot(toPoint, cam.directionWC) <= 0) {
        domElement.style.display = 'none';
        return;
      }
    }

    const pixelPos = this.getContainerPixelPosition(worldPos);
    if (!pixelPos) {
      domElement.style.display = 'none';
      return;
    }

    let { x, y } = pixelPos;

    // 计算锚点在屏幕上的位置：用于将信息窗锚定到 marker 顶部
    const anchorMeters = options.anchorHeight ?? 10; // 默认 10 米（较小默认值避免远距时视觉偏移过大）
    const tailGap = options.tailGap ?? 8; // 弹窗底部与 marker 顶部的间隙（px）
    try {
      // 优先使用像素锚点（更契合视觉预期）
      const basePixel = this.getContainerPixelPosition(worldPos);
      if (typeof options.anchorPixel === 'number' && basePixel) {
        x = basePixel.x;
        y = basePixel.y - options.anchorPixel;
      } else {
        // 使用 Cartographic（经纬度 + 高度）抬升高度，避免直接用法线/向量带来的非线性误差
        const carto = Cesium.Cartographic.fromCartesian(worldPos);
        const lonDeg = Cesium.Math.toDegrees(carto.longitude);
        const latDeg = Cesium.Math.toDegrees(carto.latitude);
        const anchorWorld = Cesium.Cartesian3.fromDegrees(lonDeg, latDeg, carto.height + anchorMeters);

        const anchorPixel = this.getContainerPixelPosition(anchorWorld);
        const basePixelFallback = this.getContainerPixelPosition(worldPos);

        if (anchorPixel && basePixelFallback) {
          // anchorPixel 为顶部参考点（在 marker 上方 anchorMeters 米处）
          x = anchorPixel.x; // 锚点使用 anchorWorld 的屏幕位置
          y = anchorPixel.y;
        } else if (basePixelFallback) {
          // 回退到 basePixel
          x = basePixelFallback.x;
          y = basePixelFallback.y;
        }
      }
    } catch (e) {
      void e;
    }

    // 应用 pixelOffset（单位：CSS 像素）
    if (options.pixelOffset) {
      x += options.pixelOffset.x;
      y -= options.pixelOffset.y;
    }

    // 获取容器尺寸
    const containerRect = this.container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // 强制布局以获取真实尺寸（必要时）
    domElement.style.visibility = 'hidden';
    domElement.style.display = 'block';
    const rect = domElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    domElement.style.visibility = '';
    domElement.style.display = 'none'; // 先隐藏，待定位完成后再显示

    // 记录锚点（顶部锚点）与基础点（marker 屏幕点），供不同方向的定位计算
    const anchorX = x;
    const anchorY = y;
    const baseX = pixelPos.x;
    const baseY = pixelPos.y;

    type Side = NonNullable<InfoWindowOptions['positionOffset']>;
    const requestedSide = (options.positionOffset ?? 'top') as Side;

    const placeForSide = (s: Side): { x: number; y: number; transform: string } => {
      if (s === 'top') {
        return { x: anchorX, y: anchorY - tailGap, transform: 'translate(-50%, -100%)' };
      }
      if (s === 'bottom') {
        return { x: baseX, y: baseY + tailGap, transform: 'translate(-50%, 0%)' };
      }
      if (s === 'left') {
        return { x: baseX - tailGap, y: baseY, transform: 'translate(-100%, -50%)' };
      }
      if (s === 'right') {
        return { x: baseX + tailGap, y: baseY, transform: 'translate(0%, -50%)' };
      }
      if (s === 'top-left') {
        return { x: baseX - tailGap, y: baseY - tailGap, transform: 'translate(-100%, -100%)' };
      }
      if (s === 'top-right') {
        return { x: baseX + tailGap, y: baseY - tailGap, transform: 'translate(0%, -100%)' };
      }
      if (s === 'bottom-left') {
        return { x: baseX - tailGap, y: baseY + tailGap, transform: 'translate(-100%, 0%)' };
      }
      if (s === 'bottom-right') {
        return { x: baseX + tailGap, y: baseY + tailGap, transform: 'translate(0%, 0%)' };
      }
      if (s === 'left-top') {
        return { x: baseX - tailGap, y: baseY - tailGap, transform: 'translate(-100%, 0%)' };
      }
      if (s === 'left-bottom') {
        return { x: baseX - tailGap, y: baseY + tailGap, transform: 'translate(-100%, -100%)' };
      }
      if (s === 'right-top') {
        return { x: baseX + tailGap, y: baseY - tailGap, transform: 'translate(0%, 0%)' };
      }
      // right-bottom
      return { x: baseX + tailGap, y: baseY + tailGap, transform: 'translate(0%, -100%)' };
    };

    const boundsFor = (s: Side, px: number, py: number) => {
      switch (s) {
        case 'top':
          return { left: px - width / 2, right: px + width / 2, top: py - height, bottom: py };
        case 'bottom':
          return { left: px - width / 2, right: px + width / 2, top: py, bottom: py + height };
        case 'left':
          return { left: px - width, right: px, top: py - height / 2, bottom: py + height / 2 };
        case 'right':
          return { left: px, right: px + width, top: py - height / 2, bottom: py + height / 2 };
        case 'top-left':
          return { left: px - width, right: px, top: py - height, bottom: py };
        case 'top-right':
          return { left: px, right: px + width, top: py - height, bottom: py };
        case 'bottom-left':
          return { left: px - width, right: px, top: py, bottom: py + height };
        case 'bottom-right':
          return { left: px, right: px + width, top: py, bottom: py + height };
        case 'left-top':
          return { left: px - width, right: px, top: py, bottom: py + height };
        case 'left-bottom':
          return { left: px - width, right: px, top: py - height, bottom: py };
        case 'right-top':
          return { left: px, right: px + width, top: py, bottom: py + height };
        case 'right-bottom':
        default:
          return { left: px, right: px + width, top: py - height, bottom: py };
      }
    };

    const margin = 4;
    const overflowScore = (b: { left: number; right: number; top: number; bottom: number }) => {
      const maxX = containerWidth - margin;
      const maxY = containerHeight - margin;
      const leftO = Math.max(0, margin - b.left);
      const rightO = Math.max(0, b.right - maxX);
      const topO = Math.max(0, margin - b.top);
      const bottomO = Math.max(0, b.bottom - maxY);
      return leftO + rightO + topO + bottomO;
    };

    const flipVertical = (s: Side): Side => {
      if (s === 'top') return 'bottom';
      if (s === 'bottom') return 'top';
      if (s.startsWith('top-')) return (`bottom-${s.slice(4)}` as Side);
      if (s.startsWith('bottom-')) return (`top-${s.slice(7)}` as Side);
      if (s.endsWith('-top')) return (`${s.slice(0, -4)}-bottom` as Side);
      if (s.endsWith('-bottom')) return (`${s.slice(0, -7)}-top` as Side);
      return s;
    };

    const flipHorizontal = (s: Side): Side => {
      if (s === 'left') return 'right';
      if (s === 'right') return 'left';
      if (s.startsWith('left-')) return (`right-${s.slice(5)}` as Side);
      if (s.startsWith('right-')) return (`left-${s.slice(6)}` as Side);
      if (s.endsWith('-left')) return (`${s.slice(0, -5)}-right` as Side);
      if (s.endsWith('-right')) return (`${s.slice(0, -6)}-left` as Side);
      return s;
    };

    // 优先翻转方向：当请求方向越界时，先尝试翻转（上下/左右/组合），选择越界最小的方案
    const candidates: Side[] = [];
    const pushUnique = (s: Side) => {
      if (!candidates.includes(s)) candidates.push(s);
    };

    // 先用请求方向计算一次，判断是否越界
    const requestedPlacement = placeForSide(requestedSide);
    const requestedBounds = boundsFor(requestedSide, requestedPlacement.x, requestedPlacement.y);
    const requestedOverflow = overflowScore(requestedBounds);

    let side: Side = requestedSide;
    let placement = requestedPlacement;

    if (requestedOverflow > 0) {
      // 先尝试翻转，再回退请求方向（用于兜底）
      pushUnique(flipVertical(requestedSide));
      pushUnique(flipHorizontal(requestedSide));
      pushUnique(flipHorizontal(flipVertical(requestedSide)));
      pushUnique(requestedSide);

      let bestSide = requestedSide;
      let bestPlacement = requestedPlacement;
      let bestScore = requestedOverflow;

      for (const c of candidates) {
        const p = placeForSide(c);
        const b = boundsFor(c, p.x, p.y);
        const score = overflowScore(b);
        if (score < bestScore) {
          bestScore = score;
          bestSide = c;
          bestPlacement = p;
        }
      }

      side = bestSide;
      placement = bestPlacement;
    }

    x = placement.x;
    y = placement.y;
    let transform = placement.transform;

    // 边缘避让：方向翻转后若仍超出容器，则将窗口整体平移回容器内（兜底）
    const bounds = boundsFor(side, x, y);

    // 计算需要的平移量，使窗口尽量完整落入容器内
    let dx = 0;
    let dy = 0;

    // 若窗口比容器还大，则只能尽量贴边展示
    const maxLeft = containerWidth - margin;
    const maxTop = containerHeight - margin;

    // X 方向修正
    if (bounds.left + dx < margin) {
      dx += margin - (bounds.left + dx);
    }
    if (bounds.right + dx > maxLeft) {
      dx -= (bounds.right + dx) - maxLeft;
    }

    // Y 方向修正
    if (bounds.top + dy < margin) {
      dy += margin - (bounds.top + dy);
    }
    if (bounds.bottom + dy > maxTop) {
      dy -= (bounds.bottom + dy) - maxTop;
    }

    // 应用平移修正：通过 transform 追加 translate，避免改变锚点 (x, y)
    if (dx !== 0 || dy !== 0) {
      transform = `${transform} translate(${dx}px, ${dy}px)`;
    }

    const shiftedBounds = {
      left: bounds.left + dx,
      right: bounds.right + dx,
      top: bounds.top + dy,
      bottom: bounds.bottom + dy,
    };

    // 设置最终位置
    domElement.style.left = `${x}px`;
    domElement.style.top = `${y}px`;
    domElement.style.transform = transform;
    domElement.style.display = 'block';

    // 更新箭头位置与朝向
    if (data.arrowEl && options.showArrow) {
      const arrow = data.arrowEl;
      const size = (options.arrowSize ?? 8) + 'px';
      const color = domElement.style.background || options.backgroundColor || '#ffffff';
      // 重置
      arrow.style.borderLeft = '0';
      arrow.style.borderRight = '0';
      arrow.style.borderTop = '0';
      arrow.style.borderBottom = '0';
      arrow.style.left = '';
      arrow.style.right = '';
      arrow.style.top = '';
      arrow.style.bottom = '';
      arrow.style.transform = '';

      const orientFromSide = (s: string): 'top' | 'bottom' | 'left' | 'right' => {
        if (s.startsWith('top')) return 'top';
        if (s.startsWith('bottom')) return 'bottom';
        if (s.startsWith('left')) return 'left';
        if (s.startsWith('right')) return 'right';
        return 'top';
      };

      const orient = orientFromSide(side);

      // 箭头对齐：基于锚点 (x,y) 在“平移后的窗口”中的相对位置动态计算
      const clampPercent = (p: number) => Math.max(10, Math.min(90, p));
      let alignPercent = 50;
      if (orient === 'top' || orient === 'bottom') {
        const p = ((x - shiftedBounds.left) / Math.max(1, width)) * 100;
        alignPercent = clampPercent(p);
      } else {
        const p = ((y - shiftedBounds.top) / Math.max(1, height)) * 100;
        alignPercent = clampPercent(p);
      }

      if (orient === 'top') {
        arrow.style.left = `${alignPercent}%`;
        arrow.style.bottom = `-${size}`;
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderLeft = `${size} solid transparent`;
        arrow.style.borderRight = `${size} solid transparent`;
        arrow.style.borderTop = `${size} solid ${color}`;
      } else if (orient === 'bottom') {
        arrow.style.left = `${alignPercent}%`;
        arrow.style.top = `-${size}`;
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.borderLeft = `${size} solid transparent`;
        arrow.style.borderRight = `${size} solid transparent`;
        arrow.style.borderBottom = `${size} solid ${color}`;
      } else if (orient === 'left') {
        arrow.style.right = `-${size}`;
        arrow.style.top = `${alignPercent}%`;
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.borderTop = `${size} solid transparent`;
        arrow.style.borderBottom = `${size} solid transparent`;
        arrow.style.borderLeft = `${size} solid ${color}`;
      } else {
        arrow.style.left = `-${size}`;
        arrow.style.top = `${alignPercent}%`;
        arrow.style.transform = 'translateY(-50%)';
        arrow.style.borderTop = `${size} solid transparent`;
        arrow.style.borderBottom = `${size} solid transparent`;
        arrow.style.borderRight = `${size} solid ${color}`;
      }
    }
  }

  /**
   * 创建 DOM 元素
   */
  private createDomElement(options: InfoWindowOptions, entity: Entity): HTMLElement {
    const el = document.createElement('div');
    el.className = options.className ?? 'cesium-info-window';
    const baseStyle: Partial<CSSStyleDeclaration> = {
      position: 'absolute',
      background: options.backgroundColor ?? '#ffffff',
      color: options.color ?? '',
      font: options.font ?? '',
      borderRadius: '6px',
      padding: '8px 12px',
      pointerEvents: 'auto',
      transform: 'translate(-50%, -100%)',
      zIndex: '1000',
      maxWidth: '300px',
      wordBreak: 'break-word',
    };
    Object.assign(el.style, baseStyle);

    if (options.width) el.style.width = `${options.width}px`;
    if (options.height) el.style.height = `${options.height}px`;

    // 允许通过 options.style 覆盖默认样式
    if (options.style) {
      Object.assign(el.style, options.style);
    }

    // 箭头元素（按需创建）
    if (options.showArrow) {
      const arrow = document.createElement('div');
      arrow.className = 'cesium-info-window-arrow';
      arrow.style.position = 'absolute';
      arrow.style.width = '0';
      arrow.style.height = '0';
      el.appendChild(arrow);
    }

    // 内容区（单独管理，便于 updateContent 时保留关闭按钮等元素）
    const contentWrap = document.createElement('div');
    contentWrap.className = 'cesium-info-window-content';
    if (typeof options.content === 'string') {
      contentWrap.innerHTML = options.content;
    } else {
      contentWrap.appendChild(options.content);
    }
    el.appendChild(contentWrap);

    // 点击提升层级（点击关闭按钮不触发）
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cesium-info-window-close')) return;
      this.bringToFront(entity); // 注意：entity 在闭包中
      options.onClick?.(entity);
    });

    // 关闭按钮
    if (options.closable) {
      const btn = document.createElement('button');
      btn.className = 'cesium-info-window-close';
      btn.textContent = '×';
      btn.style.cssText = `
        position: absolute; top: 4px; right: 4px;
        background: none; border: none; font-size: 16px; cursor: pointer;
        padding: 0; line-height: 1; color: #999;
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hide(entity); // 注意：此处 entity 在闭包中
        options.onClose?.(entity);
      });
      el.appendChild(btn);
    }

    // 备注：onClick 的点击处理已在上方统一处理（bringToFront + options.onClick）。

    return el;
  }

  /**
   * 将指定 InfoWindow 置于最前
   */
  public bringToFront(entity: Entity): void {
    const data = (entity as any)[INFO_WINDOW_DATA_KEY] as InternalEntityData | undefined;
    if (!data) return;

    this.currentTopZIndex += 1;
    data.zIndex = this.currentTopZIndex;
    data.domElement.style.zIndex = String(data.zIndex);
  }

  /**
   * 添加信息窗口
   */
  public add(options: InfoWindowOptions): Entity {
    const merged = this.mergeOptions(options);
    const id = merged.id ?? `infowindow_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const position = this.convertPosition(merged.position);

    // 创建 Cesium 实体（仅用于定位，无图形）
    const entity = this.viewer.entities.add({
      id,
      show: merged.show !== false, // 默认显示
      position: new Cesium.ConstantPositionProperty(position),
    });

    // 创建 DOM
    const domElement = this.createDomElement(merged, entity);
    this.container.appendChild(domElement);

    // 绑定更新监听（支持节流，且在相机移动期间绕过节流以保证实时性）
    const interval = merged.updateInterval ?? this.defaultUpdateInterval ?? 0; // ms
    let last = 0;
    const cameraListener = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!this.isCameraMoving) {
        if (interval > 0 && now - last < interval) return;
        last = now;
      } else {
        // 相机移动期间强制实时更新
        last = now;
      }
      this.updateDomPosition(entity);
    };
    const postRenderListener = this.viewer.scene.postRender.addEventListener(cameraListener);

    const data: InternalEntityData = {
      domElement,
      options: { ...merged },
      cameraListener,
      postRenderListener,
      zIndex: ++this.currentTopZIndex, // 自动分配更高 zIndex
      lastUpdate: last,
      arrowEl: domElement.querySelector('.cesium-info-window-arrow') as HTMLElement | null,
    };

    domElement.style.zIndex = String(data.zIndex);

    (entity as any)[INFO_WINDOW_DATA_KEY] = data;
    (entity as any)['_overlayType'] = 'infoWindow';
    this.entityMap.set(id, data);

    // 初始定位
    this.updateDomPosition(entity);

    return entity;
  }

  /**
   * 更新位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const cartPos = this.convertPosition(position);
    if (entity.position && Cesium.defined(entity.position)) {
      (entity.position as Cesium.ConstantPositionProperty).setValue(cartPos);
    }
    this.updateDomPosition(entity);
  }

  /**
   * 更新内容
   */
  public updateContent(entity: Entity, content: string | HTMLElement): void {
    const data = (entity as any)[INFO_WINDOW_DATA_KEY] as InternalEntityData | undefined;
    if (!data) return;
    const contentWrap = data.domElement.querySelector('.cesium-info-window-content') as HTMLElement | null;
    if (!contentWrap) return;
    contentWrap.innerHTML = '';
    if (typeof content === 'string') {
      contentWrap.innerHTML = content;
    } else {
      contentWrap.appendChild(content);
    }
  }

  /**
   * 显示/隐藏
   */
  public setVisible(entity: Entity, visible: boolean): void {
    const data = (entity as any)[INFO_WINDOW_DATA_KEY] as InternalEntityData | undefined;
    if (!data) return;
    entity.show = visible;
    if (visible) {
      this.updateDomPosition(entity);
    } else {
      data.domElement.style.display = 'none';
    }
  }

  public show(entity: Entity): void {
    this.setVisible(entity, true);
  }

  public hide(entity: Entity): void {
    this.setVisible(entity, false);
  }

  /**
   * 移除信息窗口（清理 DOM + 监听器 + 实体）
   */
  public remove(entity: Entity): void {
    const id = entity.id;
    const data = this.entityMap.get(id);
    if (!data) return;

    // 清理监听
    data.postRenderListener();
    
    // 移除 DOM
    if (this.container.contains(data.domElement)) {
      this.container.removeChild(data.domElement);
    }

    // 移除实体
    this.viewer.entities.remove(entity);

    // 清理引用
    this.entityMap.delete(id);
    delete (entity as any)[INFO_WINDOW_DATA_KEY];
  }

  /**
   * 销毁整个管理器（清理所有 infoWindow）
   */
  public destroy(): void {
    // 移除 camera move 监听
    if (this.cameraMoveStartListener) {
      this.cameraMoveStartListener();
      this.cameraMoveStartListener = undefined;
    }
    if (this.cameraMoveEndListener) {
      this.cameraMoveEndListener();
      this.cameraMoveEndListener = undefined;
    }

    const entities = this.viewer.entities.values.slice(); // 使用数组并遍历副本，避免迭代过程中集合变化
    for (const entity of entities) {
      if ((entity as any)[INFO_WINDOW_DATA_KEY]) {
        this.remove(entity);
      }
    }
    this.entityMap.clear();
  }
}