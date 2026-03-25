/**
 * 图层按钮处理器
 * 处理图层切换功能的按钮点击、菜单显示等逻辑
 */

import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';
import { BaseMenu } from '../menus/BaseMenu';

/**
 * 地图类型配置
 */
export interface MapTypeConfig {
  id: string;
  name: string;
  nameKey?: string;
  thumbnail?: string;
}

/**
 * 图层按钮处理器配置
 */
export interface LayersButtonHandlerOptions {
  /** 图层服务实例 */
  layersService?: any;
  
  /** 地图类型配置列表 */
  mapTypes?: MapTypeConfig[];
  
  /** 当前地图类型 */
  currentMapType?: string;
  
  /** 天地图 token */
  token?: string;
  
  /** 是否勾选禁飞区 */
  isNoFlyZoneChecked?: boolean;
  
  /** 地图类型改变回调 */
  onMapTypeChange?: (mapTypeId: string) => void;
  
  /** 显示禁飞区回调 */
  onShowNoFlyZones?: () => Promise<void>;
  
  /** 禁飞区切换回调 */
  onNoFlyZoneToggle?: (isChecked: boolean) => void;
}

/**
 * 图层按钮处理器类
 */
export class LayersButtonHandler extends BaseMenu {
  readonly id = 'layers';
  
  private options: LayersButtonHandlerOptions;
  private button: ToolbarButton | null = null;

  /**
   * 构造函数
   * @param toolbarElement 工具栏容器元素
   * @param options 配置选项
   * @param i18n 国际化实例
   * @param useI18n 是否使用国际化
   */
  constructor(
    toolbarElement: HTMLElement,
    options: LayersButtonHandlerOptions = {},
    i18n?: any,
    useI18n: boolean = true
  ) {
    super(toolbarElement, i18n, useI18n);
    this.options = options;
  }

  /**
   * 显示菜单
   * @param anchor 锚点元素
   */
  show(anchor: HTMLElement): void {
    if (this.isDestroyed) return;

    // 先隐藏现有菜单
    this.hide();

    // 创建图层菜单
    this.menuElement = this.createMenuContainer('layers-menu', {
      minWidth: '180px',
    });
    this.menuElement.style.position = 'absolute';
    this.menuElement.style.right = '100%';
    this.menuElement.style.marginRight = '8px';

    // 定位
    const offsetTop = anchor.offsetTop;
    this.menuElement.style.top = `${offsetTop}px`;

    // 添加地图类型选项
    const mapTypes = this.options.mapTypes || [];
    const currentType = this.options.currentMapType || 'img';

    mapTypes.forEach(mapType => {
      const item = this.createMapTypeItem(mapType, currentType);
      this.menuElement!.appendChild(item);
    });

    // 添加分隔线
    const separator = document.createElement('div');
    separator.style.cssText = `
      height: 1px;
      background: rgba(255, 255, 255, 0.2);
      margin: 4px 0;
    `;
    this.menuElement.appendChild(separator);

    // 添加禁飞区选项
    const noFlyZoneItem = this.createNoFlyZoneItem();
    this.menuElement.appendChild(noFlyZoneItem);

    // 添加到工具栏
    this.toolbarElement!.appendChild(this.menuElement);
    this.anchorElement = anchor;

    // 调整位置避免溢出
    this.adjustPosition();

    // 设置自动关闭
    this.setupAutoClose();
  }

  /**
   * 初始化按钮
   * @param button 按钮实例
   */
  initialize(button: ToolbarButton): void {
    this.button = button;
    
    // 设置按钮标题
    if (this.useI18n && this.i18n) {
      this.i18n.bindElement(button.getElement(), 'toolbar.layers', 'title');
    } else {
      button.setAttribute('title', '图层切换');
    }
  }

  /**
   * 处理点击事件
   */
  handleClick(): void {
    if (!this.toolbarElement || !this.button) return;

    const buttonElement = this.button.getElement();
    this.toggle(buttonElement);
  }

  /**
   * 处理鼠标进入事件
   */
  handleMouseEnter(): void {
    // 可以在这里添加悬停提示
  }

  /**
   * 处理鼠标离开事件
   */
  handleMouseLeave(): void {
    // 延迟关闭菜单，给用户时间移动到菜单上
    if (this.menuElement) {
      setTimeout(() => {
        if (this.menuElement && !this.menuElement.matches(':hover')) {
          this.hide();
        }
      }, 100);
    }
  }

  /**
   * 销毁处理器
   */
  destroy(): void {
    super.destroy();
    this.button = null;
  }

  /**
   * 创建地图类型选项
   * @param mapType 地图类型配置
   * @param currentType 当前选中的类型
   */
  private createMapTypeItem(mapType: MapTypeConfig, currentType: string): HTMLElement {
    const isSelected = mapType.id === currentType;
    
    const item = document.createElement('div');
    item.setAttribute('data-map-type', mapType.id);
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #fff;
      transition: background-color 0.2s;
      border-radius: 4px;
    `;

    // 左侧：名称
    const label = document.createElement('span');
    const name = mapType.nameKey && this.useI18n ? this.t(mapType.nameKey) : mapType.name;
    label.textContent = name;
    item.appendChild(label);

    // 右侧：选中标记
    const checkmark = document.createElement('span');
    checkmark.textContent = isSelected ? '✓' : '';
    checkmark.style.cssText = `
      color: #00ff00;
      font-weight: bold;
      margin-left: 8px;
    `;
    item.appendChild(checkmark);

    // 悬停效果
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#055AB0';
      item.style.transform = 'scale(1.02)';
    });

    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
      item.style.transform = 'scale(1)';
    });

    // 点击事件
    item.addEventListener('click', () => {
      this.selectMapType(mapType.id);
    });

    return item;
  }

  /**
   * 创建禁飞区选项
   */
  private createNoFlyZoneItem(): HTMLElement {
    const isChecked = this.options.isNoFlyZoneChecked ?? true;
    
    const item = document.createElement('div');
    item.setAttribute('data-no-fly-zone', 'true');
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #fff;
      transition: background-color 0.2s;
      border-radius: 4px;
    `;

    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isChecked;
    checkbox.style.cssText = `
      cursor: pointer;
    `;
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      const checked = (e.target as HTMLInputElement).checked;
      this.toggleNoFlyZone(checked);
    });
    item.appendChild(checkbox);

    // 标签
    const label = document.createElement('span');
    label.textContent = this.useI18n ? this.t('layers.no_fly_zone') : '禁飞区';
    item.appendChild(label);

    // 悬停效果
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#055AB0';
    });

    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });

    return item;
  }

  /**
   * 选择地图类型
   * @param mapTypeId 地图类型 ID
   */
  private selectMapType(mapTypeId: string): void {
    const { onMapTypeChange, layersService } = this.options;
    
    // 更新当前类型
    this.options.currentMapType = mapTypeId;
    
    // 调用回调
    onMapTypeChange?.(mapTypeId);
    
    // 调用图层服务
    if (layersService && typeof layersService.setMapType === 'function') {
      layersService.setMapType(mapTypeId);
    }
    
    // 刷新菜单显示
    if (this.menuElement && this.toolbarElement) {
      this.hide();
      const anchor = this.button?.getElement();
      if (anchor) {
        setTimeout(() => this.show(anchor), 50);
      }
    }
  }

  /**
   * 切换禁飞区显示状态
   * @param isChecked 是否勾选
   */
  private toggleNoFlyZone(isChecked: boolean): void {
    const { onNoFlyZoneToggle, onShowNoFlyZones } = this.options;
    
    // 更新状态
    this.options.isNoFlyZoneChecked = isChecked;
    
    // 调用回调
    onNoFlyZoneToggle?.(isChecked);
    
    // 如果需要显示禁飞区
    if (isChecked && onShowNoFlyZones) {
      onShowNoFlyZones();
    }
  }
}
