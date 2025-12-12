import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import type { MapType, ZoomCallback } from './CesiumMapModel';
import { heightToZoomLevel, zoomLevelToHeight } from '../utils/common';

interface MapInitialCenter {
  longitude: number;
  latitude: number;
  height: number;
}

interface CesiumMapControllerOptions {
  initialCenter?: MapInitialCenter;
  /** 当前可用的地图类型列表（由外部维护），用于读取 maximumLevel 等配置 */
  getMapTypes?: () => MapType[];
  /** 获取当前底图类型 id（由外部维护） */
  getCurrentMapTypeId?: () => string;
  /** 获取当前天地图 token（用于从 provider 读取 maximumLevel 时保持行为一致） */
  getToken?: () => string;
  /** 缩放回调（来自 Toolbar 的 ZoomCallback） */
  zoomCallback?: ZoomCallback;
  /** 场景模式切换后回调（例如通知 DrawHelper 重新计算偏移） */
  onSceneModeChanged?: () => void;
}

/**
 * 负责地图相机控制、缩放层级和 2D/3D 切换等逻辑的控制器
 * 与 UI（工具栏）解耦，避免 Cesium 细节散落在各处。
 */
export class CesiumMapController {
  private viewer: Viewer;
  private initialCenter?: MapInitialCenter;
  private getMapTypes?: () => MapType[];
  private getCurrentMapTypeId?: () => string;
  private getToken?: () => string;
  private zoomCallback?: ZoomCallback;
  private onSceneModeChanged?: () => void;

  constructor(viewer: Viewer, options: CesiumMapControllerOptions = {}) {
    this.viewer = viewer;
    this.initialCenter = options.initialCenter;
    this.getMapTypes = options.getMapTypes;
    this.getCurrentMapTypeId = options.getCurrentMapTypeId;
    this.getToken = options.getToken;
    this.zoomCallback = options.zoomCallback;
    this.onSceneModeChanged = options.onSceneModeChanged;
  }

  /**
   * 监听相机缩放，限制层级范围到 [1, 18]，并参考当前底图的 maximumLevel
   */
  public setupCameraZoomLimitListener(): void {
    const camera = this.viewer.camera;
    camera.changed.addEventListener(() => {
      const currentLevel = this.getCurrentZoomLevel();

      let clampedLevel = Math.max(1, Math.min(18, currentLevel));

      let maximumLevel = 18;
      const mapTypes = this.getMapTypes ? this.getMapTypes() : undefined;
      const currentMapTypeId = this.getCurrentMapTypeId ? this.getCurrentMapTypeId() : undefined;
      if (mapTypes && currentMapTypeId) {
        const curMapType = mapTypes.find(mt => mt.id === currentMapTypeId);
        if (curMapType) {
          const token = this.getToken ? this.getToken() : '';
          const providers = curMapType.provider(token);
          // 这里的 token 由 provider 自行处理或由外层包装，控制器只读取 maximumLevel
          maximumLevel = (providers[0] as any)?.maximumLevel || 18;
          if (clampedLevel > maximumLevel) {
            clampedLevel = maximumLevel;
          }
        }
      }

      if (clampedLevel === 1 || currentLevel >= maximumLevel) {
        this.setZoomLevel(clampedLevel);
      }
    });
  }

  /**
   * 获取当前地图层级（1-18）
   */
  public getCurrentZoomLevel(): number {
    const height = this.viewer.camera.positionCartographic.height;
    return heightToZoomLevel(height);
  }

  /**
   * 设置地图层级
   * @param zoomLevel 目标层级（1-18）
   */
  public setZoomLevel(zoomLevel: number): void {
    try {
      const clampedLevel = Math.max(1, Math.min(18, zoomLevel));
      const targetHeight = zoomLevelToHeight(clampedLevel);

      if (!isFinite(targetHeight) || isNaN(targetHeight) || targetHeight <= 0) {
        console.warn(`无效的目标高度: ${targetHeight}，使用默认层级 ${clampedLevel}`);
        return;
      }

      let currentPosition: Cesium.Cartographic;
      try {
        currentPosition = this.viewer.camera.positionCartographic.clone();
        if (!isFinite(currentPosition.longitude) || !isFinite(currentPosition.latitude)) {
          currentPosition = Cesium.Cartographic.fromDegrees(120.2052342, 30.2489634);
        }
      } catch (error) {
        console.warn('获取当前相机位置失败，使用默认位置', error);
        currentPosition = Cesium.Cartographic.fromDegrees(120.2052342, 30.2489634);
      }

      this.viewer.camera.setView({
        destination: Cesium.Cartesian3.fromRadians(
          currentPosition.longitude,
          currentPosition.latitude,
          targetHeight
        ),
        orientation: {
          heading: this.viewer.camera.heading,
          pitch: this.viewer.camera.pitch,
          roll: this.viewer.camera.roll
        }
      });
    } catch (error) {
      console.error('设置地图层级失败:', error);
      try {
        const safeHeight = zoomLevelToHeight(10);
        const safePosition = Cesium.Cartographic.fromDegrees(120.2052342, 30.2489634);
        this.viewer.camera.setView({
          destination: Cesium.Cartesian3.fromRadians(
            safePosition.longitude,
            safePosition.latitude,
            safeHeight
          )
        });
      } catch (recoveryError) {
        console.error('恢复地图层级失败:', recoveryError);
      }
    }
  }

  /** 放大 */
  public zoomIn(): void {
    const currentLevel = this.getCurrentZoomLevel();
    const beforeHeight = this.viewer.camera.positionCartographic.height;

    let maximumLevel = 18;
    const mapTypes = this.getMapTypes ? this.getMapTypes() : undefined;
    const currentMapTypeId = this.getCurrentMapTypeId ? this.getCurrentMapTypeId() : undefined;
    if (mapTypes && currentMapTypeId) {
      const curMapType = mapTypes.find(im => im.id === currentMapTypeId);
      if (curMapType) {
        const token = this.getToken ? this.getToken() : '';
        const providerList = curMapType.provider(token);
        maximumLevel = (providerList[0] as any)?.maximumLevel || 18;
        if (currentLevel >= maximumLevel) return;
      }
    }

    const targetLevel = currentLevel + 1;
    this.setZoomLevel(targetLevel);
    const afterHeight = this.viewer.camera.positionCartographic.height;

    if (this.zoomCallback?.onZoomIn) {
      this.zoomCallback.onZoomIn(beforeHeight, afterHeight, currentLevel);
    }
  }

  /** 缩小 */
  public zoomOut(): void {
    const currentLevel = this.getCurrentZoomLevel();
    const beforeHeight = this.viewer.camera.positionCartographic.height;
    if (currentLevel <= 1) {
      return;
    }

    const targetLevel = currentLevel - 1;
    this.setZoomLevel(targetLevel);
    const afterHeight = this.viewer.camera.positionCartographic.height;

    if (this.zoomCallback?.onZoomOut) {
      this.zoomCallback.onZoomOut(beforeHeight, afterHeight, currentLevel);
    }
  }

  /**
   * 2D/3D 切换
   */
  public toggle2D3D(buttonElement: HTMLElement): void {
    const scene = this.viewer.scene;
    const camera = scene.camera;
    const currentMode = scene.mode;
    const targetMode = currentMode === Cesium.SceneMode.SCENE3D
      ? Cesium.SceneMode.SCENE2D
      : Cesium.SceneMode.SCENE3D;
    buttonElement.innerHTML = targetMode === Cesium.SceneMode.SCENE3D ? '3D' : '2D';

    const canvas = scene.canvas;
    const centerWindowPos = new Cesium.Cartesian2(
      canvas.clientWidth / 2,
      canvas.clientHeight / 2
    );

    let centerCartographic: Cesium.Cartographic | null = null;
    const pickRay = camera.getPickRay(centerWindowPos);
    if (pickRay) {
      const pickPos = scene.globe.pick(pickRay, scene);
      if (Cesium.defined(pickPos)) {
        centerCartographic = Cesium.Cartographic.fromCartesian(pickPos as Cesium.Cartesian3);
      }
    }

    const currentHeight = camera.positionCartographic.height;
    const savedHeading = camera.heading;
    const savedPitch = camera.pitch;
    const savedRoll = camera.roll;

    scene.mode = targetMode;

    if (this.onSceneModeChanged) {
      this.onSceneModeChanged();
    }

    if (centerCartographic) {
      const lon = centerCartographic.longitude;
      const lat = centerCartographic.latitude;

      if (targetMode === Cesium.SceneMode.SCENE2D) {
        camera.setView({
          destination: Cesium.Cartesian3.fromRadians(lon, lat, currentHeight),
          orientation: {
            heading: 0.0,
            pitch: -Math.PI / 2,
            roll: 0.0,
          },
        });
      } else {
        camera.setView({
          destination: Cesium.Cartesian3.fromRadians(lon, lat, currentHeight),
          orientation: {
            heading: savedHeading,
            pitch: savedPitch,
            roll: savedRoll,
          },
        });
      }
    }
  }

  /**
   * 复位到初始位置
   */
  public resetLocation(): void {
    if (!this.initialCenter) {
      console.warn('未设置初始中心点，无法执行复位操作');
      return;
    }

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        this.initialCenter.longitude,
        this.initialCenter.latitude,
        this.initialCenter.height
      ),
      duration: 1.0,
    });
  }

  public setInitialCenter(center: MapInitialCenter): void {
    this.initialCenter = center;
  }

  public getInitialCenter(): MapInitialCenter | undefined {
    return this.initialCenter;
  }
}
