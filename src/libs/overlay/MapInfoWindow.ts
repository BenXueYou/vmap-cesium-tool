import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3 } from "cesium";
import type { OverlayPosition } from './types';

/**
 * InfoWindow 选项
 */
export interface InfoWindowOptions {
  position: OverlayPosition;
  content: string | HTMLElement; // HTML内容
  width?: number;
  height?: number;
  pixelOffset?: Cesium.Cartesian2;
  show?: boolean;
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * InfoWindow 工具类
 */
export class MapInfoWindow {
  private viewer: Viewer;
  private entities: Cesium.EntityCollection;
  private infoWindowContainer: HTMLElement;

  constructor(viewer: Viewer, container: HTMLElement) {
    this.viewer = viewer;
    this.entities = viewer.entities;
    this.infoWindowContainer = container;
  }

  /**
   * 转换位置为 Cartesian3
   */
  private convertPosition(position: OverlayPosition): Cartesian3 {
    if (position instanceof Cesium.Cartesian3) {
      return position;
    }
    if (Array.isArray(position)) {
      if (position.length === 2) {
        return Cesium.Cartesian3.fromDegrees(position[0], position[1]);
      } else if (position.length === 3) {
        return Cesium.Cartesian3.fromDegrees(position[0], position[1], position[2]);
      }
    }
    throw new Error('Invalid position format');
  }

  /**
   * 更新信息窗口位置
   */
  private updateInfoWindowPosition(entity: Entity): void {
    const infoWindow = (entity as any)._infoWindow as HTMLElement | undefined;
    const position = (entity as any)._infoWindowPosition as Cartesian3 | undefined;
    
    if (!infoWindow || !position) return;

    // 将世界坐标转换为屏幕坐标
    const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(this.viewer.scene, position);
    
    if (screenPosition) {
      infoWindow.style.left = `${screenPosition.x}px`;
      infoWindow.style.top = `${screenPosition.y}px`;
      infoWindow.style.transform = 'translate(-50%, -100%)';
    }
  }

  /**
   * 添加 InfoWindow（信息窗口）
   */
  public add(options: InfoWindowOptions): Entity {
    const position = this.convertPosition(options.position);
    const id = options.id || `infowindow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建一个隐藏的实体用于定位
    const entity = this.entities.add({
      id,
      position,
      point: {
        pixelSize: 1,
        color: Cesium.Color.TRANSPARENT,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    // 创建信息窗口 DOM 元素
    const infoWindow = document.createElement('div');
    infoWindow.className = 'cesium-info-window';
    infoWindow.style.position = 'absolute';
    infoWindow.style.background = 'white';
    infoWindow.style.border = '1px solid #ccc';
    infoWindow.style.borderRadius = '4px';
    infoWindow.style.padding = '10px';
    infoWindow.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    infoWindow.style.pointerEvents = 'auto';
    infoWindow.style.display = options.show !== false ? 'block' : 'none';
    
    if (options.width) {
      infoWindow.style.width = `${options.width}px`;
    }
    if (options.height) {
      infoWindow.style.height = `${options.height}px`;
    }

    if (typeof options.content === 'string') {
      infoWindow.innerHTML = options.content;
    } else {
      infoWindow.appendChild(options.content);
    }

    this.infoWindowContainer.appendChild(infoWindow);
    (entity as any)._infoWindow = infoWindow;
    (entity as any)._infoWindowPosition = position;

    // 更新信息窗口位置
    this.updateInfoWindowPosition(entity);

    // 监听相机变化，更新信息窗口位置
    this.viewer.camera.changed.addEventListener(() => {
      this.updateInfoWindowPosition(entity);
    });

    if (options.onClick) {
      (entity as any)._onClick = options.onClick;
    }

    return entity;
  }

  /**
   * 更新 InfoWindow 位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const newPosition = this.convertPosition(position);
    entity.position = new Cesium.ConstantPositionProperty(newPosition);
    (entity as any)._infoWindowPosition = newPosition;
    this.updateInfoWindowPosition(entity);
  }

  /**
   * 更新 InfoWindow 内容
   */
  public updateContent(entity: Entity, content: string | HTMLElement): void {
    const infoWindow = (entity as any)._infoWindow as HTMLElement | undefined;
    if (!infoWindow) return;

    infoWindow.innerHTML = '';
    if (typeof content === 'string') {
      infoWindow.innerHTML = content;
    } else {
      infoWindow.appendChild(content);
    }
  }

  /**
   * 显示/隐藏 InfoWindow
   */
  public setVisible(entity: Entity, visible: boolean): void {
    const infoWindow = (entity as any)._infoWindow as HTMLElement | undefined;
    if (infoWindow) {
      infoWindow.style.display = visible ? 'block' : 'none';
    }
    entity.show = visible;
  }

  /**
   * 移除 InfoWindow DOM 元素
   */
  public removeDomElement(entity: Entity): void {
    const infoWindow = (entity as any)._infoWindow as HTMLElement | undefined;
    if (infoWindow && this.infoWindowContainer.contains(infoWindow)) {
      this.infoWindowContainer.removeChild(infoWindow);
    }
  }
}

