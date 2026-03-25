/**
 * 测量菜单
 * 提供测距、测面积、清除等功能
 */

import { BaseMenu } from './BaseMenu';
import type { MeasureMenuItem } from '../types';
import { DEFAULT_MEASURE_ITEMS } from '../types';

/**
 * 测量菜单配置
 */
export interface MeasureMenuOptions {
  /** 菜单项配置 */
  items?: MeasureMenuItem[];
  
  /** 测距开始回调 */
  onDistanceStart?: () => void;
  
  /** 测面积开始回调 */
  onAreaStart?: () => void;
  
  /** 清除测量回调 */
  onClear?: () => void;
}

/**
 * 测量菜单类
 */
export class MeasureMenu extends BaseMenu {
  private options: MeasureMenuOptions;
  private items: MeasureMenuItem[];

  /**
   * 构造函数
   * @param toolbarElement 工具栏容器元素
   * @param options 菜单配置
   * @param i18n 国际化实例
   * @param useI18n 是否使用国际化
   */
  constructor(
    toolbarElement: HTMLElement,
    options: MeasureMenuOptions = {},
    i18n?: any,
    useI18n: boolean = true
  ) {
    super(toolbarElement, i18n, useI18n);
    this.options = options;
    this.items = options.items || DEFAULT_MEASURE_ITEMS;
  }

  /**
   * 显示菜单
   * @param anchor 锚点元素
   */
  show(anchor: HTMLElement): void {
    if (this.isDestroyed) return;

    // 先隐藏现有菜单
    this.hide();

    // 创建菜单容器
    this.menuElement = this.createMenuContainer('measurement-menu');
    this.menuElement.style.position = 'absolute';
    this.menuElement.style.right = '100%';
    this.menuElement.style.marginRight = '8px';

    // 添加菜单项
    this.items.forEach(item => {
      const menuItem = this.createMenuItem(
        item.id,
        item.text,
        item.textKey,
        item.icon,
        () => this.handleItemClick(item.id)
      );
      this.menuElement!.appendChild(menuItem);
    });

    // 添加到工具栏
    this.toolbarElement!.appendChild(this.menuElement);
    this.anchorElement = anchor;

    // 定位菜单（根据按钮偏移）
    const offsetTop = anchor.offsetTop;
    this.menuElement.style.top = `${offsetTop}px`;

    // 调整位置避免溢出
    this.adjustPosition();

    // 设置自动关闭
    this.setupAutoClose();
  }

  /**
   * 处理菜单项点击
   * @param itemId 菜单项 ID
   */
  private handleItemClick(itemId: string): void {
    switch (itemId) {
      case 'measure-distance':
        this.options.onDistanceStart?.();
        break;
      case 'measure-area':
        this.options.onAreaStart?.();
        break;
      case 'clear-measurement':
        this.options.onClear?.();
        break;
    }
    this.hide();
  }

  /**
   * 销毁菜单
   */
  destroy(): void {
    super.destroy();
    this.options = {};
    this.items = [];
  }
}