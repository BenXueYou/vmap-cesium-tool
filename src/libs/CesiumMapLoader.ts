import * as Cesium from 'cesium'
import { Ion, Viewer, createWorldTerrainAsync, Terrain, Cartesian3, SampledPositionProperty, TerrainProvider } from 'cesium'
import type { Entity, Viewer as CesiumViewer, EntityCollection } from 'cesium'


interface InitOptions {
  terrain: Terrain, // 地形
  terrainProvider?: TerrainProvider // 地形提供者
  mapType?: string // 地图类型，默认为天地图
  imageryProvider?: Cesium.UrlTemplateImageryProvider // 自定义影像图层提供r
  imageryLayers?: Cesium.ImageryLayerCollection // 自定义影像图层集合
  terrainShadows?: Cesium.ShadowMode // 地形阴影
  contextOptions?: Cesium.ContextOptions // 上下文选项
  scene3DOnly?: boolean // 是否只使用3D场景
  selectionIndicator?: boolean // 选择指示器
  navigationHelpButton?: boolean // 导航帮助按钮
  fullscreenButton?: boolean // 全屏按钮
  geocoder?: boolean // 地理编码器
  homeButton?: boolean // 主页按钮
  infoBox?: boolean // 信息框
  vrButton?: boolean // VR按钮
  sceneModePicker?: boolean // 场景模式选择器
  timeline?: boolean // 时间轴
  animation?: boolean // 动画
  baseLayerPicker?: boolean // 基础图层选择器
  navigationInstructionsInitiallyVisible?: boolean // 导航指令初始可见
  clock?: Cesium.Clock // 时钟
  sceneMode?: Cesium.SceneMode // 场景模式
  screenSpaceEventHandler?: Cesium.ScreenSpaceEventHandler // 屏幕空间事件处理器
  useDefaultRenderLoop?: boolean // 使用默认渲染循环
  targetFrameRate?: number // 目标帧率
  showRenderLoopErrors?: boolean // 显示渲染循环错误
  automaticallyTrackDataSourceClocks?: boolean // 自动跟踪数据源时钟
  dataSources?: Cesium.DataSourceCollection // 数据源集合
  creationTime?: number // 创建时间
  useBrowserRecommendedResolution?: boolean // 使用浏览器推荐分辨率
  resolutionScale?: number // 分辨率缩放
  orderIndependentTransparency?: boolean // 无序透明度
  shadows?: boolean // 阴影
  terrainExaggeration?: number // 地形夸张系数
  maximumScreenSpaceError?: number // 最大屏幕空间误差
  maximumNumberOfLoadedTiles?: number // 最大加载瓦片数量
}

interface MapCenter {
  latitude: number
  longitude: number
  height: number,
  pitch?: number
  heading?: number
}

interface TianDiMap {
  url: string,
  subdomains: string[],
  minimumLevel: number,
  maximumLevel: number,
  credit: string
}
interface GaoDeMap {
  url: string,
  subdomains: string[],
  minimumLevel: number,
  maximumLevel: number,
  credit: string
}

export function createTianDiMap(): TianDiMap {
  return {
    url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}',
    subdomains: ['1', '2', '3', '4'], // 必须使用数字子域
    minimumLevel: 3,
    maximumLevel: 18,
    credit: '© 高德地图'
  }
}

export function createGaoDeMap(): Cesium.UrlTemplateImageryProvider {
  return new Cesium.UrlTemplateImageryProvider({
    url: 'https://webst0{s}.is.autonavi.com/appmaptile?style=7&x={x}&y={y}&z={z}',
    subdomains: ['1', '2', '3', '4'], // 必须使用数字子域
    minimumLevel: 3,
    maximumLevel: 18,
    credit: '© 高德地图'
  })
}

export async function initCesium(
  containerId: string,
  options: InitOptions,
  mapCenter: MapCenter = { longitude: 120.2052342, latitude: 30.2489634, height: 1000, pitch: -60, heading: 0 }
): Promise<CesiumViewer> {
  Ion.defaultAccessToken = (import.meta as any).env.VITE_CESIUM_TOKEN
  const viewer = new Viewer(containerId, {
    timeline: false,
    animation: false,
    baseLayerPicker: false,
    ...options
  })
  // 地形提供者
  if (!options.terrainProvider && !options.terrain) {
    viewer.terrainProvider = await createWorldTerrainAsync()
  }
  // 添加高德图影像图层
  if (options.mapType === 'gaode') {
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(createGaoDeMap());
  }
  if (mapCenter) {
    // 设置初始视角为中国区域 (经度, 纬度, 高度)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(mapCenter.longitude, mapCenter.latitude, mapCenter.height), // 中国中心坐标
      orientation: {
        heading: Cesium.Math.toRadians(mapCenter.heading || 0), // 方向角度
        pitch: Cesium.Math.toRadians(mapCenter.pitch || -30), // 俯
      }
    });
  }
  return viewer
}