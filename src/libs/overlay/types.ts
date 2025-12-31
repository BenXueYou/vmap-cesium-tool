import type { Cartesian3, Entity, Color, MaterialProperty, Rectangle, Cartographic } from "cesium";

/**
 * 覆盖物位置类型
 */
export type OverlayPosition = Cartesian3 | [number, number] | [number, number, number];

/**
 * 覆盖物扩展实体类型
 * 用于在 Cesium.Entity 上挂载覆盖物相关的元数据
 */
export interface OverlayEntity extends Entity {
	/** 覆盖物点击回调（由各 Map* 工具类设置） */
	_onClick?: (entity: Entity) => void;

	/** 信息窗口根 DOM（由 MapInfoWindow / CesiumOverlayService 使用） */
	_infoWindow?: HTMLElement;

	/** 复合图形的内层实体或边框实体等关联引用 */
	_borderEntity?: Entity;
	_innerEntity?: Entity;

	/** 粗边框 / 环形等形状相关元数据 */
	_isThickOutline?: boolean;
	_outlineWidth?: number;
	_isRing?: boolean;
	_ringThickness?: number;
	_fillMaterial?: MaterialProperty | Color | string;
	_ringHeightEpsilon?: number;
	_centerCartographic?: Cartographic;
	_outerRadius?: number;
	_innerRadius?: number;
	_outerRectangle?: Rectangle;
}

