// VMap Cesium Toolbar Plugin Type Definitions

import type { Viewer, Cartesian3, Cartographic } from 'cesium';

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

export declare class DrawHelper {
  constructor(viewer: Viewer);
  startDrawingLine(): void;
  startDrawingPolygon(): void;
  startDrawingRectangle(): void;
  drawFrustum(options?: FrustumOptions): void;
  endDrawing(): void;
  clearAll(): void;
  clearFrustum(): void;
  removeEntity(entity: any): void; // Cesium.Entity
  getFinishedEntities(): any[]; // Cesium.Entity[]
  onDrawStart(callback: () => void): void;
  onDrawEnd(callback: (entity: any) => void): void; // Cesium.Entity | null
  onEntityRemoved(callback: (entity: any) => void): void; // Cesium.Entity
  destroy(): void;
}

export declare function initCesium(
  containerId: string,
  options: InitOptions,
  mapCenter?: MapCenter,
  cesiumToken?: String
): Promise<{ viewer: Viewer; initialCenter: MapCenter }>;

// 默认导出
declare const _default: {
  CesiumMapToolbar: typeof CesiumMapToolbar;
  DrawHelper: typeof DrawHelper;
  initCesium: typeof initCesium;
};

export default _default;
