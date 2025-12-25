// VMap Cesium Toolbar Plugin Type Definitions

import type * as Cesium from 'cesium';
import type { Viewer, Cartesian3, Cartographic, Entity, Cartesian2 } from 'cesium';

// 工具栏配置接口
export interface ToolbarConfig {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  buttonSize?: number;
  buttonSpacing?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  boxShadow?: string;
  zIndex?: number;
  buttons?: ButtonConfig[]; // Explicit configuration of toolbar buttons
}

// 按钮配置接口
export interface ButtonConfig {
  id: string;
  icon: string;
  title: string;
  size?: number;
  color?: string;
  hoverColor?: string;
  activeColor?: string;
}

// 搜索回调接口
export interface SearchCallback {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;
}

// 搜索结果接口
export interface SearchResult {
  name: string;
  address: string;
  longitude: number;
  latitude: number;
  height?: number;
}

// 测量回调接口
export interface MeasurementCallback {
  onMeasurementStart?: (positions?: Cartesian3[]) => void;
  onDistanceComplete?: (positions: Cartesian3[], distance: number) => void;
  onAreaComplete?: (positions: Cartesian3[], area: number) => void;
  onClear?: () => void;
}

// 缩放回调接口
export interface ZoomCallback {
  onZoomIn?: (beforeLevel: number, afterLevel: number) => void;
  onZoomOut?: (beforeLevel: number, afterLevel: number) => void;
}

// 地图类型接口
export interface MapType {
  id: string;
  name: string;
  thumbnail: string;
  provider: any; // Cesium.ImageryProvider
}

// 视锥体选项接口
export interface FrustumOptions {
  position?: Cartesian3;
  orientation?: any; // Cesium.Quaternion
  fov?: number;
  aspectRatio?: number;
  near?: number;
  far?: number;
  fillColor?: any; // Cesium.Color
  outlineColor?: any; // Cesium.Color
  onRightClick?: (position: Cartesian3) => void;
}

// 覆盖物选项接口
export interface OverlayOptions {
  position: Cartesian3;
  type: 'point' | 'label' | 'billboard' | 'model' | 'cylinder';
  text?: string;
  image?: string;
  model?: string;
  color?: any; // Cesium.Color
  scale?: number;
  height?: number;
  width?: number;
  heightReference?: any; // Cesium.HeightReference
}

// 地图中心点接口
export interface MapCenter {
  latitude: number;
  longitude: number;
  height: number;
  pitch?: number;
  heading?: number;
}

// 初始化选项接口
export interface InitOptions {
  token?: string;
  cesiumToken?: string;
  terrain?: any; // Cesium.Terrain
  terrainProvider?: any; // Cesium.TerrainProvider
  mapType?: string;
  imageryProvider?: any; // Cesium.UrlTemplateImageryProvider
  imageryLayers?: any; // Cesium.ImageryLayerCollection
  terrainShadows?: any; // Cesium.ShadowMode
  contextOptions?: any; // Cesium.ContextOptions
  scene3DOnly?: boolean;
  isFlyTo?: boolean;
  isFly?: boolean;
  selectionIndicator?: boolean;
  navigationHelpButton?: boolean;
  fullscreenButton?: boolean;
  geocoder?: boolean;
  homeButton?: boolean;
  infoBox?: boolean;
  sceneModePicker?: boolean;
  baseLayerPicker?: boolean;
  timeline?: boolean;
  animation?: boolean;
  clock?: any; // Cesium.Clock
  navigationInstructionsInitiallyVisible?: boolean;
  sceneMode?: any; // Cesium.SceneMode
  screenSpaceEventHandler?: any; // Cesium.ScreenSpaceEventHandler
  useDefaultRenderLoop?: boolean;
  targetFrameRate?: number;
  showRenderLoopErrors?: boolean;
  automaticallyTrackDataSourceClocks?: boolean;
  dataSources?: any; // Cesium.DataSourceCollection
  creationTime?: number;
  useBrowserRecommendedResolution?: boolean;
  resolutionScale?: number;
  orderIndependentTransparency?: boolean;
  shadows?: boolean;
  terrainExaggeration?: number;
  maximumScreenSpaceError?: number;
  maximumNumberOfLoadedTiles?: number;
}

// 主要类声明
export declare class CesiumMapToolbar {
  constructor(
    viewer: Viewer,
    container: HTMLElement,
    config?: ToolbarConfig,
    callbacks?: {
      search?: SearchCallback;
      measurement?: MeasurementCallback;
      zoom?: ZoomCallback;
    },
    initialCenter?: { longitude: number; latitude: number; height: number }
  );
  setMapTypes(mapTypes: MapType[]): void;
  setTDToken(TD_Token: string): void;
  setInitialCenter(center: { longitude: number; latitude: number; height: number }): void;
  getInitialCenter(): { longitude: number; latitude: number; height: number } | undefined;
  resetToInitialLocation(): void;
  drawMonitoringCircle(
    longitude: number,
    latitude: number,
    height: number,
    radius: number,
    options?: {
      borderColor?: string;
      fillColor?: string;
      borderWidth?: number;
      name?: string;
    }
  ): any; // Cesium.Entity
  drawVerticalLine(
    longitude: number,
    latitude: number,
    height: number,
    options?: {
      color?: string;
      width?: number;
      dashPattern?: number;
      name?: string;
      groundHeight?: number;
    }
  ): any; // Cesium.Entity
  destroy(): void;
}

// 覆盖物服务：对外暴露的简化类型声明
// 覆盖物位置类型（与 overlay/types.ts 保持一致）
export type OverlayPosition = Cartesian3 | [number, number] | [number, number, number];

export type PositionOffset =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left-top'
  | 'left-bottom'
  | 'right-top'
  | 'right-bottom';

export interface InfoWindowOptions {
  position: OverlayPosition;
  content: string | HTMLElement;
  width?: number;
  height?: number;
  pixelOffset?: Cesium.Cartesian2 | { x: number; y: number };
  show?: boolean;
  id?: string;
  closable?: boolean;
  onClick?: (entity: any) => void;
  onClose?: (entity: any) => void;
  backgroundColor?: string;
  color?: string;
  font?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  hideWhenOutOfView?: boolean;
  anchorHeight?: number;
  anchorPixel?: number;
  tailGap?: number;
  updateInterval?: number;
  showArrow?: boolean;
  arrowSize?: number;
  positionOffset?: PositionOffset;
}

// Overlay: 选项类型（与各实现保持一致）
export interface MarkerOptions {
  position: OverlayPosition;
  pixelSize?: number;
  color?: any | string;
  outlineColor?: any | string;
  outlineWidth?: number;
  heightReference?: any;
  scaleByDistance?: Cesium.NearFarScalar;
  disableDepthTestDistance?: number;
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface LabelOptions {
  position: OverlayPosition;
  text: string;
  font?: string;
  fillColor?: any | string;
  outlineColor?: any | string;
  outlineWidth?: number;
  style?: any;
  pixelOffset?: Cesium.Cartesian2;
  eyeOffset?: Cesium.Cartesian3;
  horizontalOrigin?: any;
  verticalOrigin?: any;
  heightReference?: any;
  scale?: number;
  showBackground?: boolean;
  backgroundColor?: any | string;
  backgroundPadding?: Cesium.Cartesian2;
  disableDepthTestDistance?: number;
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface IconOptions {
  position: OverlayPosition;
  image: string;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
  pixelOffset?: Cesium.Cartesian2;
  eyeOffset?: Cesium.Cartesian3;
  horizontalOrigin?: any;
  verticalOrigin?: any;
  heightReference?: any;
  disableDepthTestDistance?: number;
  color?: any | string;
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface SvgOptions {
  position: OverlayPosition;
  svg: string;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
  pixelOffset?: Cesium.Cartesian2;
  eyeOffset?: Cesium.Cartesian3;
  horizontalOrigin?: any;
  verticalOrigin?: any;
  heightReference?: any;
  disableDepthTestDistance?: number;
  color?: any | string;
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface PolylineOptions {
  positions: OverlayPosition[];
  width?: number;
  material?: Cesium.MaterialProperty | any | string;
  clampToGround?: boolean;
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface PolygonOptions {
  positions: OverlayPosition[];
  material?: Cesium.MaterialProperty | any | string;
  outline?: boolean;
  outlineColor?: any | string;
  outlineWidth?: number;
  heightReference?: any;
  extrudedHeight?: number;
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface RectangleOptions {
  coordinates: Cesium.Rectangle;
  material?: Cesium.MaterialProperty | any | string;
  outline?: boolean;
  outlineColor?: any | string;
  outlineWidth?: number;
  heightReference?: any;
  extrudedHeight?: number;
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface CircleOptions {
  position: OverlayPosition;
  radius: number;
  material?: Cesium.MaterialProperty | any | string;
  outline?: boolean;
  outlineColor?: any | string;
  outlineWidth?: number;
  heightReference?: any;
  extrudedHeight?: number;
  heightEpsilon?: number; // 高度容差，用于环形方案
  onClick?: (entity: Entity) => void;
  id?: string;
}

export declare class CesiumOverlayService {
  constructor(viewer: Viewer);
  addMarker(options: any): any; // 返回 Cesium.Entity
  addLabel(options: any): any; // 返回 Cesium.Entity
  addIcon(options: any): any; // 返回 Cesium.Entity
  addSvg(options: any): any; // 返回 Cesium.Entity
  addInfoWindow(options: InfoWindowOptions): any; // 返回 Cesium.Entity
  addPolyline(options: any): any; // 返回 Cesium.Entity
  addPolygon(options: any): any; // 返回 Cesium.Entity
  addRectangle(options: any): any; // 返回 Cesium.Entity
  addCircle(options: any): any; // 返回 Cesium.Entity
  getOverlay(id: string): any | undefined; // 返回 Cesium.Entity | undefined
  removeOverlay(id: string): boolean;
  removeAllOverlays(): void;
  updateOverlayPosition(id: string, position: Cartesian3 | [number, number, number?]): boolean;
  setOverlayVisible(id: string, visible: boolean): boolean;
  getAllOverlayIds(): string[];
  getAllOverlays(): any[]; // Cesium.Entity[]
  destroy(): void;
}

// Overlay: 工具类声明（只暴露主要方法）
export declare class MapMarker {
  constructor(viewer: Viewer);
  add(options: MarkerOptions): Entity;
  updatePosition(entity: Entity, position: OverlayPosition): void;
  updateStyle(entity: Entity, options: Partial<Pick<MarkerOptions, 'color' | 'outlineColor' | 'outlineWidth' | 'pixelSize'>>): void;
}

export declare class MapLabel {
  constructor(viewer: Viewer);
  add(options: LabelOptions): Entity;
  updatePosition(entity: Entity, position: OverlayPosition): void;
}

export declare class MapIcon {
  constructor(viewer: Viewer);
  add(options: IconOptions): Entity;
  updatePosition(entity: Entity, position: OverlayPosition): void;
  updateImage(entity: Entity, image: string): void;
}

export declare class MapSVG {
  constructor(viewer: Viewer);
  add(options: SvgOptions): Entity;
  updatePosition(entity: Entity, position: OverlayPosition): void;
}

export declare class MapPolyline {
  constructor(viewer: Viewer);
  add(options: PolylineOptions): Entity;
  updatePositions(entity: Entity, positions: OverlayPosition[]): void;
  updateStyle(entity: Entity, options: Partial<Pick<PolylineOptions, 'width' | 'material'>>): void;
}

export declare class MapPolygon {
  constructor(viewer: Viewer);
  add(options: PolygonOptions): Entity;
  updatePositions(entity: Entity, positions: OverlayPosition[]): void;
  updateStyle(entity: Entity, options: Partial<Pick<PolygonOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void;
  remove(entityOrId: Entity | string): boolean;
}

export declare class MapRectangle {
  constructor(viewer: Viewer);
  add(options: RectangleOptions): Entity;
  updateCoordinates(entity: Entity, coordinates: Cesium.Rectangle): void;
  updateStyle(entity: Entity, options: Partial<Pick<RectangleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void;
  remove(entityOrId: Entity | string): boolean;
}

export declare class MapCircle {
  constructor(viewer: Viewer);
  add(options: CircleOptions): Entity;
  updatePosition(entity: Entity, position: OverlayPosition): void;
  updateRadius(entity: Entity, radius: number): void;
  updateStyle(entity: Entity, options: Partial<Pick<CircleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void;
}

// 绘制相关类型（与内部实现保持一致）
export interface DrawOptions {
  strokeColor?: any | string;
  strokeWidth?: number;
  fillColor?: any | string;
  outlineColor?: any | string;
  outlineWidth?: number;
  heightEpsilon?: number; // 高度容差，用于环形方案
  selected?: {
    color?: any | string;
    width?: number;
    outlineColor?: any | string;
    outlineWidth?: number;
  };
  onClick?: (entity: Entity, type?: 'line' | 'polygon' | 'rectangle' | 'circle', positions?: Cartesian3[]) => void;
}

export interface DrawResult {
  entity: Entity | null;
  type: 'line' | 'polygon' | 'rectangle' | 'circle';
  positions: Cartesian3[];
  distance?: number;
  areaKm2?: number;
}

export declare class DrawHelper {
  constructor(viewer: Viewer);
  // 开始绘制（可选样式参数）
  startDrawingLine(options?: DrawOptions): void;
  startDrawingPolygon(options?: DrawOptions): void;
  startDrawingRectangle(options?: DrawOptions): void;
  startDrawingCircle(options?: DrawOptions): void;
  // 控制绘制流程
  endDrawing(): void;
  // 清理与管理
  clearAll(): void;
  clearAllEntities(): void;
  clearAllPoints(): void;
  removeEntity(entity: Entity): void;
  getFinishedEntities(): Entity[];
  // 事件回调注册
  onMeasureComplete(callback: (result: DrawResult) => void): void;
  onDrawStart(callback: () => void): void;
  onDrawEnd(callback: (entity: Entity | null) => void): void;
  onEntityRemoved(callback: (entity: Entity) => void): void;
  // 场景模式切换适配
  handleSceneModeChanged(): void;
  // 资源释放
  destroy(): void;
}

export declare function initCesium(
  containerId: string,
  options: InitOptions,
  mapCenterOrCesiumToken?: MapCenter | string,
  cesiumToken?: String
): Promise<{ viewer: Viewer; initialCenter: MapCenter }>;

// 默认导出
declare const _default: {
  CesiumMapToolbar: typeof CesiumMapToolbar;
  DrawHelper: typeof DrawHelper;
  CesiumOverlayService: typeof CesiumOverlayService;
  initCesium: typeof initCesium;
  initCesiumMap: typeof initCesium;
};

export default _default;
