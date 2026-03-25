import * as Cesium from 'cesium';
import type { 
  ToolbarConfig, 
  MapToolsConfig, 
  MapType, 
  ComponentStyleConfig,
  MapPluginOptions,
  CameraConfig,
  LayersConfig,
  ProviderType,
  TDTLayerConfig
} from './types';
import { 
  DEFAULT_TOOLBAR_STYLE, 
  DEFAULT_MAP_TYPES, 
  DEFAULT_CAMERA_CONFIG,
  DEFAULT_PROVIDER_TYPE,
} from './constants';

import { 
  createTDTImageryConfig,
  createTDTVectorConfig,
  createTDTTerrainConfig 
} from './layers/TDTMapLayer';

import {
  createGaodeImageryConfig,
  createGaodeVectorConfig
} from './layers/GaodeMapLayer';

import {
  createBaiduImageryConfig
} from './layers/BaiduMapLayer';

import {
  createOSMConfig
} from './layers/OSMMapLayer';

/**
 * 地图插件核心类
 * 负责整合所有地图功能，提供统一的 API 接口
 */
export class MapPlugin {
  private viewer: Cesium.Viewer | null = null;
  private containerId: string;
  
  // 分层配置
  private viewerOptions: Cesium.Viewer.ConstructorOptions;
  private cameraConfig: CameraConfig;
  private layersConfig: LayersConfig;
  private cesiumToken: string;
  
  // 工具栏和样式配置
  private toolbarConfig: ToolbarConfig;
  private styleConfig: ComponentStyleConfig;
  
  private isInitialized = false;

  /**
   * 构造函数
   * @param containerId 地图容器 ID
   * @param options 地图插件配置选项
   */
  constructor(
    containerId: string,
    options: Partial<MapPluginOptions> = {}
  ) {
    this.containerId = containerId;
    
    // 解析分层配置
    this.viewerOptions = options.viewerOptions || {};
    this.cameraConfig = this.mergeCameraConfig(options.camera);
    this.layersConfig = this.mergeLayersConfig(options.layers);
    this.cesiumToken = options.cesiumToken || '';
    
    // 工具栏和样式配置（保持向后兼容）
    this.toolbarConfig = DEFAULT_TOOLBAR_STYLE;
  }

  /**
   * 合并相机配置
   */
  private mergeCameraConfig(config?: Partial<CameraConfig>): CameraConfig {
    return {
      ...DEFAULT_CAMERA_CONFIG,
      ...config,
    };
  }

  /**
   * 合并图层配置
   */
  private mergeLayersConfig(config?: Partial<LayersConfig>): LayersConfig {
    const providerType = config?.type || DEFAULT_PROVIDER_TYPE;
    
    const result: LayersConfig = {
      type: providerType,
      tdt: config?.tdt,
      gaode: config?.gaode,
      baidu: config?.baidu,
      arcgis: config?.arcgis,
      osm: config?.osm,
      custom: config?.custom,
    };

    // 如果没有提供具体配置，使用默认值
    if (providerType === 'tdt' && !result.tdt) {
      result.tdt = {
        mapTypeId: 'img',
        token: '',
        showLabel: true,
      };
    }

    return result;
  }

  /**
   * 初始化地图
   */
  async initialize(): Promise<Cesium.Viewer> {
    if (this.isInitialized) {
      return this.viewer!;
    }

    try {
      // 创建地图容器
      const container = document.getElementById(this.containerId);
      if (!container) {
        throw new Error(`找不到 ID 为"${this.containerId}"的容器元素`);
      }
      // 创建 Cesium Viewer
      const viewerOptions: Cesium.Viewer.ConstructorOptions = {
        ...this.viewerOptions,
        animation: this.viewerOptions.animation ?? false,
        timeline: this.viewerOptions.timeline ?? false,
        navigationHelpButton: this.viewerOptions.navigationHelpButton ?? false,
        fullscreenButton: this.viewerOptions.fullscreenButton ?? false,
        geocoder: this.viewerOptions.geocoder ?? false,
        homeButton: this.viewerOptions.homeButton ?? false,
        baseLayerPicker: this.viewerOptions.baseLayerPicker ?? false,
        sceneModePicker: this.viewerOptions.sceneModePicker ?? false,
        infoBox: this.viewerOptions.infoBox ?? false,
        selectionIndicator: this.viewerOptions.selectionIndicator ?? false,
      };

      // 设置 Cesium Ion token
      if (this.cesiumToken) {
        Cesium.Ion.defaultAccessToken = this.cesiumToken;
        // 使用索引签名访问以绕过类型检查（Cesium 某些版本 ConstructorOptions 不包含 accessToken）
        (viewerOptions as any).accessToken = this.cesiumToken;
      }

      this.viewer = new Cesium.Viewer(container, viewerOptions);

      // 隐藏版权信息
      (this.viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

      // 添加地图图层
      await this.addLayers();

      // 设置相机视图
      this.setCameraView();

      this.isInitialized = true;
      console.log('MapPlugin 初始化完成');
      return this.viewer;
    } catch (error) {
      console.error('MapPlugin 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 添加地图图层
   */
  private async addLayers(): Promise<void> {
    if (!this.viewer) return;

    const { type, tdt, gaode, baidu, osm, custom } = this.layersConfig;

    // 清除默认图层
    this.viewer.imageryLayers.removeAll();

    switch (type) {
      case 'tdt':
        this.addTDTLayers(tdt);
        break;
      case 'gaode':
        this.addGaodeLayers(gaode);
        break;
      case 'baidu':
        this.addBaiduLayers(baidu);
        break;
      case 'osm':
        this.addOSMLayers(osm);
        break;
      case 'custom':
        this.addCustomLayers(custom);
        break;
      default:
        // 默认添加天地图影像图层
        this.addTDTLayers(tdt);
    }
  }

  /**
   * 添加天地图图层
   */
  private addTDTLayers(config?: TDTLayerConfig): void {
    if (!this.viewer) return;

    const token = config?.token || '';
    const mapTypeId = config?.mapTypeId || 'img';
    const showLabel = config?.showLabel ?? true;

    let providers: Cesium.ImageryProvider[] = [];

    switch (mapTypeId) {
      case 'vec':
        providers = createTDTVectorConfig(token);
        break;
      case 'img':
        providers = createTDTImageryConfig(token);
        break;
      case 'ter':
        providers = createTDTTerrainConfig(token);
        break;
      default:
        providers = createTDTImageryConfig(token);
    }

    // 如果不显示注记，只添加底图
    if (!showLabel && providers.length > 1) {
      providers = [providers[0]];
    }

    providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 添加高德地图图层
   */
  private addGaodeLayers(config?: import('./types').GaodeLayerConfig): void {
    if (!this.viewer) return;

    const token = config?.token;
    const mapTypeId = config?.mapTypeId || 'satellite';
    const showLabel = config?.showLabel ?? true;

    let providers: Cesium.ImageryProvider[] = [];

    switch (mapTypeId) {
      case 'vector':
        providers = createGaodeVectorConfig(token);
        break;
      case 'satellite':
        providers = createGaodeImageryConfig(token);
        break;
      default:
        providers = createGaodeImageryConfig(token);
    }

    // 如果不显示注记，只添加底图
    if (!showLabel && providers.length > 1) {
      providers = [providers[0]];
    }

    providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 添加百度地图图层
   */
  private addBaiduLayers(config?: import('./types').BaiduLayerConfig): void {
    if (!this.viewer) return;

    const token = config?.token;
    const mapTypeId = config?.mapTypeId || 'satellite';

    // 目前只提供影像图层
    const providers = createBaiduImageryConfig(token);
    providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 添加 OSM 图层
   */
  private addOSMLayers(config?: import('./types').OSMLayerConfig): void {
    if (!this.viewer) return;

    const providers = createOSMConfig();
    providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 添加自定义图层
   */
  private addCustomLayers(config?: import('./types').CustomLayerConfig): void {
    if (!this.viewer || !config?.providers) return;

    config.providers.forEach(provider => {
      this.viewer!.imageryLayers.addImageryProvider(provider);
    });
  }

  /**
   * 设置相机视图
   */
  private setCameraView(): void {
    if (!this.viewer) return;

    const { center, pitch, heading, roll } = this.cameraConfig;
    const [longitude, latitude, height] = center;

    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      orientation: {
        heading: Cesium.Math.toRadians(heading || 0),
        pitch: Cesium.Math.toRadians(pitch || -45),
        roll: Cesium.Math.toRadians(roll || 0),
      },
    });
  }
  /**
   * 获取 Cesium Viewer 实例
   */
  getViewer(): Cesium.Viewer | null {
    return this.viewer;
  }

  /**
   * 获取当前配置
   */
  getConfig(): MapPluginOptions {
    return {
      viewerOptions: { ...this.viewerOptions },
      camera: { ...this.cameraConfig },
      layers: { ...this.layersConfig },
      cesiumToken: this.cesiumToken,
    };
  }

  /**
   * 更新相机配置
   */
  updateCamera(config: Partial<CameraConfig>): void {
    this.cameraConfig = this.mergeCameraConfig(config);
    // 如果已初始化，立即应用新配置
    if (this.isInitialized) {
      this.setCameraView();
    }
  }

  /**
   * 更新图层配置
   */
  updateLayers(config: Partial<LayersConfig>): void {
    this.layersConfig = this.mergeLayersConfig(config);
    // 如果已初始化，立即应用新配置
    if (this.isInitialized) {
      this.addLayers();
    }
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
    this.isInitialized = false;
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && this.viewer !== null;
  }
}

/**
 * 创建地图插件实例的工厂函数
 * @param containerId 地图容器 ID
 * @param options 地图插件配置选项
 */
export function createMapPlugin(
  containerId: string,
  options?: Partial<MapPluginOptions>
): MapPlugin {
  return new MapPlugin(containerId, options);
}