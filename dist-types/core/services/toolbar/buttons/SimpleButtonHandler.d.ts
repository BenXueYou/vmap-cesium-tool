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
export declare class SimpleButtonHandler extends BaseButtonHandler {
    readonly id: string;
    private config;
    private mapController?;
    private sceneModeListenerDispose;
    /**
     * 构造函数
     * @param config 按钮配置
     * @param viewer Cesium Viewer 实例
     * @param mapController 地图控制器
     * @param i18n 国际化实例
     * @param useI18n 是否使用国际化
     */
    constructor(config: SimpleButtonConfig, viewer: any, mapController?: MapControllerLike, i18n?: any, useI18n?: boolean);
    /**
     * 初始化按钮
     * @param button 按钮实例
     */
    initialize(button: ToolbarButton): void;
    /**
     * 处理点击事件
     */
    handleClick(): void;
    /**
     * 销毁处理器
     */
    destroy(): void;
    /**
     * 设置地图控制器
     * @param controller 地图控制器
     */
    setMapController(controller: MapControllerLike): void;
    private attachSceneModeListener;
    private syncView2D3DButton;
    /**
     * 切换激活状态
     */
    toggleActive(): void;
    /**
     * 设置激活状态
     * @param active 是否激活
     */
    setActive(active: boolean): void;
}
/**
 * 创建简单按钮处理器的工厂函数
 */
export declare function createSimpleButtonHandler(config: SimpleButtonConfig, viewer: any, mapController?: MapControllerLike, i18n?: any, useI18n?: boolean): SimpleButtonHandler;
