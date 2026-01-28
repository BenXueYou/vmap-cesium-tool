import * as Cesium from 'cesium';
import type { Viewer, Cartesian3 } from 'cesium';
import { loadAllAirportNoFlyZones, type AirportNoFlyZone } from '../../utils/geojson';
import { i18n, type I18nLike } from '../../libs/i18n';

/**
 * 禁飞区服务配置接口
 */
export interface NotFlyZonesServiceConfig {
  extrudedHeight?: number; // 3D模式下的拉伸高度，默认1000米
  autoLoad?: boolean; // 是否自动加载，默认true
  i18n?: I18nLike;
  useI18n?: boolean;
}

/**
 * 禁飞区服务类
 * 负责处理机场禁飞区相关的所有逻辑
 */
export class NotFlyZonesService {
  private viewer: Viewer;
  private noFlyZoneEntities: Cesium.Entity[] = [];
  private isNoFlyZoneVisible: boolean = false;
  private isNoFlyZoneLoading: boolean = false;
  private readonly extrudedHeight: number;
  private i18n: I18nLike;
  private useI18n: boolean;

  constructor(viewer: Viewer, config: NotFlyZonesServiceConfig = {}) {
    this.viewer = viewer;
    this.extrudedHeight = config.extrudedHeight ?? 1000;
    this.i18n = config.i18n ?? i18n;
    this.useI18n = config.useI18n ?? true;

    // 如果配置了自动加载，则延迟加载
    if (config.autoLoad !== false) {
      setTimeout(() => {
        this.showNoFlyZones().catch((error) => {
          console.error('自动加载禁飞区失败:', error);
        });
      }, 500);
    }
  }

  /**
   * 加载并显示机场禁飞区
   */
  public async showNoFlyZones(): Promise<void> {
    if (this.isNoFlyZoneVisible || this.isNoFlyZoneLoading) {
      return; // 已经显示或正在加载，避免重复
    }

    this.isNoFlyZoneLoading = true;

    try {
      // 加载所有机场禁飞区数据
      const noFlyZones = await loadAllAirportNoFlyZones();

      // 清除之前的实体（如果有）
      this.hideNoFlyZones();

      // 为每个禁飞区创建实体
      noFlyZones.forEach((zone) => {
        const coordinates = zone.feature.geometry.coordinates[0]; // 获取外环坐标

        // 将 GeoJSON 坐标转换为 Cesium Cartesian3 数组
        const positions = coordinates.map((coord: number[]) => {
          const [longitude, latitude] = coord;
          return Cesium.Cartesian3.fromDegrees(longitude, latitude, 0);
        });

        // 创建多边形实体
        const polygonOptions = this.createNoFlyZonePolygonOptions(positions);
        const entity = this.viewer.entities.add({
          name: zone.name,
          polygon: polygonOptions,
          description: this.useI18n
            ? this.i18n.t('no_fly.description', { name: zone.name })
            : `机场禁飞区: ${zone.name}`,
        });
        (entity as any).disableDepthTestDistance = Number.POSITIVE_INFINITY;

        this.noFlyZoneEntities.push(entity);

        // 如果存在 extrudedHeight（3D 模式），单独添加顶面边界的 polyline，
        // 这样可以只显示顶面的轮廓，避免 polygon 在 top/bottom 同时绘制 outline 导致"重叠"外观。
        try {
          const is3DMode = this.viewer.scene.mode === Cesium.SceneMode.SCENE3D;
          const extrudedRaw = polygonOptions.extrudedHeight;
          const heightRaw = polygonOptions.height;

          const extrudedHeightValue = typeof extrudedRaw === 'number'
            ? extrudedRaw
            : (extrudedRaw as Cesium.Property | undefined)?.getValue(Cesium.JulianDate.now());

          const baseHeightValue = typeof heightRaw === 'number'
            ? heightRaw
            : (heightRaw as Cesium.Property | undefined)?.getValue(Cesium.JulianDate.now());

          const topHeight = (extrudedHeightValue ?? baseHeightValue) ?? 0;

          if (is3DMode && topHeight > 0) {
            const topPositions = positions.map((p) => {
              const carto = Cesium.Cartographic.fromCartesian(p);
              return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, topHeight);
            });

            const outlineEntity = this.viewer.entities.add({
              name: `${zone.name}_top_outline`,
              polyline: {
                positions: topPositions,
                width: 2,
                material: Cesium.Color.RED,
                clampToGround: false,
              }
            });
            (outlineEntity as any).disableDepthTestDistance = Number.POSITIVE_INFINITY;
            this.noFlyZoneEntities.push(outlineEntity);
          }
        } catch (e) {
          // 忽略边界绘制失败，不影响主多边形显示
        }
      });

      this.isNoFlyZoneVisible = true;
      console.log(`已加载 ${noFlyZones.length} 个机场禁飞区`);
    } catch (error) {
      console.error('加载机场禁飞区失败:', error);
    } finally {
      this.isNoFlyZoneLoading = false;
    }
  }

  /**
   * 隐藏机场禁飞区
   */
  public hideNoFlyZones(): void {
    // 移除所有禁飞区实体
    this.noFlyZoneEntities.forEach((entity) => {
      this.viewer.entities.remove(entity);
    });
    this.noFlyZoneEntities = [];
    this.isNoFlyZoneVisible = false;
  }

  /**
   * 切换机场禁飞区显示状态
   */
  public toggleNoFlyZones(): Promise<void> {
    if (this.isNoFlyZoneVisible) {
      this.hideNoFlyZones();
      return Promise.resolve();
    } else {
      return this.showNoFlyZones();
    }
  }

  /**
   * 获取禁飞区显示状态
   */
  public getNoFlyZoneVisible(): boolean {
    return this.isNoFlyZoneVisible;
  }

  /**
   * 创建禁飞区多边形配置选项
   * @param positions - 多边形的顶点坐标数组，使用笛卡尔坐标系
   * @returns 返回一个包含多边形图形配置选项的对象
   */
  private createNoFlyZonePolygonOptions(
    positions: Cartesian3[]
  ): Cesium.PolygonGraphics.ConstructorOptions {
    const is3DMode = this.viewer.scene.mode === Cesium.SceneMode.SCENE3D;

    const hoverHeight = is3DMode ? 2 : 0; // 可根据需要调大到 5-10m 来避免近裁剪

    // 在3D模式下设置悬停高度为2米，2D模式下为0
    // 将传入 positions 标准化为海拔 0（避免 positions 中意外的高度影响渲染）
    const normalizedPositions = positions.map((p) => {
      try {
        const carto = Cesium.Cartographic.fromCartesian(p);
        return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
      } catch (e) {
        return p; // 若转换失败则回退使用原点
      }
    });

    // 确保场景不会因地形深度测试而遮挡实体（只需设置一次，安全操作）
    try {
      if (this.viewer && this.viewer.scene && this.viewer.scene.globe) {
        this.viewer.scene.globe.depthTestAgainstTerrain = false;
      }
    } catch (e) {
      // 忽略无法设置的情况
    }

    return {
      hierarchy: new Cesium.PolygonHierarchy(normalizedPositions),
      material: Cesium.Color.RED.withAlpha(0.3),
      // 在 3D 模式下，我们不依赖 polygon 自带的 outline（会在 top/bottom 同时渲染），
      // 代码中会单独绘制顶面轮廓 polyline，避免重复/重叠视觉效果。
      outline: is3DMode ? false : true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 2,
      perPositionHeight: false,
      heightReference: Cesium.HeightReference.NONE,
      height: hoverHeight,
      extrudedHeight: is3DMode ? this.extrudedHeight : undefined,
      classificationType: Cesium.ClassificationType.BOTH,
    };
  }

  /**
   * 销毁禁飞区服务
   */
  public destroy(): void {
    this.hideNoFlyZones();
  }
}

