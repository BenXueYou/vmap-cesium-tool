// VMap Cesium Toolbar Plugin Type Definitions

import type * as Cesium from 'cesium';
import type { Viewer, Cartesian3, Entity, Color } from 'cesium';

// 工具栏配置接口（与 CesiumMapModel.ts 保持一致）
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
  buttons?: CustomButtonConfig[];
}

// 按钮配置接口（内部默认按钮配置使用）
export interface ButtonConfig {
  sort?: number;
  id: string;
  icon: string;
  title: string;
  size?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  hoverColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  callback?: () => void;
  activeIcon?: string | HTMLElement;
}

// 自定义按钮配置接口（对外主要使用）
export interface CustomButtonConfig {
  id: string;
  icon: string | HTMLElement | false;
  title: string;
  enabled?: boolean;
  visible?: boolean;
  size?: number;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: string;
  padding?: string;
  hoverColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  sort?: number;
  activeIcon?: string | HTMLElement | false;
  callback?: () => void;
  onClick?: (buttonId: string, buttonElement: HTMLElement) => void;
}

// 搜索回调接口
export interface SearchCallback {
  onSearch?: (query: string) => Promise<SearchResult[]>;
  onSelect?: (result: SearchResult) => void;
  onSearchInput?: (query: string, container: HTMLElement) => void;
  onSearchResults?: (results: SearchResult[], container: HTMLElement) => void;
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
  onZoomIn?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
  onZoomOut?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
}

// 地图类型接口
export interface MapType {
  id: string;
  name: string;
  thumbnail: string;
  provider: (token: string) => Cesium.ImageryProvider[];
  terrainProvider?: (token: string) => Cesium.TerrainProvider | null;
  geoWTFS?: (token: string, viewer: Cesium.Viewer) => any | null;
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
// 覆盖物选项（与 CesiumMapModel.ts 保持一致）
export interface OverlayOptions {
  position: Cartesian3;
  type: 'point' | 'label' | 'billboard' | 'model' | 'cylinder';
  point?: {
    pixelSize?: number;
    color?: Color;
    outlineColor?: Color;
    outlineWidth?: number;
  };
  label?: {
    text: string;
    font?: string;
    fillColor?: Color;
    outlineColor?: Color;
    outlineWidth?: number;
  };
  billboard?: {
    image: string;
    scale?: number;
  };
  model?: {
    uri: string;
    scale?: number;
  };
  cylinder?: {
    length: number;
    topRadius: number;
    bottomRadius: number;
    material?: Color;
  };
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
  terrain?: Cesium.Terrain;
  terrainProvider?: Cesium.TerrainProvider;
  mapType?: string;
  imageryProvider?: Cesium.UrlTemplateImageryProvider;
  imageryLayers?: Cesium.ImageryLayerCollection;
  terrainShadows?: Cesium.ShadowMode;
  contextOptions?: Cesium.ContextOptions;
  scene3DOnly?: boolean;
  selectionIndicator?: boolean;
  navigationHelpButton?: boolean;
  fullscreenButton?: boolean;
  geocoder?: boolean;
  homeButton?: boolean;
  infoBox?: boolean;
  vrButton?: boolean;
  sceneModePicker?: boolean;
  timeline?: boolean;
  animation?: boolean;
  isFly?: boolean;
  flyDuration?: number;
  baseLayerPicker?: boolean;
  navigationInstructionsInitiallyVisible?: boolean;
  clock?: Cesium.Clock;
  sceneMode?: Cesium.SceneMode;
  screenSpaceEventHandler?: Cesium.ScreenSpaceEventHandler;
  useDefaultRenderLoop?: boolean;
  targetFrameRate?: number;
  showRenderLoopErrors?: boolean;
  automaticallyTrackDataSourceClocks?: boolean;
  dataSources?: Cesium.DataSourceCollection;
  creationTime?: number;
  useBrowserRecommendedResolution?: boolean;
  resolutionScale?: number;
  orderIndependentTransparency?: boolean;
  shadows?: boolean;
  depthTestAgainstTerrain?: boolean;
  terrainExaggeration?: number;
  maximumScreenSpaceError?: number;
  maximumNumberOfLoadedTiles?: number;
  requestRenderMode?: boolean;
  token?: string;
  cesiumToken?: string;
  orderIndependentTranslucency?: boolean // 无序半透明度,
  fxaa?: boolean, // 启用FXAA后处理抗锯齿
  msaaSamples?: number, // MSAA采样数（推荐4或8）,
  success?: () => void;
  cancel?: () => void;
  mapCenter?: MapCenter;
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
  /** 当前测量模式：none / distance / area */
  readonly measurement: {
    getMeasureMode: () => 'none' | 'distance' | 'area';
  };
  /** 更新内置或自定义按钮配置 */
  updateButtonConfig(buttonId: string, config: Partial<CustomButtonConfig>): void;
  /** 添加或替换自定义按钮 */
  addCustomButton(config: CustomButtonConfig): void;
  /** 按 id 移除按钮 */
  removeButton(buttonId: string): void;
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

// 覆盖物扩展实体类型（与 libs/overlay/types.ts 保持一致）
export interface OverlayEntity extends Entity {
  _onClick?: (entity: Entity) => void;
  _clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  _hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  _highlightEntities?: Entity[];
  _isHighlighted?: boolean;
  _highlightState?: { click?: boolean; hover?: boolean };
  _overlayType?: string;
  _infoWindow?: HTMLElement;
  _borderEntity?: Entity;
  _innerEntity?: Entity;
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
  _fillMaterial?: Cesium.MaterialProperty | Color | string;
  _ringHeightEpsilon?: number;
  _centerCartographic?: Cesium.Cartographic;
  _outerRadius?: number;
  _innerRadius?: number;
  _outerRectangle?: Cesium.Rectangle;

  /** primitive circle: 内部使用的纯色缓存（用于高亮恢复） */
  _primitiveRingBaseColor?: any;
  _primitiveFillBaseColor?: any;

  /** primitive polygon/rectangle: 边框纯色缓存（用于高亮恢复） */
  _primitiveBorderBaseColor?: any;
}

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
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
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
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
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
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
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
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface PolylineOptions {
  positions: OverlayPosition[];
  width?: number;
  material?: Cesium.MaterialProperty | any | string;
  clampToGround?: boolean;
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface PolygonOptions {
  positions: OverlayPosition[];
  /** 渲染模式：auto(默认) / entity / primitive（贴地粗边框纯色场景支持） */
  renderMode?: 'auto' | 'entity' | 'primitive';
  material?: Cesium.MaterialProperty | any | string;
  outline?: boolean;
  outlineColor?: any | string;
  outlineWidth?: number;
  clampToGround?: boolean;
  heightReference?: any;
  extrudedHeight?: number;
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface RectangleOptions {
  coordinates: Cesium.Rectangle;
  renderMode?: 'auto' | 'entity' | 'primitive';
  material?: Cesium.MaterialProperty | any | string;
  outline?: boolean;
  outlineColor?: any | string;
  outlineWidth?: number;
  clampToGround?: boolean;
  height?: number;
  heightReference?: any;
  extrudedHeight?: number;
  heightEpsilon?: number;
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface CircleOptions {
  position: OverlayPosition;
  radius: number;
  /** 渲染模式：auto(默认) / entity / primitive（预留） */
  renderMode?: 'auto' | 'entity' | 'primitive';
  material?: Cesium.MaterialProperty | any | string;
  outline?: boolean;
  outlineColor?: any | string;
  outlineWidth?: number;
  segments?: number;
  clampToGround?: boolean;
  heightReference?: any;
  extrudedHeight?: number;
  heightEpsilon?: number; // 高度容差，用于环形方案
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  onClick?: (entity: Entity) => void;
  id?: string;
}

export interface RingOptions {
  /** 中心点（经纬度/高度 或 Cartesian3） */
  position: OverlayPosition;
  /** 半径（米） */
  radius: number;
  /** 边缘发光颜色 */
  color?: any | string;
  /** 是否绘制内层线（默认 true）。关闭可去掉“白色芯子” */
  showInnerLine?: boolean;
  /** 内层线颜色 */
  lineColor?: any | string;
  /** 内层线型：实线/虚线（默认 solid） */
  lineStyle?: 'solid' | 'dashed';
  /** 虚线材质方案：stripe(默认) / dash */
  lineMaterialMode?: 'stripe' | 'dash';
  /** stripe 模式：条纹重复次数（默认 32） */
  stripeRepeat?: number;
  /** 虚线长度（像素，默认 16） */
  dashLength?: number;
  /** 虚线模式（16bit pattern，可选） */
  dashPattern?: number;
  /** 虚线间隙颜色（默认透明） */
  gapColor?: any | string;
  /** 线宽（像素） */
  width?: number;
  /** 外层发光线宽（像素）。优先于 width */
  glowWidth?: number;
  /** 内层线宽（像素）。不传则使用自动计算 */
  lineWidth?: number;
  /** 发光强度（0-1），越大越“亮/粗” */
  glowPower?: number;
  /** 是否贴地（默认 true） */
  clampToGround?: boolean;
  /** 圆环分段数（默认 128），越大越圆滑 */
  segments?: number;
  clickHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  hoverHighlight?: boolean | { color?: any | string; fillAlpha?: number };
  /** 覆盖物点击回调 */
  onClick?: (entity: Entity) => void;
  id?: string;
}

export declare class CesiumOverlayService {
  constructor(viewer: Viewer);
  addMarker(options: MarkerOptions): any; // 返回 Cesium.Entity
  addLabel(options: LabelOptions): any; // 返回 Cesium.Entity
  addIcon(options: IconOptions): any; // 返回 Cesium.Entity
  addSvg(options: SvgOptions): any; // 返回 Cesium.Entity
  addInfoWindow(options: InfoWindowOptions): any; // 返回 Cesium.Entity
  addPolyline(options: PolylineOptions): any; // 返回 Cesium.Entity
  addPolygon(options: PolygonOptions): any; // 返回 Cesium.Entity
  addRectangle(options: RectangleOptions): any; // 返回 Cesium.Entity
  addCircle(options: CircleOptions): any; // 返回 Cesium.Entity
  addRing(options: RingOptions): any; // 返回 Cesium.Entity
  getOverlay(id: string): any | undefined; // 返回 Cesium.Entity | undefined
  removeOverlay(id: string): boolean;
  removeAllOverlays(): void;
  updateOverlayPosition(id: string, position: Cartesian3 | [number, number, number?]): boolean;
  setOverlayVisible(id: string, visible: boolean): boolean;
  getAllOverlayIds(): string[];
  getAllOverlays(): any[]; // Cesium.Entity[]
  destroy(): void;
}

// 单个信息窗口工具类（与 libs/overlay/MapInfoWindow.ts 保持一致）
export declare class MapInfoWindow {
  constructor(viewer: Viewer, container: HTMLElement);
  setDefaultUpdateInterval(ms: number): void;
  forceUpdateAll(): void;
  add(options: InfoWindowOptions): Entity;
  update(options: Partial<InfoWindowOptions> & { id: string }): void;
  updatePosition(entity: Entity, position: OverlayPosition): void;
  setVisible(entity: Entity, visible: boolean): void;
  remove(entity: Entity): void;
  removeAll(): void;
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

export declare class MapRing {
  constructor(viewer: Viewer);
  add(options: RingOptions): Entity;
  updatePosition(entity: Entity, position: OverlayPosition): void;
  updateRadius(entity: Entity, radius: number): void;
  updateStyle(
    entity: Entity,
    options: Partial<
      Pick<
        RingOptions,
        | 'color'
        | 'showInnerLine'
        | 'lineColor'
        | 'lineStyle'
        | 'lineMaterialMode'
        | 'stripeRepeat'
        | 'dashLength'
        | 'dashPattern'
        | 'gapColor'
        | 'width'
        | 'glowWidth'
        | 'lineWidth'
        | 'glowPower'
        | 'clampToGround'
        | 'segments'
      >
    >
  ): void;
  setVisible(entity: Entity, visible: boolean): void;
  remove(entityOrId: Entity | string): boolean;
}

// toolbar: 相机控制器及服务（与工具栏相关类保持一致）
export interface MapInitialCenter {
  longitude: number;
  latitude: number;
  height: number;
}

export interface CesiumMapControllerOptions {
  initialCenter?: MapInitialCenter;
  getMapTypes?: () => MapType[];
  getCurrentMapTypeId?: () => string;
  getToken?: () => string;
  zoomCallback?: ZoomCallback;
  onSceneModeChanged?: () => void;
}

export declare class CesiumMapController {
  constructor(viewer: Viewer, options?: CesiumMapControllerOptions);
  setupCameraZoomLimitListener(): void;
  getCurrentZoomLevel(): number;
  setZoomLevel(zoomLevel: number): void;
  zoomIn(): void;
  zoomOut(): void;
  toggle2D3D(buttonElement: HTMLElement): void;
  resetLocation(): void;
  setInitialCenter(center: MapInitialCenter): void;
  getInitialCenter(): MapInitialCenter | undefined;
  toggleFullscreen(): void;
  isFullscreen(): boolean;
  enterFullscreen(): void;
  exitFullscreen(): void;
}

export interface MapLayersServiceConfig {
  mapTypes: MapType[];
  currentMapType: string;
  token: string;
  isNoFlyZoneChecked: boolean;
  isNoFlyZoneVisible: boolean;
  onMapTypeChange?: (mapTypeId: string) => void;
  onNoFlyZoneToggle?: (isChecked: boolean) => void;
  onShowNoFlyZones?: () => Promise<void> | void;
}

export declare class MapLayersService {
  constructor(viewer: Viewer, toolbarElement: HTMLElement, config: MapLayersServiceConfig);
  updateConfig(config: Partial<MapLayersServiceConfig>): void;
  toggleLayers(buttonElement: HTMLElement): void;
  switchMapType(mapTypeId: string): void;
  getCurrentMapType(): string;
  closeLayersMenu(): void;
  destroy(): void;
}

export declare class SearchService {
  constructor(viewer: Viewer, toolbarElement: HTMLElement, searchCallback?: SearchCallback);
  setSearchCallback(callback: SearchCallback): void;
  toggleSearch(buttonElement: HTMLElement): void;
  displaySearchResults(results: SearchResult[], container: HTMLElement): void;
  selectSearchResult(result: SearchResult): void;
  closeSearchContainer(): void;
  destroy(): void;
}

export interface NotFlyZonesServiceConfig {
  extrudedHeight?: number;
  autoLoad?: boolean;
}

export declare class NotFlyZonesService {
  constructor(viewer: Viewer, config?: NotFlyZonesServiceConfig);
  showNoFlyZones(): Promise<void>;
  hideNoFlyZones(): void;
  toggleNoFlyZones(): Promise<void>;
  getNoFlyZoneVisible(): boolean;
  destroy(): void;
}

// 工具栏按钮默认配置与排序（来自 MapToolBarConfig.ts）
export declare const defaultButtonSorts: Record<string, number>;
export declare const defaultButtons: ButtonConfig[];

// 绘制相关类型（与内部实现保持一致）
// 绘制底层工具类型（与 drawHelper/BaseDraw.ts 保持一致）
export interface DrawResult {
  entity: Entity | null;
  type: 'line' | 'polygon' | 'rectangle' | 'circle';
  positions: Cartesian3[];
  distance?: number;
  areaKm2?: number;
}

export interface DrawCallbacks {
  onDrawStart?: () => void;
  onDrawEnd?: (entity: Entity | null, result: DrawResult) => void;
  onEntityRemoved?: (entity: Entity) => void;
  onMeasureComplete?: (result: DrawResult) => void;
}

export interface DrawOptions {
  strokeColor?: Cesium.Color | string;
  strokeWidth?: number;
  fillColor?: Cesium.Color | string;
  outlineColor?: Cesium.Color | string;
  outlineWidth?: number;
  heightEpsilon?: number;
  selected?: {
    color?: Cesium.Color | string;
    width?: number;
    outlineColor?: Cesium.Color | string;
    outlineWidth?: number;
  };
  /**
   * 是否显示面积标签（适用于 polygon/rectangle/circle）。
   * 默认 true；设为 false 可禁用绘制完成后自动创建的面积标签。
   */
  showAreaLabel?: boolean;
  /**
   * 多边形自相交校验：是否允许“擦边/顶点落在旧边上”等仅接触（touch）情况。
   * - false/未设置：touch 也视为不合法
   * - true：允许 touch，但仍不允许重叠（overlap）与真正穿越（cross）
   */
  selfIntersectionAllowTouch?: boolean;

  /**
   * 多边形自相交校验：当即将产生自相交时，是否仍允许继续绘制/完成绘制。
   * - false/未设置：检测到自相交则阻止落点/阻止完成
   * - true：检测到自相交不拦截（由业务自行承担后续面积/中心等偏差风险）
   */
  selfIntersectionAllowContinue?: boolean;
  onClick?: (entity: Entity, type?: 'line' | 'polygon' | 'rectangle' | 'circle', positions?: Cartesian3[]) => void;
}

/**
 * 绘制模块扩展实体类型（用于在 Entity 上挂载绘图相关元数据）
 */
export interface DrawEntity extends Entity {
  _drawType?: 'line' | 'polygon' | 'rectangle' | 'circle';
  _drawOptions?: DrawOptions;
  _groundPositions?: Cartesian3[];
  _groundPosition?: Cartesian3;
  _groundRectangle?: Cesium.Rectangle;
  _radius?: number;
  _borderEntity?: Entity;
  /** 关联的测量/提示标签实体（例如面积标签） */
  _labelEntities?: Entity[];
  _onClick?: (entity: Entity, ...args: any[]) => void;
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
  /** 获取绘制实体关联的标签实体（例如面积标签） */
  getEntityLabelEntities(entity: Entity): Entity[];
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

// 底层抽象绘制类及具体实现（通过 `export * from './libs/drawHelper/index'` 暴露）
export declare abstract class BaseDraw {
  protected viewer: Viewer;
  protected scene: Cesium.Scene;
  protected entities: Cesium.EntityCollection;
  protected offsetHeight: number;
  protected originalDepthTestAgainstTerrain: boolean | null;
  protected originalRequestRenderMode: boolean | null;
  protected callbacks: DrawCallbacks;
  protected tempPositions: Cartesian3[];
  protected tempEntities: Entity[];
  protected tempLabelEntities: Entity[];
  protected finishedPointEntities: Entity[];
  protected drawOptions?: DrawOptions;
  protected resolveColor(input?: Cesium.Color | string): Cesium.Color;
  protected applySelectedStyleToEntity(entity: Entity): void;
  protected restoreOriginalStyleForEntity(entity: Entity): void;
  protected updateOffsetHeight(): void;
  protected pickGlobePosition(windowPosition: Cesium.Cartesian2): Cartesian3 | null;
  protected rememberOriginalRequestRenderModeIfNeeded(): void;
  protected restoreRequestRenderModeIfNeeded(): void;
  abstract updateDrawingEntity(previewPoint?: Cartesian3): void;
  abstract startDrawing(options?: DrawOptions): void;
  abstract finishDrawing(): DrawResult | null;
  abstract getDrawType(): 'line' | 'polygon' | 'rectangle' | 'circle';
}

export declare class DrawLine extends BaseDraw {
  updateDrawingEntity(previewPoint?: Cartesian3): void;
  startDrawing(options?: DrawOptions): void;
  finishDrawing(): DrawResult | null;
  getDrawType(): 'line';
}

export declare class DrawPolygon extends BaseDraw {
  updateDrawingEntity(previewPoint?: Cartesian3): void;
  startDrawing(options?: DrawOptions): void;
  finishDrawing(): DrawResult | null;
  getDrawType(): 'polygon';
}

export declare class DrawRectangle extends BaseDraw {
  updateDrawingEntity(previewPoint?: Cartesian3): void;
  startDrawing(options?: DrawOptions): void;
  finishDrawing(): DrawResult | null;
  getDrawType(): 'rectangle';
}

export declare class DrawCircle extends BaseDraw {
  updateDrawingEntity(previewPoint?: Cartesian3): void;
  startDrawing(options?: DrawOptions): void;
  finishDrawing(): DrawResult | null;
  getDrawType(): 'circle';
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

// Heatmap-related types
export interface HeatmapOptions {
  intensity?: number;
  radius?: number;
  gradient?: Record<number, string>;
}

export interface HeatmapLayer {
  addData(data: { x: number; y: number; value: number }[]): void;
  setOptions(options: HeatmapOptions): void;
  clear(): void;
}
