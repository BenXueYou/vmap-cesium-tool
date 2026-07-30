import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';
import type { CoordSystem } from '../mapProviders/coordinates/types';
/**
 * 覆盖物位置类型
 */
export type OverlayPosition = Cesium.Cartesian3 | [number, number] | [number, number, number];
/**
 * 基础覆盖物配置选项
 */
export interface BaseOverlayOptions {
    /** 唯一标识符（可选，不传则自动生成） */
    id?: string;
    /** 位置（笛卡尔坐标或经纬度数组） */
    position?: OverlayPosition;
    /** 是否显示（默认 true） */
    show?: boolean;
    /** 点击回调函数 */
    onClick?: (entity: Entity) => void;
    /** 点击高亮配置 */
    clickHighlight?: boolean | OverlayClickHighlightOptions;
    /** 选中高亮配置 */
    selectionHighlight?: boolean | OverlayClickHighlightOptions;
    /** Hover 高亮配置 */
    hoverHighlight?: boolean | OverlayHoverHighlightOptions;
    /** 是否允许参与 pointer / API 选中 */
    selectable?: boolean;
    /** 屏幕拾取业务优先级，数值越大越优先（默认 0） */
    pickPriority?: number;
    /** 自定义元数据 */
    metadata?: Record<string, any>;
    /** 兼容旧版图层分组键 */
    layerKey?: string;
    /** 当前入参坐标系，默认 WGS84 */
    coordSystem?: CoordSystem;
}
/** 点击高亮配置 */
export interface OverlayClickHighlightOptions {
    /** 高亮主颜色（默认 yellow） */
    color?: Cesium.Color | string;
    /** 面填充透明度（默认 0.35） */
    fillAlpha?: number;
}
/** Hover 高亮配置（与 clickHighlight 使用同样的参数结构） */
export type OverlayHoverHighlightOptions = OverlayClickHighlightOptions;
/**
 * 覆盖物扩展实体类型
 * 用于在 Cesium.Entity 上挂载覆盖物相关的元数据
 */
export interface OverlayEntity extends Entity {
    /** 覆盖物点击回调 */
    _onClick?: (entity: Entity) => void;
    /** 点击高亮配置 */
    _clickHighlight?: boolean | OverlayClickHighlightOptions;
    /** 选中高亮配置 */
    _selectionHighlight?: boolean | OverlayClickHighlightOptions;
    /** Hover 高亮配置 */
    _hoverHighlight?: boolean | OverlayHoverHighlightOptions;
    /** 是否允许参与 pointer / API 选中 */
    _selectable?: boolean;
    /** 基于 legacy click 行为推导出的可选中提示 */
    _selectableInferred?: boolean;
    /** 屏幕拾取业务优先级 */
    _pickPriority?: number;
    /** 高亮联动的实体集合 */
    _highlightEntities?: Entity[];
    /** 当前是否处于高亮状态 */
    _isHighlighted?: boolean;
    /** 当前高亮原因（click/hover） */
    _highlightState?: {
        click?: boolean;
        hover?: boolean;
    };
    /** 覆盖物类型标识 */
    _overlayType?: string;
    /** 信息窗口根 DOM */
    _infoWindow?: HTMLElement;
    /** 复合图形的内层实体或边框实体 */
    _borderEntity?: Entity;
    _innerEntity?: Entity;
    /** 贴地标志 */
    _clampToGround?: boolean;
    /** 基准高度（米） */
    _baseHeight?: number;
    /** 绘制类型标识（如果是由 DrawService 创建） */
    _drawType?: string;
    /** 绘制配置 */
    _drawOptions?: any;
    /** 地面位置缓存 */
    _groundPosition?: Cesium.Cartesian3;
    _groundPositions?: Cesium.Cartesian3[];
    /** 标签实体列表 */
    _labelEntities?: Entity[];
    /** 关联的覆盖物 ID */
    _overlayId?: string;
    /** 旧版圆环/粗边框标记 */
    _isRing?: boolean;
    _ringThickness?: number;
    _primitiveLayerKey?: string;
}
/**
 * 覆盖物基类
 * 所有具体覆盖物类（Marker, Polygon, Circle 等）的父类
 *
 * @example
 * ```typescript
 * const marker = new Marker(viewer, {
 *   position: [120.1, 30.2],
 *   onClick: (entity) => console.log('clicked', entity)
 * });
 * ```
 */
export declare abstract class BaseOverlay {
    /** Cesium Viewer 实例 */
    protected viewer: Viewer;
    /** Cesium Entity 实例 */
    protected entity: Entity;
    /** 覆盖物配置选项 */
    protected options: BaseOverlayOptions;
    /** 是否已销毁 */
    protected destroyed: boolean;
    /**
     * Viewer 是否仍可访问
     */
    protected isViewerAvailable(): boolean;
    /**
     * 构造函数
     * @param viewer - Cesium Viewer 实例
     * @param options - 基础配置选项
     */
    constructor(viewer: Viewer, options?: BaseOverlayOptions);
    /**
     * 生成唯一 ID
     */
    protected generateId(prefix?: string): string;
    /**
     * 将位置转换为 Cartesian3 坐标
     */
    protected toCartesian3(position?: OverlayPosition): Cesium.Cartesian3 | undefined;
    /**
     * 将 Cartesian3 坐标转换为经纬度
     */
    protected toLngLat(cartesian: Cesium.Cartesian3): [number, number];
    /**
     * 获取 Entity 实例
     */
    getEntity(): Entity;
    /**
     * 获取覆盖物 ID
     */
    getId(): string;
    /**
     * 兼容 0.x：外部常直接把覆盖物实例当作 Entity 用，读取 `id`。
     */
    get id(): string;
    /**
     * 设置是否显示
     */
    setVisible(show: boolean): void;
    /**
     * 获取是否显示
     */
    isVisible(): boolean;
    /**
     * 更新配置
     * @param options - 新的配置选项
     */
    abstract update(options: Partial<BaseOverlayOptions & any>): void;
    /**
     * 从场景中移除覆盖物
     */
    remove(): void;
    /**
     * 销毁覆盖物（别名，与 remove 相同）
     */
    destroy(): void;
    /**
     * 检查是否已销毁
     */
    isDestroyed(): boolean;
}
