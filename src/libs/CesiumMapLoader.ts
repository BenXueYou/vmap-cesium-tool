import * as Cesium from 'cesium'
import { Ion, Viewer, createWorldTerrainAsync, Terrain, Cartesian3, SampledPositionProperty, TerrainProvider } from 'cesium'
import type { Entity, Viewer as CesiumViewer, EntityCollection } from 'cesium'
import { TDTMapTypes } from './CesiumMapConfig'
import { getViteTdToken } from '../utils/common'
interface InitOptions {
  terrain?: Terrain, // 地形
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
  isFly?: boolean // flyTo动画
  flyDuration?: number // flyTo动画时长
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
  depthTestAgainstTerrain?: boolean // 是否启用地形深度测试
  terrainExaggeration?: number // 地形夸张系数
  maximumScreenSpaceError?: number // 最大屏幕空间误差
  maximumNumberOfLoadedTiles?: number // 最大加载瓦片数量
  token?: string, // 访问令牌
  cesiumToken?: string // 访问令牌
  success?: () => void // flyTo动画完成回调
  cancel?: () => void // flyTo动画取消回调
}

interface MapCenter {
  latitude: number
  longitude: number
  height: number,
  pitch?: number
  heading?: number
}

const defaultMapOptions: InitOptions = {
  infoBox: false, // 禁用信息框以减少交互冲突
  geocoder: false, // 禁用地理编码器
  timeline: false, // 禁用时间轴
  animation: false, // 禁用动画
  homeButton: false, // 禁用主页按钮
  sceneModePicker: false, // 禁用场景模式选择器
  baseLayerPicker: false, // 禁用基础图层选择器
  fullscreenButton: false, // 禁用全屏按钮
  selectionIndicator: false, // 禁用选取指示器以减少交互冲突
  showRenderLoopErrors: false, // 报错是否弹出错误
  navigationHelpButton: false, // 禁用导航帮助按钮
  useBrowserRecommendedResolution: false, // 设置为false使用window.devicePixelRatio属性
  automaticallyTrackDataSourceClocks: false, // 设置成true，使用公共clock对象，设置false，所有功能使用独立clock对象
  contextOptions: {
    webgl: {
      preserveDrawingBuffer: !0,
    },
  },
  navigationInstructionsInitiallyVisible: false, // 禁用导航指令初始可见
}

export async function initCesium(
  containerId: string,
  options: InitOptions,
  mapCenter: MapCenter = {
    longitude: 120.2052342,
    latitude: 30.2489634,
    height: 1000,
    pitch: -45,
    heading: 0
  },
  defaultAccessToken = (import.meta as any).env.VITE_CESIUM_TOKEN
): Promise<{ viewer: CesiumViewer; initialCenter: MapCenter }> {
  Ion.defaultAccessToken = options.cesiumToken || defaultAccessToken
  const viewer = new Viewer(containerId, {
    ...defaultMapOptions,
    ...options
  });
  (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';
  viewer.scene.postProcessStages.fxaa.enabled = false;
  viewer.scene.globe.depthTestAgainstTerrain = options.depthTestAgainstTerrain || false; // 启用地形深度测
  // 地形提供者
  if (!options.terrainProvider && !options.terrain) {
    viewer.terrainProvider = await createWorldTerrainAsync();
  }
  viewer.imageryLayers.remove(viewer.imageryLayers.get(0))
  const token = options.token || getViteTdToken();
  // 添加高德图影像图层
  if (options.mapType === 'tiandi') {
    viewer.imageryLayers.removeAll();
    TDTMapTypes.find(type => type.id === 'imagery')?.provider(token).forEach(provider => {
      viewer.imageryLayers.addImageryProvider(provider);
    });
  }
  if (mapCenter && !options.isFly) {
    // 设置初始视角为中国区域 (经度, 纬度, 高度)
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(mapCenter.longitude, mapCenter.latitude, mapCenter.height), // 中国中心坐标
      orientation: {
        heading: Cesium.Math.toRadians(mapCenter.heading || 0), // 方向角度
        pitch: Cesium.Math.toRadians(mapCenter.pitch || 0), // 俯
      }
    });
  }
  if (mapCenter && options.isFly) {
    // 设置初始视角为中国区域 (经度, 纬度, 高度)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(mapCenter.longitude, mapCenter.latitude, mapCenter.height), // 中国中心坐标
      orientation: {
        heading: Cesium.Math.toRadians(mapCenter.heading || 0), // 方向角度
        pitch: Cesium.Math.toRadians(mapCenter.pitch || 0), // 俯
      },
      duration: options.flyDuration ? options.flyDuration : 3, // 动画时间
      complete () {
        // 飞行完成后的回调函数
        options.success && options.success();
      },
      cancel () {
        // 飞行取消后的回调函数
        options.cancel && options.cancel();
      }
    });
  }
  return { viewer, initialCenter: mapCenter }
}