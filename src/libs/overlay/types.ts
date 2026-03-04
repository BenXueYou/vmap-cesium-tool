import type { Cartesian3, Entity, Color, MaterialProperty, Rectangle, Cartographic } from "cesium";

/**
 * 覆盖物位置类型
 */
export type OverlayPosition = Cartesian3 | [number, number] | [number, number, number];

export interface OverlayHighlightOriginalStyle {
	point?: {
		pixelSize?: any;
		color?: any;
		outlineColor?: any;
		outlineWidth?: any;
	};
	label?: {
		fillColor?: any;
		outlineColor?: any;
		outlineWidth?: any;
		scale?: any;
	};
	billboard?: {
		scale?: any;
		color?: any;
	};
	polyline?: {
		width?: any;
		material?: any;
	};
	polygon?: {
		outline?: any;
		outlineColor?: any;
		outlineWidth?: any;
		material?: any;
	};
	rectangle?: {
		outline?: any;
		outlineColor?: any;
		outlineWidth?: any;
		material?: any;
	};
	ellipse?: {
		outline?: any;
		outlineColor?: any;
		outlineWidth?: any;
		material?: any;
	};
}

export interface OverlayClickHighlightOptions {
	/** 高亮主颜色（默认 yellow） */
	color?: Color | string;
	/** 面填充透明度（默认 0.35） */
	fillAlpha?: number;
}

/** 与 clickHighlight 使用同样的参数结构（颜色 + 面填充透明度） */
export type OverlayHoverHighlightOptions = OverlayClickHighlightOptions;

/**
 * 覆盖物扩展实体类型
 * 用于在 Cesium.Entity 上挂载覆盖物相关的元数据
 */
export interface OverlayEntity extends Entity {
	/** 覆盖物点击回调（由各 Map* 工具类设置） */
	_onClick?: (entity: Entity) => void;

	/** 点击覆盖物时是否启用高亮（由各 Map* 工具类设置） */
	_clickHighlight?: boolean | OverlayClickHighlightOptions;
	/** 鼠标移入覆盖物时是否启用高亮（由各 Map* 工具类设置） */
	_hoverHighlight?: boolean | OverlayHoverHighlightOptions;
	/** 高亮联动的实体集合（复合覆盖物：边框/填充等一起切换） */
	_highlightEntities?: Entity[];
	/** 当前是否处于高亮状态 */
	_isHighlighted?: boolean;
	/** 当前高亮原因（click/hover 可叠加；click 优先显示） */
	_highlightState?: { click?: boolean; hover?: boolean };
	/** 用于还原高亮前的原始样式 */
	_highlightOriginalStyle?: OverlayHighlightOriginalStyle;
	/** 高亮时临时创建的“发光边框”实体（由 CesiumOverlayService 管理） */
	_highlightGlowEntity?: Entity;

	/** 覆盖物类型标识（用于 CesiumOverlayService 做差异化更新/删除） */
	_overlayType?: string;

	/** 信息窗口根 DOM（由 MapInfoWindow / CesiumOverlayService 使用） */
	_infoWindow?: HTMLElement;

	/** 复合图形的内层实体或边框实体等关联引用 */
	_borderEntity?: Entity;
	_innerEntity?: Entity;

	/** 粗边框 / 环形等形状相关元数据 */
	/** 是否贴地（粗边框/环形等复合形状用） */
	_clampToGround?: boolean;
	/** 复合形状的基准高度（米，clampToGround=false 时有效） */
	_baseHeight?: number;
	_isThickOutline?: boolean;
	_outlineWidth?: number;
	_isRing?: boolean;
	_ringThickness?: number;
	_ringSegments?: number;
	_ringGlowPower?: number;
	_ringLineColor?: Color | string;
	_ringLineStyle?: 'solid' | 'dashed';
	_ringLineMaterialMode?: 'stripe' | 'dash';
	_ringStripeRepeat?: number;
	_ringDashLength?: number;
	_ringDashPattern?: number;
	_ringGapColor?: Color | string;
	_ringShowInnerLine?: boolean;
	_fillMaterial?: MaterialProperty | Color | string;
	_ringHeightEpsilon?: number;
	_centerCartographic?: Cartographic;
	_outerRadius?: number;
	_innerRadius?: number;
	_outerRectangle?: Rectangle;

	/** primitive circle: 内部使用的纯色缓存（用于高亮恢复） */
	/** primitive layer key: 用于分层批处理路由 */
	_primitiveLayerKey?: string;
	_primitiveRingBaseColor?: Color;
	_primitiveFillBaseColor?: Color;
	/** primitive：用于高亮发光边框的外圈/边界位置（通常为闭合折线） */
	_primitiveOutlinePositions?: Cartesian3[];
	/** primitive polygon/rectangle: 边框纯色缓存（用于高亮恢复） */
	_primitiveBorderBaseColor?: Color;
}

