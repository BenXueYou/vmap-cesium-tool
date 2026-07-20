/**
 * 测量菜单
 * 提供测距、测面积、清除等功能
 */
import { BaseMenu } from './BaseMenu';
import type { MeasureMenuItem } from '../types';
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
export declare class MeasureMenu extends BaseMenu {
    private options;
    private items;
    /**
     * 构造函数
     * @param toolbarElement 工具栏容器元素
     * @param options 菜单配置
     * @param i18n 国际化实例
     * @param useI18n 是否使用国际化
     */
    constructor(toolbarElement: HTMLElement, options?: MeasureMenuOptions, i18n?: any, useI18n?: boolean);
    /**
     * 显示菜单
     * @param anchor 锚点元素
     */
    show(anchor: HTMLElement): void;
    /**
     * 处理菜单项点击
     * @param itemId 菜单项 ID
     */
    private handleItemClick;
    /**
     * 销毁菜单
     */
    destroy(): void;
}
