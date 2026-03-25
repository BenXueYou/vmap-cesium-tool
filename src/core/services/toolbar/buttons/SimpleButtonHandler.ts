/**
 * 简单按钮处理器
 * 用于处理不需要菜单的简单按钮（如 2D/3D、定位、缩放、全屏等）
 */

import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';

/**
 * 简单按钮配置
 */
export interface SimpleButtonConfig {
  /** 按钮 ID */
  id: string;
  
  /** 按钮标题 */
  title: string;
  
  /** 标题翻译键 */
  titleKey?: string;
  
  /** 图标 */
  icon: string | HTMLElement;
  
  /** 激活态图标 */
  activeIcon?: string | HTMLElement;
  
  /** 点击回调 */
  onClick?: () => void;
  
  /** 是否需要激活状态 */
  toggleable?: boolean;
}

/**
 * 地图控制器接口
 */
export interface MapControllerLike {
  toggle2D3D?: (button: HTMLElement) => void;
  resetLocation?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  toggleFullscreen?: () => void;
}

/**
 * 简单按钮处理器类
 */
export class SimpleButtonHandler extends BaseButtonHandler {
  readonly id: string;
  
  private config: SimpleButtonConfig;
  private mapController?: MapControllerLike;

  /**
   * 构造函数
   * @param config 按钮配置
   * @param viewer Cesium Viewer 实例
   * @param mapController 地图控制器
   * @param i18n 国际化实例
   * @param useI18n 是否使用国际化
   */
  constructor(
    config: SimpleButtonConfig,
    viewer: any,
    mapController?: MapControllerLike,
    i18n?: any,
    useI18n: boolean = true
  ) {
    super(config.id, viewer, i18n, useI18n);
    this.id = config.id; // 显式初始化 id
    this.config = config;
    this.mapController = mapController;
  }

  /**
   * 初始化按钮
   * @param button 按钮实例
   */
  initialize(button: ToolbarButton): void {
    this.button = button;
    
    // 设置标题
    if (this.config.titleKey && this.useI18n && this.i18n) {
      this.i18n.bindElement(button.getElement(), this.config.titleKey, 'title');
    } else {
      button.setAttribute('title', this.config.title);
    }
  }

  /**
   * 处理点击事件
   */
  handleClick(): void {
    const { id, onClick } = this.config;

    // 优先使用自定义回调
    if (onClick) {
      onClick();
      return;
    }

    // 使用地图控制器的默认行为
    switch (id) {
      case 'view2d3d':
        this.mapController?.toggle2D3D?.(this.button?.getElement() as HTMLElement);
        break;
      case 'location':
        this.mapController?.resetLocation?.();
        break;
      case 'zoom-in':
        this.mapController?.zoomOut?.();
        break;
      case 'zoom-out':
        this.mapController?.zoomIn?.();
        break;
      case 'fullscreen':
        this.mapController?.toggleFullscreen?.();
        break;
    }
  }

  /**
   * 销毁处理器
   */
  destroy(): void {
    this.button = null;
  }

  /**
   * 设置地图控制器
   * @param controller 地图控制器
   */
  setMapController(controller: MapControllerLike): void {
    this.mapController = controller;
  }

  /**
   * 切换激活状态
   */
  toggleActive(): void {
    if (this.config.toggleable && this.button) {
      this.button.toggleActive();
    }
  }

  /**
   * 设置激活状态
   * @param active 是否激活
   */
  setActive(active: boolean): void {
    if (!this.config.toggleable || !this.button) return;
    
    if (active) {
      this.button.activate();
    } else {
      this.button.deactivate();
    }
  }
}

/**
 * 创建简单按钮处理器的工厂函数
 */
export function createSimpleButtonHandler(
  config: SimpleButtonConfig,
  viewer: any,
  mapController?: MapControllerLike,
  i18n?: any,
  useI18n?: boolean
): SimpleButtonHandler {
  return new SimpleButtonHandler(config, viewer, mapController, i18n, useI18n);
}