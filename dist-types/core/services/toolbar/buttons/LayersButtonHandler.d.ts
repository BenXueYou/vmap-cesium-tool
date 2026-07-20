/**
 * 图层按钮处理器
 * 处理图层切换功能的按钮点击、菜单显示等逻辑
 */
import type { LayersPanelStyleConfig } from '../../../../core/types';
import type { ToolbarButton } from '../../../../components/ToolbarButton';
import { BaseMenu } from '../menus/BaseMenu';
export interface MapTypeConfig {
    id: string;
    name: string;
    nameKey?: string;
    thumbnail?: string;
    placeNameLabel?: string;
    placeNameLabelKey?: string;
    forcePlaceName?: boolean;
}
export interface LayersButtonHandlerOptions {
    layersService?: any;
    mapTypes?: MapTypeConfig[];
    currentMapType?: string;
    isPlaceNameChecked?: boolean;
    token?: string;
    isNoFlyZoneChecked?: boolean;
    onMapTypeChange?: (mapTypeId: string) => void;
    onPlaceNameToggle?: (isChecked: boolean) => void;
    onShowNoFlyZones?: () => Promise<void>;
    onNoFlyZoneToggle?: (isChecked: boolean) => void;
    panelStyle?: LayersPanelStyleConfig;
}
export declare class LayersButtonHandler extends BaseMenu {
    readonly id = "layers";
    private options;
    private button;
    private panelStyle;
    constructor(toolbarElement: HTMLElement, options?: LayersButtonHandlerOptions, i18n?: any, useI18n?: boolean);
    show(anchor: HTMLElement): void;
    initialize(button: ToolbarButton): void;
    handleClick(): void;
    handleMouseEnter(): void;
    handleMouseLeave(): void;
    destroy(): void;
    updateOptions(options: Partial<LayersButtonHandlerOptions>): void;
    private createSection;
    private createMapTypeItem;
    private createPlaceNameToggle;
    private createNoFlyZoneItem;
    private selectMapType;
    private toggleNoFlyZone;
    private togglePlaceName;
    private getPanelStyles;
}
