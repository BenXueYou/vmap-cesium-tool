import * as Cesium from 'cesium';
import type { Viewer, Entity, Cartesian3 } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

export interface InfoWindowOptions extends BaseOverlayOptions {
  content: string | HTMLElement;
  width?: number;
  height?: number;
  pixelOffset?: Cesium.Cartesian2;
  show?: boolean;
  closable?: boolean;
  onClose?: (entity: Entity) => void;
  backgroundColor?: string;
  color?: string;
  font?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  showArrow?: boolean;
  arrowSize?: number;
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
  hideWhenOutOfView?: boolean;
  anchorHeight?: number;
  anchorPixel?: number;
  tailGap?: number;
  updateInterval?: number;
}

interface InternalInfoWindowData {
  domElement: HTMLElement;
  options: InfoWindowOptions;
  postRenderListener: Cesium.Event.RemoveCallback;
  zIndex: number;
  arrowEl?: HTMLElement | null;
}

const BASE_Z_INDEX = 1000;
const INFO_WINDOW_DATA_KEY = '_infoWindowData';

export class InfoWindow extends BaseOverlay {
  private static nextZIndex = BASE_Z_INDEX;

  private infoOptions: InfoWindowOptions;
  private readonly container: HTMLElement;
  private internalData?: InternalInfoWindowData;
  private isCameraMoving = false;
  private cameraMoveStartListener?: Cesium.Event.RemoveCallback;
  private cameraMoveEndListener?: Cesium.Event.RemoveCallback;

  constructor(viewer: Viewer, options: InfoWindowOptions, container?: HTMLElement) {
    super(viewer, options);
    this.container = container || (viewer.container as HTMLElement);
    this.infoOptions = this.mergeOptions(options);

    this.entity.position = new Cesium.ConstantPositionProperty(this.toCartesian3(this.infoOptions.position)!);
    (this.entity as any)._overlayType = 'infoWindow';

    const domElement = this.createDomElement(this.infoOptions, this.entity);
    this.container.appendChild(domElement);

    this.cameraMoveStartListener = this.viewer.camera.moveStart.addEventListener(() => {
      this.isCameraMoving = true;
    });
    this.cameraMoveEndListener = this.viewer.camera.moveEnd.addEventListener(() => {
      this.isCameraMoving = false;
      this.updateDomPosition(true);
    });

    const interval = this.infoOptions.updateInterval ?? 0;
    let last = 0;
    const cameraListener = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!this.isCameraMoving && interval > 0 && now - last < interval) {
        return;
      }
      last = now;
      this.updateDomPosition(true);
    };

    const postRenderListener = this.viewer.scene.postRender.addEventListener(cameraListener);

    this.internalData = {
      domElement,
      options: { ...this.infoOptions },
      postRenderListener,
      zIndex: ++InfoWindow.nextZIndex,
      arrowEl: domElement.querySelector('.cesium-info-window-arrow') as HTMLElement | null,
    };

    domElement.style.zIndex = String(this.internalData.zIndex);
    (this.entity as any)[INFO_WINDOW_DATA_KEY] = this.internalData;
    this.updateDomPosition(true);
  }

  private mergeOptions(options: InfoWindowOptions): InfoWindowOptions {
    return {
      show: true,
      hideWhenOutOfView: true,
      anchorHeight: 10,
      tailGap: 8,
      updateInterval: 0,
      className: 'cesium-info-window',
      showArrow: false,
      arrowSize: 8,
      positionOffset: 'top',
      backgroundColor: '#ffffff',
      ...options,
      style: options.style ? { ...options.style } : undefined,
    };
  }

  private createDomElement(options: InfoWindowOptions, entity: Entity): HTMLElement {
    const el = document.createElement('div');
    el.className = options.className ?? 'cesium-info-window';

    Object.assign(el.style, {
      position: 'absolute',
      background: options.backgroundColor ?? '#ffffff',
      color: options.color ?? '',
      font: options.font ?? '',
      borderRadius: '6px',
      padding: '8px 12px',
      pointerEvents: 'auto',
      transform: 'translate(-50%, -100%)',
      zIndex: String(BASE_Z_INDEX),
      maxWidth: '300px',
      wordBreak: 'break-word',
      display: 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    if (options.width) el.style.width = `${options.width}px`;
    if (options.height) el.style.height = `${options.height}px`;
    if (options.style) Object.assign(el.style, options.style);

    if (options.showArrow) {
      const arrow = document.createElement('div');
      arrow.className = 'cesium-info-window-arrow';
      arrow.style.position = 'absolute';
      arrow.style.width = '0';
      arrow.style.height = '0';
      el.appendChild(arrow);
    }

    const contentWrap = document.createElement('div');
    contentWrap.className = 'cesium-info-window-content';
    if (typeof options.content === 'string') {
      contentWrap.innerHTML = options.content;
    } else {
      contentWrap.appendChild(options.content);
    }
    el.appendChild(contentWrap);

    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.cesium-info-window-close')) return;
      this.bringToFront();
      options.onClick?.(entity);
    });

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

  private getContainerPixelPosition(worldPos: Cartesian3): { x: number; y: number } | null {
    const scene = this.viewer.scene;
    const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(scene, worldPos);
    if (!screenPos || !Cesium.defined(screenPos)) return null;
    if (Number.isNaN(screenPos.x) || Number.isNaN(screenPos.y)) return null;
    const containerRect = this.container.getBoundingClientRect();
    return {
      x: screenPos.x - containerRect.left,
      y: screenPos.y - containerRect.top,
    };
  }

  private updateDomPosition(force = false): void {
    if (!this.internalData) return;

    const { domElement, options, arrowEl } = this.internalData;
    const worldPos = this.entity.position?.getValue(this.viewer.clock.currentTime) as Cartesian3 | undefined;
    if (!worldPos || this.entity.show === false || options.show === false) {
      domElement.style.display = 'none';
      return;
    }

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

    let x = pixelPos.x;
    let y = pixelPos.y;
    const tailGap = options.tailGap ?? 8;

    try {
      const basePixel = this.getContainerPixelPosition(worldPos);
      if (typeof options.anchorPixel === 'number' && basePixel) {
        x = basePixel.x;
        y = basePixel.y - options.anchorPixel;
      } else {
        const carto = Cesium.Cartographic.fromCartesian(worldPos);
        const anchorWorld = Cesium.Cartesian3.fromDegrees(
          Cesium.Math.toDegrees(carto.longitude),
          Cesium.Math.toDegrees(carto.latitude),
          carto.height + (options.anchorHeight ?? 10),
        );
        const anchorPixel = this.getContainerPixelPosition(anchorWorld);
        if (anchorPixel) {
          x = anchorPixel.x;
          y = anchorPixel.y;
        }
      }
    } catch {
      // ignore
    }

    if (options.pixelOffset) {
      x += options.pixelOffset.x;
      y -= options.pixelOffset.y;
    }

    const containerRect = this.container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    domElement.style.visibility = 'hidden';
    domElement.style.display = 'block';
    const rect = domElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    domElement.style.visibility = '';
    domElement.style.display = 'none';

    type Side = NonNullable<InfoWindowOptions['positionOffset']>;
    const requestedSide = (options.positionOffset ?? 'top') as Side;
    const anchorX = x;
    const anchorY = y;
    const baseX = pixelPos.x;
    const baseY = pixelPos.y;

    const placeForSide = (side: Side): { x: number; y: number; transform: string } => {
      switch (side) {
        case 'bottom':
          return { x: baseX, y: baseY + tailGap, transform: 'translate(-50%, 0%)' };
        case 'left':
          return { x: baseX - tailGap, y: baseY, transform: 'translate(-100%, -50%)' };
        case 'right':
          return { x: baseX + tailGap, y: baseY, transform: 'translate(0%, -50%)' };
        case 'top-left':
          return { x: baseX - tailGap, y: baseY - tailGap, transform: 'translate(-100%, -100%)' };
        case 'top-right':
          return { x: baseX + tailGap, y: baseY - tailGap, transform: 'translate(0%, -100%)' };
        case 'bottom-left':
          return { x: baseX - tailGap, y: baseY + tailGap, transform: 'translate(-100%, 0%)' };
        case 'bottom-right':
          return { x: baseX + tailGap, y: baseY + tailGap, transform: 'translate(0%, 0%)' };
        case 'left-top':
          return { x: baseX - tailGap, y: baseY - tailGap, transform: 'translate(-100%, 0%)' };
        case 'left-bottom':
          return { x: baseX - tailGap, y: baseY + tailGap, transform: 'translate(-100%, -100%)' };
        case 'right-top':
          return { x: baseX + tailGap, y: baseY - tailGap, transform: 'translate(0%, 0%)' };
        case 'right-bottom':
          return { x: baseX + tailGap, y: baseY + tailGap, transform: 'translate(0%, -100%)' };
        case 'top':
        default:
          return { x: anchorX, y: anchorY - tailGap, transform: 'translate(-50%, -100%)' };
      }
    };

    const boundsFor = (side: Side, px: number, py: number) => {
      switch (side) {
        case 'top': return { left: px - width / 2, right: px + width / 2, top: py - height, bottom: py };
        case 'bottom': return { left: px - width / 2, right: px + width / 2, top: py, bottom: py + height };
        case 'left': return { left: px - width, right: px, top: py - height / 2, bottom: py + height / 2 };
        case 'right': return { left: px, right: px + width, top: py - height / 2, bottom: py + height / 2 };
        case 'top-left': return { left: px - width, right: px, top: py - height, bottom: py };
        case 'top-right': return { left: px, right: px + width, top: py - height, bottom: py };
        case 'bottom-left': return { left: px - width, right: px, top: py, bottom: py + height };
        case 'bottom-right': return { left: px, right: px + width, top: py, bottom: py + height };
        case 'left-top': return { left: px - width, right: px, top: py, bottom: py + height };
        case 'left-bottom': return { left: px - width, right: px, top: py - height, bottom: py };
        case 'right-top': return { left: px, right: px + width, top: py, bottom: py + height };
        case 'right-bottom':
        default:
          return { left: px, right: px + width, top: py - height, bottom: py };
      }
    };

    const margin = 4;
    const overflowScore = (b: { left: number; right: number; top: number; bottom: number }) => (
      Math.max(0, margin - b.left) +
      Math.max(0, b.right - (containerWidth - margin)) +
      Math.max(0, margin - b.top) +
      Math.max(0, b.bottom - (containerHeight - margin))
    );

    const flipVertical = (side: Side): Side => {
      if (side === 'top') return 'bottom';
      if (side === 'bottom') return 'top';
      if (side.startsWith('top-')) return `bottom-${side.slice(4)}` as Side;
      if (side.startsWith('bottom-')) return `top-${side.slice(7)}` as Side;
      if (side.endsWith('-top')) return `${side.slice(0, -4)}-bottom` as Side;
      if (side.endsWith('-bottom')) return `${side.slice(0, -7)}-top` as Side;
      return side;
    };

    const flipHorizontal = (side: Side): Side => {
      if (side === 'left') return 'right';
      if (side === 'right') return 'left';
      if (side.startsWith('left-')) return `right-${side.slice(5)}` as Side;
      if (side.startsWith('right-')) return `left-${side.slice(6)}` as Side;
      if (side.endsWith('-left')) return `${side.slice(0, -5)}-right` as Side;
      if (side.endsWith('-right')) return `${side.slice(0, -6)}-left` as Side;
      return side;
    };

    let side = requestedSide;
    let placement = placeForSide(side);
    let bestScore = overflowScore(boundsFor(side, placement.x, placement.y));
    if (bestScore > 0) {
      const candidates = [
        flipVertical(requestedSide),
        flipHorizontal(requestedSide),
        flipHorizontal(flipVertical(requestedSide)),
        requestedSide,
      ];

      for (const candidate of candidates) {
        const nextPlacement = placeForSide(candidate);
        const score = overflowScore(boundsFor(candidate, nextPlacement.x, nextPlacement.y));
        if (score < bestScore) {
          bestScore = score;
          side = candidate;
          placement = nextPlacement;
        }
      }
    }

    const bounds = boundsFor(side, placement.x, placement.y);
    let dx = 0;
    let dy = 0;
    if (bounds.left < margin) dx += margin - bounds.left;
    if (bounds.right + dx > containerWidth - margin) dx -= (bounds.right + dx) - (containerWidth - margin);
    if (bounds.top < margin) dy += margin - bounds.top;
    if (bounds.bottom + dy > containerHeight - margin) dy -= (bounds.bottom + dy) - (containerHeight - margin);

    let transform = placement.transform;
    if (dx !== 0 || dy !== 0) {
      transform = `${transform} translate(${dx}px, ${dy}px)`;
    }

    domElement.style.left = `${placement.x}px`;
    domElement.style.top = `${placement.y}px`;
    domElement.style.transform = transform;
    domElement.style.display = 'block';

    if (arrowEl && options.showArrow) {
      const color = domElement.style.background || options.backgroundColor || '#ffffff';
      const size = `${options.arrowSize ?? 8}px`;
      const shiftedBounds = {
        left: bounds.left + dx,
        right: bounds.right + dx,
        top: bounds.top + dy,
        bottom: bounds.bottom + dy,
      };
      const clampPercent = (value: number) => Math.max(10, Math.min(90, value));
      const orient = side.startsWith('top') ? 'top'
        : side.startsWith('bottom') ? 'bottom'
        : side.startsWith('left') ? 'left'
        : side.startsWith('right') ? 'right'
        : side.endsWith('-top') ? side.split('-')[0]
        : side.endsWith('-bottom') ? side.split('-')[0]
        : 'top';

      arrowEl.style.borderLeft = '0';
      arrowEl.style.borderRight = '0';
      arrowEl.style.borderTop = '0';
      arrowEl.style.borderBottom = '0';
      arrowEl.style.left = '';
      arrowEl.style.right = '';
      arrowEl.style.top = '';
      arrowEl.style.bottom = '';

      if (orient === 'top' || orient === 'bottom') {
        const alignPercent = clampPercent(((placement.x - shiftedBounds.left) / Math.max(1, width)) * 100);
        if (orient === 'top') {
          arrowEl.style.left = `${alignPercent}%`;
          arrowEl.style.bottom = `-${size}`;
          arrowEl.style.transform = 'translateX(-50%)';
          arrowEl.style.borderLeft = `${size} solid transparent`;
          arrowEl.style.borderRight = `${size} solid transparent`;
          arrowEl.style.borderTop = `${size} solid ${color}`;
        } else {
          arrowEl.style.left = `${alignPercent}%`;
          arrowEl.style.top = `-${size}`;
          arrowEl.style.transform = 'translateX(-50%)';
          arrowEl.style.borderLeft = `${size} solid transparent`;
          arrowEl.style.borderRight = `${size} solid transparent`;
          arrowEl.style.borderBottom = `${size} solid ${color}`;
        }
      } else {
        const alignPercent = clampPercent(((placement.y - shiftedBounds.top) / Math.max(1, height)) * 100);
        if (orient === 'left') {
          arrowEl.style.right = `-${size}`;
          arrowEl.style.top = `${alignPercent}%`;
          arrowEl.style.transform = 'translateY(-50%)';
          arrowEl.style.borderTop = `${size} solid transparent`;
          arrowEl.style.borderBottom = `${size} solid transparent`;
          arrowEl.style.borderLeft = `${size} solid ${color}`;
        } else {
          arrowEl.style.left = `-${size}`;
          arrowEl.style.top = `${alignPercent}%`;
          arrowEl.style.transform = 'translateY(-50%)';
          arrowEl.style.borderTop = `${size} solid transparent`;
          arrowEl.style.borderBottom = `${size} solid transparent`;
          arrowEl.style.borderRight = `${size} solid ${color}`;
        }
      }
    }

    if (force) {
      this.viewer.scene.requestRender?.();
    }
  }

  private bringToFront(): void {
    if (!this.internalData) return;
    this.internalData.zIndex = ++InfoWindow.nextZIndex;
    this.internalData.domElement.style.zIndex = String(this.internalData.zIndex);
  }

  update(options: Partial<InfoWindowOptions>): void {
    if (this.destroyed || !this.internalData) return;
    this.infoOptions = this.mergeOptions({ ...this.infoOptions, ...options });
    this.internalData.options = { ...this.infoOptions };

    const { domElement } = this.internalData;
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

    if (options.backgroundColor !== undefined) domElement.style.background = options.backgroundColor;
    if (options.color !== undefined) domElement.style.color = options.color;
    if (options.font !== undefined) domElement.style.font = options.font;
    if (options.width !== undefined) domElement.style.width = `${options.width}px`;
    if (options.height !== undefined) domElement.style.height = `${options.height}px`;
    if (options.style !== undefined) Object.assign(domElement.style, options.style);
    if (options.position !== undefined) {
      const position = this.toCartesian3(options.position);
      if (position) {
        this.entity.position = new Cesium.ConstantPositionProperty(position);
      }
    }
    if (options.show !== undefined) {
      this.entity.show = options.show;
    }

    this.updateDomPosition(true);
  }

  setPosition(position: OverlayPosition): void {
    if (this.destroyed) return;
    const cartesian = this.toCartesian3(position);
    if (!cartesian) return;
    this.entity.position = new Cesium.ConstantPositionProperty(cartesian);
    this.updateDomPosition(true);
  }

  setContent(content: string | HTMLElement): void {
    this.update({ content });
  }

  setVisible(show: boolean): void {
    if (this.destroyed) return;
    this.entity.show = show;
    this.infoOptions.show = show;
    if (this.internalData) {
      this.internalData.options.show = show;
      if (!show) {
        this.internalData.domElement.style.display = 'none';
      } else {
        this.updateDomPosition(true);
      }
    }
  }

  show(): void {
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }

  remove(): void {
    if (this.destroyed) return;

    if (this.cameraMoveStartListener) {
      this.cameraMoveStartListener();
      this.cameraMoveStartListener = undefined;
    }
    if (this.cameraMoveEndListener) {
      this.cameraMoveEndListener();
      this.cameraMoveEndListener = undefined;
    }

    if (this.internalData) {
      this.internalData.postRenderListener();
      if (this.container.contains(this.internalData.domElement)) {
        this.container.removeChild(this.internalData.domElement);
      }
    }

    super.remove();
    this.internalData = undefined;
  }

  getPosition(): [number, number] | null {
    const pos = this.entity.position?.getValue(Cesium.JulianDate.now());
    return pos ? this.toLngLat(pos) : null;
  }
}
