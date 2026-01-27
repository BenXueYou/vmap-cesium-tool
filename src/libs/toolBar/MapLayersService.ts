import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import type { MapType } from '../CesiumMapModel';

/**
 * 图层服务配置接口
 */
export interface MapLayersServiceConfig {
  mapTypes: MapType[];
  currentMapType: string;
  token: string;
  isNoFlyZoneChecked: boolean;
  isNoFlyZoneVisible: boolean;
  onMapTypeChange?: (mapTypeId: string) => void;
  onNoFlyZoneToggle?: (isChecked: boolean) => void;
  onShowNoFlyZones?: () => Promise<void> | void;
}

/**
 * 图层服务类
 * 负责处理地图图层切换相关的所有逻辑
 */
export class MapLayersService {
  private viewer: Viewer;
  private toolbarElement: HTMLElement;
  private config: MapLayersServiceConfig;
  private currentGeoWTFS: any = null;

  constructor(viewer: Viewer, toolbarElement: HTMLElement, config: MapLayersServiceConfig) {
    this.viewer = viewer;
    this.toolbarElement = toolbarElement;
    this.config = config;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<MapLayersServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // --- 屏幕边缘避让：防止图层菜单超出可视区域 ---
  adjustMenuPosition = (menu: HTMLElement) => {
    const menuRect = menu.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const margin = 10; // 添加一个固定的间距

    // 确保菜单不会超出屏幕底部
    if (menuRect.bottom > viewportHeight) {
      const overflow = menuRect.bottom - viewportHeight;
      const currentTop = parseFloat(menu.style.top || '0');
      const newTop = Math.max(margin, currentTop - overflow - margin);
      menu.style.top = `${newTop}px`;
    }

    // 确保菜单不会超出屏幕顶部
    const updatedRect = menu.getBoundingClientRect();
    if (updatedRect.top < 0) {
      const delta = -updatedRect.top;
      const currentTop = parseFloat(menu.style.top || '0');
      menu.style.top = `${currentTop + delta + margin}px`;
    }

    // 确保菜单不会超出屏幕右侧
    if (menuRect.right > viewportWidth) {
      const overflow = menuRect.right - viewportWidth;
      const currentRight = parseFloat(menu.style.marginRight || '0');
      menu.style.marginRight = `${currentRight + overflow + margin}px`;
    }

    // 确保菜单不会超出屏幕左侧
    if (menuRect.left < 0) {
      const delta = -menuRect.left;
      const currentRight = parseFloat(menu.style.marginRight || '0');
      menu.style.marginRight = `${currentRight - delta - margin}px`;
    }
  };

  /**
   * 切换图层菜单
   */
  public toggleLayers(buttonElement: HTMLElement): void {
    const existingMenu = this.toolbarElement.querySelector('.layers-menu');
    if (existingMenu) {
      return; // 如果菜单已存在，不重复创建
    }

    // 根据按钮在工具栏中的垂直偏移动态定位图层菜单
    const offsetTop = buttonElement.offsetTop;

    const menu = document.createElement('div');
    menu.className = 'layers-menu';
    menu.style.cssText = `
      position: absolute;
      right: 100%;
      top: ${offsetTop}px;
      margin-right: 8px;
      background: rgba(0, 40, 80, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      padding: 4px;
      max-width: 520px;
      z-index: 1001;
      display: flex;
      flex-direction: column;
    `;

    // 第一部分：地图类型
    const mapTypeSection = this.createMapTypeSection(menu);

    // 第二部分：叠加图层
    const overlaySection = this.createOverlaySection(menu);

    // 组装菜单
    menu.appendChild(mapTypeSection);
    menu.appendChild(overlaySection);

    this.toolbarElement.insertBefore(menu, buttonElement);

    // 在菜单插入 DOM 后立即调整位置
    setTimeout(() => this.adjustMenuPosition(menu), 0);

    // 鼠标离开菜单区域时关闭
    let closeTimeout: number | null = null;
    const closeMenu = () => {
      if (closeTimeout) {
        clearTimeout(closeTimeout);
      }
      closeTimeout = window.setTimeout(() => {
        menu.remove();
      }, 200); // 延迟关闭菜单
    };

    const cancelCloseMenu = () => {
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
    };

    // 监听菜单的鼠标事件
    menu.addEventListener('mouseleave', closeMenu);
    menu.addEventListener('mouseenter', cancelCloseMenu);
  }

  /**
   * 创建地图类型部分
   */
  private createMapTypeSection(menu: HTMLElement): HTMLElement {
    const mapTypeSection = document.createElement('div');
    mapTypeSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: transparent;
    `;

    // 地图类型标题栏
    const mapTypeHeader = document.createElement('div');
    mapTypeHeader.textContent = '地图类型';
    mapTypeHeader.style.cssText = `
      display: flex;
      width: 100%;
      justify-content: flex-start;
      align-items: center;
      text-align: left;
      font-weight: bold;
      font-size: 14px;
      color: #fff;
    ";`
    // 地图类型网格容器
    const mapTypeGrid = document.createElement('div');
    mapTypeGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    `;

    this.config.mapTypes.forEach(mapType => {
      const mapTypeItem = this.createMapTypeItem(mapType, menu);
      mapTypeGrid.appendChild(mapTypeItem);
    });

    mapTypeSection.appendChild(mapTypeHeader);
    mapTypeSection.appendChild(mapTypeGrid);

    return mapTypeSection;
  }

  /**
   * 创建地图类型项
   */
  private createMapTypeItem(mapType: MapType, menu: HTMLElement): HTMLElement {
    const mapTypeItem = document.createElement('div');
    const isCurrentType = mapType.id === this.config.currentMapType;
    mapTypeItem.className = 'layers-map-type-item';
    mapTypeItem.style.cssText = `
      width: 88px;
      height: 56px;
      position: relative;
      cursor: pointer;
      border-radius: 2px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s, border-color 0.2s;
      background-color: transparent;
      ${isCurrentType ? 'box-shadow: 0 2px 8px rgba(25, 118, 210, 0.5); border: 2px solid #1976d2;' : 'border: 2px solid transparent;'}
    `;

    const thumbnail = document.createElement('img');
    thumbnail.src = mapType.thumbnail;
    thumbnail.className = 'layers-thumbnail';
    thumbnail.style.cssText = `
      width: 100%;
      height: auto;
      display: block;
    `;

    const label = document.createElement('div');
    label.textContent = mapType.name;
    label.className = 'layers-label';
    label.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      left: 0;
      font-size: 12px;
      color: #fff;
      padding: 4px 0;
      text-align: right;
      padding-right: 2px;
      background: rgba(0, 0, 0, 0.3);
    `;

    // 勾选标记
    if (isCurrentType) {
      const checkmark = document.createElement('div');
      checkmark.innerHTML = '✓';
      checkmark.className = 'layers-checkmark';
      checkmark.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        width: 20px;
        height: 20px;
        background: #1976d2;
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        z-index: 10;
      `;
      mapTypeItem.appendChild(checkmark);
    }

    mapTypeItem.appendChild(thumbnail);
    mapTypeItem.appendChild(label);

    mapTypeItem.addEventListener('mouseenter', () => {
      mapTypeItem.style.transform = 'scale(1.05)';
      mapTypeItem.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
      mapTypeItem.style.borderColor = '#023C61';
      mapTypeItem.style.backgroundColor = '#023C61';
    });

    mapTypeItem.addEventListener('mouseleave', () => {
      mapTypeItem.style.transform = 'scale(1)';
      if (!isCurrentType) {
        mapTypeItem.style.boxShadow = 'none';
        mapTypeItem.style.borderColor = 'transparent';
        mapTypeItem.style.backgroundColor = 'transparent';
      }
    });

    mapTypeItem.addEventListener('click', () => {
      this.switchMapType(mapType.id);
      menu.remove();
    });

    return mapTypeItem;
  }

  /**
   * 创建叠加图层部分
   */
  private createOverlaySection(menu: HTMLElement): HTMLElement {
    const overlaySection = document.createElement('div');
    overlaySection.style.cssText = `
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      background: transparent;
    `;

    const overlayTitle = document.createElement('div');
    overlayTitle.textContent = '叠加图层';
    overlayTitle.style.cssText = `
      font-weight: bold;
      font-size: 14px;
      color: #fff;
      margin-bottom: 4px;
    `;
    overlaySection.appendChild(overlayTitle);

    // 叠加图层选项
    const overlayOptions = [
      { id: 'airport', name: '机场禁飞区', icon: '🔴' }
      // 可以添加更多叠加图层选项
    ];

    overlayOptions.forEach(option => {
      const overlayItem = this.createOverlayItem(option);
      overlaySection.appendChild(overlayItem);
    });

    return overlaySection;
  }

  /**
   * 创建叠加图层项
   */
  private createOverlayItem(option: { id: string; name: string; icon: string }): HTMLElement {
    const overlayItem = document.createElement('div');
    overlayItem.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border-radius: 2px;
      cursor: pointer;
      padding-left: 0;
      transition: background-color 0.2s;
    `;

    const checkbox = document.createElement('div');
    const isDefaultChecked = this.config.isNoFlyZoneChecked;
    checkbox.style.cssText = `
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 2px;
      background: ${isDefaultChecked ? '#023C61' : 'transparent'};
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // 如果是默认勾选，设置勾选标记
    if (isDefaultChecked) {
      checkbox.innerHTML = '✓';
      checkbox.style.color = '#ffffff';
      checkbox.style.fontWeight = 'bold';
      checkbox.style.fontSize = '12px';
    }

    const icon = document.createElement('span');
    icon.textContent = option.icon;
    icon.style.cssText = `
      font-size: 12px;
      display: flex;
      align-items: center;
    `;

    const name = document.createElement('span');
    name.textContent = option.name;
    name.style.cssText = `
      font-size: 14px;
      color: #fff;
    `;

    overlayItem.appendChild(checkbox);
    overlayItem.appendChild(icon);
    overlayItem.appendChild(name);

    overlayItem.addEventListener('mouseenter', () => {
      overlayItem.style.backgroundColor = '#023C61';
    });

    overlayItem.addEventListener('mouseleave', () => {
      overlayItem.style.backgroundColor = 'transparent';
    });

    overlayItem.addEventListener('click', () => {
      const isChecked = this.config.isNoFlyZoneChecked;
      const newChecked = !isChecked;

      // 更新复选框状态
      if (newChecked) {
        checkbox.style.background = '#023C61';
        checkbox.innerHTML = '✓';
        checkbox.style.color = '#ffffff';
        checkbox.style.fontWeight = 'bold';
        checkbox.style.fontSize = '12px';
      } else {
        checkbox.style.background = 'transparent';
        checkbox.innerHTML = '';
      }

      // 更新配置
      this.config.isNoFlyZoneChecked = newChecked;

      // 触发回调
      if (this.config.onNoFlyZoneToggle) {
        this.config.onNoFlyZoneToggle(newChecked);
      }
    });

    return overlayItem;
  }

  /**
   * 切换地图类型
   */
  public switchMapType(mapTypeId: string): void {
    const mapType = this.config.mapTypes.find(mt => mt.id === mapTypeId);
    if (!mapType) return;

    // 保存当前相机状态
    const currentCameraState = {
      position: this.viewer.camera.position.clone(),
      heading: this.viewer.camera.heading,
      pitch: this.viewer.camera.pitch,
      roll: this.viewer.camera.roll,
      height: this.viewer.camera.positionCartographic.height
    };

    // 清理之前的三维地名服务实例
    if (this.currentGeoWTFS) {
      try {
        if (typeof this.currentGeoWTFS.destroy === 'function') {
          this.currentGeoWTFS.destroy();
        } else if (typeof this.currentGeoWTFS.remove === 'function') {
          this.currentGeoWTFS.remove();
        }
      } catch (error) {
        console.warn('清理三维地名服务失败:', error);
      }
      this.currentGeoWTFS = null;
    }

    // 移除当前图层
    this.viewer.imageryLayers.removeAll();

    // 添加新图层
    const layers = mapType.provider(this.config.token);
    layers.forEach((layer) => {
      this.viewer.imageryLayers.addImageryProvider(layer);
    });

    // 更新当前地图类型
    this.config.currentMapType = mapTypeId;

    // 触发回调
    if (this.config.onMapTypeChange) {
      this.config.onMapTypeChange(mapTypeId);
    }
  }

  /**
   * 获取当前地图类型
   */
  public getCurrentMapType(): string {
    return this.config.currentMapType;
  }

  /**
   * 关闭图层菜单
   */
  public closeLayersMenu(): void {
    const layersMenu = this.toolbarElement.querySelector('.layers-menu');
    if (layersMenu) {
      // 添加延迟关闭逻辑，避免鼠标短暂移出时关闭菜单
      let closeTimeout: number | null = null;
      const closeMenu = () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
        }
        closeTimeout = window.setTimeout(() => {
          layersMenu.remove();
        }, 200); // 延迟关闭菜单
      };
      const cancelCloseMenu = () => {
        if (closeTimeout) {
          clearTimeout(closeTimeout);
          closeTimeout = null;
        }
      };
      layersMenu.addEventListener('mouseleave', closeMenu);
      layersMenu.addEventListener('mouseenter', cancelCloseMenu);
      layersMenu.remove();
    }
  }

  /**
   * 销毁图层服务
   */
  public destroy(): void {
    this.closeLayersMenu();
    if (this.currentGeoWTFS) {
      try {
        if (typeof this.currentGeoWTFS.destroy === 'function') {
          this.currentGeoWTFS.destroy();
        } else if (typeof this.currentGeoWTFS.remove === 'function') {
          this.currentGeoWTFS.remove();
        }
      } catch (error) {
        console.warn('销毁三维地名服务失败:', error);
      }
      this.currentGeoWTFS = null;
    }
  }
}

