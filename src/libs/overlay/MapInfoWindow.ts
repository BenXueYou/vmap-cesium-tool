import * as Cesium from 'cesium';
import type { Viewer, Entity, Cartesian3 } from 'cesium';
import type { OverlayPosition } from './types';

export interface InfoWindowOptions {
  position: OverlayPosition;
  content: string | HTMLElement;
  width?: number;
  height?: number;
  pixelOffset?: Cesium.Cartesian2; // x: right, y: up (in CSS pixels)
  show?: boolean;
  onClick?: (entity: Entity) => void;
  id?: string;
  closable?: boolean;
  onClose?: (entity: Entity) => void;
  backgroundColor?: string;
  color?: string;
  font?: string;
  hideWhenOutOfView?: boolean; // 新增：是否在视锥外自动隐藏（默认 true）
}

interface InternalEntityData {
  domElement: HTMLElement;
  options: InfoWindowOptions;
  cameraListener: () => void;
  postRenderListener: Cesium.Event.RemoveCallback;
  zIndex: number; // 新增：用于层级管理
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

  constructor(viewer: Viewer, container: HTMLElement) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('Container must be a valid HTMLElement');
    }
    this.viewer = viewer;
    this.container = container;
  }

  private convertPosition(position: OverlayPosition): Cartesian3 {
    if (position instanceof Cesium.Cartesian3) return position;
    if (Array.isArray(position)) {
      const [lon, lat, height = 0] = position;
      debugger;
      return Cesium.Cartesian3.fromDegrees(lon, lat, height);
    }
    throw new Error('Invalid position: expected [lon, lat] or [lon, lat, height] or Cartesian3');
  }

  /**
   * 将世界坐标转换为相对于 container 的 CSS 像素坐标
   */
  private getContainerPixelPosition(worldPos: Cartesian3): { x: number; y: number } | null {
    const scene = this.viewer.scene;
    const canvas = scene.canvas;

    // 1. 转换为绘制缓冲区像素坐标（WebGL 坐标系）
    const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(scene, worldPos);
    if (!screenPos || !Cesium.defined(screenPos)) return null;

    if (isNaN(screenPos.x) || isNaN(screenPos.y)) return null;

    // 2. 获取 canvas 和 container 的布局信息
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    // 3. 计算 CSS 像素（考虑设备像素比）
    const cssX = screenPos.x / (scene.drawingBufferWidth / canvasRect.width || window.devicePixelRatio || 1);
    const cssYFromTop = canvasRect.height - (screenPos.y / (scene.drawingBufferHeight / canvasRect.height || window.devicePixelRatio || 1));

    // 4. 转换为相对于 container 的坐标
    const x = cssX + (canvasRect.left - containerRect.left);
    const y = cssYFromTop + (canvasRect.top - containerRect.top);

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
    debugger;
    if (!worldPos) {
      domElement.style.display = 'none';
      return;
    }

    // 相机背面检测（可选）
    if (options.hideWhenOutOfView !== false) {
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

    // 应用原始 pixelOffset（CSS 像素）
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
    domElement.style.display = 'none'; // 暂不显示，等定位完成

    // 默认锚点：底部居中
    let transform = 'translate(-50%, -100%)';

    // 边界检测与避让逻辑
    const margin = 10; // 安全边距

    // 左右避让
    if (x - width / 2 < margin) {
      // 太靠左 → 改为左对齐
      x = margin + width / 2;
      transform = 'translate(0%, -100%)';
    } else if (x + width / 2 > containerWidth - margin) {
      // 太靠右 → 改为右对齐
      x = containerWidth - margin - width / 2;
      transform = 'translate(-100%, -100%)';
    }

    // 上下避让（主要防止顶部被裁剪）
    if (y - height < margin) {
      // 太靠上 → 改为显示在下方
      y = margin + height;
      transform = transform.replace('-100%', '0%'); // 从 bottom 改为 top
    }

    // 设置最终位置
    domElement.style.left = `${x}px`;
    domElement.style.top = `${y}px`;
    domElement.style.transform = transform;
    domElement.style.display = 'block';
  }

  /**
   * 创建 DOM 元素
   */
  private createDomElement(options: InfoWindowOptions, entity: Entity): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cesium-info-window';
    el.style.position = 'absolute';
    el.style.background = options.backgroundColor ?? '#ffffff';
    el.style.color = options.color ?? '';
    el.style.font = options.font ?? '';
    el.style.border = '1px solid #ccc';
    el.style.borderRadius = '6px';
    el.style.padding = '8px 12px';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
    el.style.pointerEvents = 'auto';
    el.style.transform = 'translate(-50%, -100%)';
    el.style.zIndex = '1000';
    el.style.maxWidth = '300px';
    el.style.wordBreak = 'break-word';

    if (options.width) el.style.width = `${options.width}px`;
    if (options.height) el.style.height = `${options.height}px`;

    // 内容
    if (typeof options.content === 'string') {
      el.innerHTML = options.content;
    } else {
      el.appendChild(options.content);
    }

    // 点击提升层级
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cesium-info-window-close')) {
        return; // 关闭按钮不触发提升
      }
      this.bringToFront(entity); // 注意：entity 在闭包中
      options.onClick?.(entity);
    });

    // 关闭按钮
    if (options.closable) {
      const btn = document.createElement('button');
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

    // 点击事件代理到实体
    if (options.onClick) {
      el.addEventListener('click', () => options.onClick?.(entity));
    }

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
    const id = options.id ?? `infowindow_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const position = this.convertPosition(options.position);

    // 创建 Cesium 实体（仅用于定位，无图形）
    const entity = this.viewer.entities.add({
      id,
      position: new Cesium.ConstantPositionProperty(position),
      show: options.show !== false,
    });

    // 创建 DOM
    const domElement = this.createDomElement(options, entity);
    this.container.appendChild(domElement);

    // 绑定更新监听
    const cameraListener = () => this.updateDomPosition(entity);
    const postRenderListener = this.viewer.scene.postRender.addEventListener(cameraListener);

    const data: InternalEntityData = {
      domElement,
      options: { ...options },
      cameraListener,
      postRenderListener,
      zIndex: ++this.currentTopZIndex, // 自动分配更高 zIndex
    };

    domElement.style.zIndex = String(data.zIndex);

    (entity as any)[INFO_WINDOW_DATA_KEY] = data;
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
    const el = data.domElement;
    el.innerHTML = '';
    if (typeof content === 'string') {
      el.innerHTML = content;
    } else {
      el.appendChild(content);
    }
    // 保留关闭按钮等结构？这里简单覆盖。如需保留，应单独管理 content 区域。
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
    const entities = this.viewer.entities.values.slice(); // use the array property and iterate over a copy
    for (const entity of entities) {
      if ((entity as any)[INFO_WINDOW_DATA_KEY]) {
        this.remove(entity);
      }
    }
    this.entityMap.clear();
  }
}