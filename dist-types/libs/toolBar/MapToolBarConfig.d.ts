import type { CustomButtonConfig } from '../CesiumMapModel';
/**
 * 旧版默认按钮配置。
 * 从 core/constants 映射导出，避免重复维护。
 */
export declare const defaultButtons: CustomButtonConfig[];
/**
 * 旧版默认测量菜单项。
 */
export declare const defaultMeasureItems: {
    id: string;
    text: string;
    textKey?: string;
    icon: string;
}[];
/**
 * 旧版默认工具栏样式配置。
 */
export declare const defaultToolBarStyle: {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
    direction?: "row" | "column";
    buttonSize?: number;
    buttonSpacing?: number;
    padding?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderRadius?: number;
    borderWidth?: number;
    boxShadow?: string;
    zIndex?: number;
    offsetTop?: number;
    offsetRight?: number;
    offsetBottom?: number;
    offsetLeft?: number;
    buttons?: CustomButtonConfig[];
    useI18n?: boolean;
    i18n?: import("../..").I18nLike;
    token?: string;
    sk?: string;
    TD_Token?: string;
    TD_SK?: string;
};
