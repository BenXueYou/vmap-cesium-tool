import type { TDTLayerConfig } from './types';
export { DEFAULT_BUTTON_SORTS, DEFAULT_BUTTON_CONFIGS, DEFAULT_MEASURE_ITEMS, DEFAULT_TOOLBAR_STYLE, DEFAULT_MAP_TYPES, } from './services/toolbar/config';
/**
 * 核心常量定义
 */
export declare const DEFAULT_CAMERA_CONFIG: {
    center: [number, number, number];
    pitch: number;
    heading: number;
    roll: number;
};
/**
 * 默认图层提供商类型
 */
export declare const DEFAULT_PROVIDER_TYPE: 'tdt';
/**
 * 默认天地图配置
 */
export declare const DEFAULT_TDT_CONFIG: TDTLayerConfig;
export declare const DEFAULT_MAP_CENTER: {
    longitude: number;
    latitude: number;
    height: number;
};
export declare const DEFAULT_ZOOM_LEVELS: number[];
export declare const DEFAULT_ZOOM_INDEX = 3;
export declare const CSS_CLASSES: {
    TOOLBAR: string;
    TOOLBAR_BUTTON: string;
    SEARCH_CONTAINER: string;
    SEARCH_RESULTS: string;
    MEASUREMENT_MENU: string;
    LAYERS_MENU: string;
    MAP_TYPE_ITEM: string;
    MAP_TYPE_THUMBNAIL: string;
    MAP_TYPE_CHECKMARK: string;
    SELECTED: string;
};
export declare const EVENT_NAMES: {
    BUTTON_CLICK: string;
    SEARCH_START: string;
    SEARCH_COMPLETE: string;
    SEARCH_SELECT: string;
    MEASUREMENT_START: string;
    MEASUREMENT_COMPLETE: string;
    MEASUREMENT_CLEAR: string;
    LAYER_CHANGE: string;
    VIEW_MODE_CHANGE: string;
    ZOOM_CHANGE: string;
    FULLSCREEN_CHANGE: string;
};
export declare const STYLE_PREFIX = "vmap-cesium-";
declare const _default: {
    DEFAULT_MAP_CENTER: {
        longitude: number;
        latitude: number;
        height: number;
    };
    DEFAULT_ZOOM_LEVELS: number[];
    DEFAULT_ZOOM_INDEX: number;
    CSS_CLASSES: {
        TOOLBAR: string;
        TOOLBAR_BUTTON: string;
        SEARCH_CONTAINER: string;
        SEARCH_RESULTS: string;
        MEASUREMENT_MENU: string;
        LAYERS_MENU: string;
        MAP_TYPE_ITEM: string;
        MAP_TYPE_THUMBNAIL: string;
        MAP_TYPE_CHECKMARK: string;
        SELECTED: string;
    };
    EVENT_NAMES: {
        BUTTON_CLICK: string;
        SEARCH_START: string;
        SEARCH_COMPLETE: string;
        SEARCH_SELECT: string;
        MEASUREMENT_START: string;
        MEASUREMENT_COMPLETE: string;
        MEASUREMENT_CLEAR: string;
        LAYER_CHANGE: string;
        VIEW_MODE_CHANGE: string;
        ZOOM_CHANGE: string;
        FULLSCREEN_CHANGE: string;
    };
    STYLE_PREFIX: string;
};
export default _default;
