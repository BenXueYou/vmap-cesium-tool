/**
 * 测量按钮处理器
 * 处理测量功能的按钮点击、菜单显示等逻辑
 */
import { BaseButtonHandler } from './BaseButtonHandler';
import type { ToolbarButton } from '../../../../components/ToolbarButton';
import type { MeasurementServiceLike } from '../types';
/**
 * 测量按钮处理器配置
 */
export interface MeasureButtonHandlerOptions {
    /** 测量服务实例 */
    measurementService?: MeasurementServiceLike;
    /** 绘图助手实例 */
    drawHelper?: any;
    /** 测距开始回调 */
    onDistanceStart?: () => void;
    /** 测距绘制选项 */
    getDistanceDrawOptions?: () => any;
    /** 测面积开始回调 */
    onAreaStart?: () => void;
    /** 测面积绘制选项 */
    getAreaDrawOptions?: () => any;
    /** 测距完成回调 */
    onDistanceComplete?: (positions: any[], distance: number) => void;
    /** 测面积完成回调 */
    onAreaComplete?: (positions: any[], area: number) => void;
    /** 清除测量回调 */
    onClear?: () => void;
    onMeasurementComplete?: (result: {
        type: 'distance' | 'area';
        positions: any[];
        value: number;
    }) => void;
}
/**
 * 测量按钮处理器类
 */
export declare class MeasureButtonHandler extends BaseButtonHandler {
    readonly id = "measure";
    private menu;
    private options;
    private activeMeasurementMode;
    private boundMeasurementService;
    private boundDrawHelper;
    /**
     * 构造函数
     * @param viewer Cesium Viewer 实例
     * @param options 配置选项
     * @param i18n 国际化实例
     * @param useI18n 是否使用国际化
     */
    constructor(viewer: any, options?: MeasureButtonHandlerOptions, i18n?: any, useI18n?: boolean);
    updateOptions(options: Partial<MeasureButtonHandlerOptions>): void;
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
     * 处理鼠标进入事件
     */
    handleMouseEnter(): void;
    /**
     * 处理鼠标离开事件
     */
    handleMouseLeave(): void;
    /**
     * 销毁处理器
     */
    destroy(): void;
    private bindMeasurementServiceCallbacks;
    private bindDrawCallbacks;
    private handleMeasurementComplete;
    private handleClearComplete;
    private handleLegacyMeasureComplete;
    private handleDrawComplete;
    /**
     * 显示测量菜单
     * @param anchor 锚点元素
     */
    private showMenu;
    /**
     * 开始测距
     */
    private startDistanceMeasurement;
    /**
     * 开始测面积
     */
    private startAreaMeasurement;
    /**
     * 清除测量
     */
    private clearMeasurements;
    /**
     * 隐藏菜单
     */
    hideMenu(): void;
}
