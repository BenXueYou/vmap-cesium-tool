import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * InfoWindow 配置选项
 */
export interface InfoWindowOptions extends BaseOverlayOptions {
  /** 内容（HTML 字符串或 DOM 元素） */
  content: string | HTMLElement;
  /** 宽度（像素） */
  width?: number;
  /** 高度（像素） */
  height?: number;
  /** 像素偏移 */
  pixelOffset?: Cesium.Cartesian2;
  /** 是否显示（默认 true） */
  show?: boolean;
  /** 是否可关闭 */
  closable?: boolean;
  /** 关闭回调 */
  onClose?: (entity: Entity) => void;
  /** 背景颜色 */
  backgroundColor?: string;
  /** 文字颜色 */
  color?: string;
  /** 字体 */
  font?: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: Partial<CSSStyleDeclaration>;
  /** 是否显示箭头（默认 false） */
  showArrow?: boolean;
  /** 箭头大小（像素，默认 8） */
  arrowSize?: number;
  /** 位置偏移方向（默认 'top'） */
  positionOffset?: 'top' | 'bottom' | 'left' | 'right';
}

interface InternalInfoWindowData {
  domElement: HTMLElement;
  options: InfoWindowOptions;
  cameraListener: () => void;
  postRenderListener: Cesium.Event.RemoveCallback;
}

const INFO_WINDOW_DATA_KEY = '_infoWindowData';

/**
 * InfoWindow 信息窗口类
 * 
 * 用于在地图上创建 HTML 信息窗口，支持自定义内容、样式和位置。
 * 
 * @example
 * ```typescript
 * const infoWindow = new InfoWindow(viewer, {
 *   position: [120.1, 30.2],
 *   content: '<h3>杭州市</h3><p>浙江省省会</p>',
 *   width: 200,
 *   closable: true
 * });
 * viewer.entities.add(infoWindow.getEntity());
 * ```
 */
export class InfoWindow extends BaseOverlay {
  private infoOptions: InfoWindowOptions;
  private container: HTMLElement;
  private internalData?: InternalInfoWindowData;

  constructor(viewer: Viewer, options: InfoWindowOptions, container?: HTMLElement) {
    super(viewer, options);
    this.container = container || (viewer.container as HTMLElement);
    this.infoOptions = this.mergeOptions(options);
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'infoWindow';
    
    // 创建 DOM 元素并添加到容器
    const domElement = this.createDomElement(this.infoOptions, this.entity);
    this.container.appendChild(domElement);
    
    // 绑定更新监听
    this.setupListeners(domElement, this.infoOptions);
    
    // 存储内部数据
    this.internalData = {
      domElement,
      options: this.infoOptions,
      cameraListener: () => this.updateDomPosition(),
      postRenderListener: viewer.scene.postRender.addEventListener(() => {
        this.updateDomPosition();
      }),
    };
    
    (this.entity as any)[INFO_WINDOW_DATA_KEY] = this.internalData;
    
    // 初始定位
    this.updateDomPosition();
  }

  /**
   * 合并选项与默认值
   */
  private mergeOptions(options: InfoWindowOptions): InfoWindowOptions {
    const defaults: Partial<InfoWindowOptions> = {
      show: true,
      className: 'cesium-info-window',
      showArrow: false,
      arrowSize: 8,
      positionOffset: 'top',
      backgroundColor: '#ffffff',
    };
    return { ...defaults, ...options } as InfoWindowOptions;
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
      color: options.color ?? '#000000',
      font: options.font ?? '14px sans-serif',
      borderRadius: '6px',
      padding: '8px 12px',
      pointerEvents: 'auto',
      transform: 'translate(-50%, -100%)',
      zIndex: '1000',
      maxWidth: '300px',
      wordBreak: 'break-word',
      display: 'none',
    };
    Object.assign(el.style, baseStyle);

    if (options.width) el.style.width = `${options.width}px`;
    if (options.height) el.style.height = `${options.height}px`;

    if (options.style) {
      Object.assign(el.style, options.style);
    }

    // 箭头元素
    if (options.showArrow) {
      const arrow = document.createElement('div');
      arrow.className = 'cesium-info-window-arrow';
      arrow.style.position = 'absolute';
      arrow.style.width = '0';
      arrow.style.height = '0';
      el.appendChild(arrow);
    }

    // 内容区
    const contentWrap = document.createElement('div');
    contentWrap.className = 'cesium-info-window-content';
    if (typeof options.content === 'string') {
      contentWrap.innerHTML = options.content;
    } else {
      contentWrap.appendChild(options.content);
    }
    el.appendChild(contentWrap);

    // 点击提升层级
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cesium-info-window-close')) return;
      el.style.zIndex = String(Number(el.style.zIndex) + 1);
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
        this.hide();
        options.onClose?.(entity);
      });
      el.appendChild(btn);
    }

    return el;
  }

  /**
   * 设置监听器
   */
  private setupListeners(domElement: HTMLElement, options: InfoWindowOptions): void {
    // 监听器已在构造函数中通过 postRender 添加
  }

  /**
   * 将世界坐标转换为相对于 container 的 CSS 像素坐标
   */
  private getContainerPixelPosition(worldPos: Cesium.Cartesian3): { x: number; y: number } | null {
    const scene = this.viewer.scene;
    const canvas = scene.canvas;

    const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(scene, worldPos);
    if (!screenPos || !Cesium.defined(screenPos)) return null;

    if (isNaN(screenPos.x) || isNaN(screenPos.y)) return null;

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    const x = screenPos.x - containerRect.left;
    const y = screenPos.y - containerRect.top;

    return { x, y };
  }

  /**
   * 更新 DOM 位置
   */
  private updateDomPosition(): void {
    if (!this.internalData) return;
    
    const { domElement, options } = this.internalData;
    const worldPos = this.entity.position?.getValue(this.viewer.clock.currentTime) as Cesium.Cartesian3 | undefined;
    
    if (!worldPos || this.entity.show === false || options.show === false) {
      domElement.style.display = 'none';
      return;
    }

    // 相机背面检测
    const cam = this.viewer.camera;
    const toPoint = Cesium.Cartesian3.subtract(worldPos, cam.positionWC, new Cesium.Cartesian3());
    if (Cesium.Cartesian3.dot(toPoint, cam.directionWC) <= 0) {
      domElement.style.display = 'none';
      return;
    }

    const pixelPos = this.getContainerPixelPosition(worldPos);
    if (!pixelPos) {
      domElement.style.display = 'none';
      return;
    }

    let { x, y } = pixelPos;

    // 应用 pixelOffset
    if (options.pixelOffset) {
      x += options.pixelOffset.x;
      y -= options.pixelOffset.y;
    }

    // 获取元素尺寸
    domElement.style.visibility = 'hidden';
    domElement.style.display = 'block';
    const rect = domElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // 根据位置偏移方向计算最终位置
    const offset = options.positionOffset || 'top';
    let transform = 'translate(-50%, -100%)';
    
    if (offset === 'bottom') {
      y = pixelPos.y + 10;
      transform = 'translate(-50%, 0)';
    } else if (offset === 'left') {
      x = pixelPos.x - 10;
      y = pixelPos.y;
      transform = 'translate(-100%, -50%)';
    } else if (offset === 'right') {
      x = pixelPos.x + 10;
      y = pixelPos.y;
      transform = 'translate(0, -50%)';
    } else {
      y = pixelPos.y - 10;
    }

    domElement.style.left = `${x}px`;
    domElement.style.top = `${y}px`;
    domElement.style.transform = transform;
    domElement.style.visibility = '';
  }

  /**
   * 更新 InfoWindow 配置
   */
  update(options: Partial<InfoWindowOptions>): void {
    if (this.destroyed) return;
    
    this.infoOptions = { ...this.infoOptions, ...options };
    
    if (!this.internalData) return;
    
    const { domElement } = this.internalData;
    
    // 更新内容
    if (options.content !== undefined) {
      const contentWrap = domElement.querySelector('.cesium-info-window-content') as HTMLElement | null;
      if (contentWrap) {
        contentWrap.innerHTML = '';
        if (typeof options.content === 'string') {
          contentWrap.innerHTML = options.content;
        } else {
          contentWrap.appendChild(options.content);
        }
      }
    }
    
    // 更新样式
    if (options.backgroundColor !== undefined) {
      domElement.style.background = options.backgroundColor;
    }
    if (options.color !== undefined) {
      domElement.style.color = options.color;
    }
    if (options.width !== undefined) {
      domElement.style.width = `${options.width}px`;
    }
    if (options.height !== undefined) {
      domElement.style.height = `${options.height}px`;
    }
    
    // 更新可见性
    if (options.show !== undefined) {
      this.entity.show = options.show;
    }
    
    // 更新位置
    if (options.position !== undefined) {
      const position = this.toCartesian3(options.position);
      if (position) {
        this.entity.position = new Cesium.ConstantPositionProperty(position);
      }
    }
    
    this.updateDomPosition();
  }

  /**
   * 更新位置
   */
  setPosition(position: OverlayPosition): void {
    if (this.destroyed) return;
    const cartesian = this.toCartesian3(position);
    if (cartesian) {
      this.entity.position = new Cesium.ConstantPositionProperty(cartesian);
      this.updateDomPosition();
    }
  }

  /**
   * 更新内容
   */
  setContent(content: string | HTMLElement): void {
    if (this.destroyed || !this.internalData) return;
    this.infoOptions.content = content;
    
    const contentWrap = this.internalData.domElement.querySelector('.cesium-info-window-content') as HTMLElement | null;
    if (contentWrap) {
      contentWrap.innerHTML = '';
      if (typeof content === 'string') {
        contentWrap.innerHTML = content;
      } else {
        contentWrap.appendChild(content);
      }
    }
  }

  /**
   * 显示
   */
  show(): void {
    if (this.destroyed) return;
    this.entity.show = true;
    this.infoOptions.show = true;
    this.updateDomPosition();
  }

  /**
   * 隐藏
   */
  hide(): void {
    if (this.destroyed) return;
    this.entity.show = false;
    this.infoOptions.show = false;
    if (this.internalData) {
      this.internalData.domElement.style.display = 'none';
    }
  }

  /**
   * 从场景中移除信息窗口
   */
  remove(): void {
    if (this.destroyed) return;
    
    // 清理监听器
    if (this.internalData) {
      this.internalData.postRenderListener();
      
      // 移除 DOM
      if (this.container.contains(this.internalData.domElement)) {
        this.container.removeChild(this.internalData.domElement);
      }
    }
    
    // 调用父类方法移除 Entity
    super.remove();
    
    this.internalData = undefined;
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
}