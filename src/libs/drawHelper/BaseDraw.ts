import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3 } from "cesium";
import { isValidCartesian3, formatDistance, formatArea } from '../../utils/calc';

/**
 * 绘制结果接口
 */
export interface DrawResult {
  entity: Entity | null;
  type: "line" | "polygon" | "rectangle" | "circle";
  positions: Cartesian3[];
  distance?: number;
  areaKm2?: number;
}

/**
 * 绘制回调接口
 */
export interface DrawCallbacks {
  onDrawStart?: () => void;
  onDrawEnd?: (entity: Entity | null) => void;
  onEntityRemoved?: (entity: Entity) => void;
  onMeasureComplete?: (result: DrawResult) => void;
}

/**
 * 基础绘制类
 * 包含所有绘制类型的通用逻辑
 */
export abstract class BaseDraw {
  protected viewer: Viewer;
  protected scene: Cesium.Scene;
  protected entities: Cesium.EntityCollection;
  protected offsetHeight: number = 0;
  protected originalDepthTestAgainstTerrain: boolean | null = null;
  protected callbacks: DrawCallbacks;

  // 临时数据
  protected tempPositions: Cesium.Cartesian3[] = [];
  protected tempEntities: Cesium.Entity[] = [];
  protected tempLabelEntities: Cesium.Entity[] = [];
  protected finishedPointEntities: Cesium.Entity[] = [];

  constructor(viewer: Viewer, callbacks: DrawCallbacks = {}) {
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.entities = viewer.entities;
    this.callbacks = callbacks;
    this.updateOffsetHeight();
  }

  /**
   * 根据场景模式更新偏移高度
   */
  protected updateOffsetHeight(): void {
    if (this.scene.mode === Cesium.SceneMode.SCENE3D) {
      this.offsetHeight = 1;
    } else {
      this.offsetHeight = 0;
    }
  }

  /**
   * 拾取地形或椭球体上的位置
   */
  protected pickGlobePosition(windowPosition: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    const ray = this.viewer.camera.getPickRay(windowPosition);
    if (ray && this.scene.mode === Cesium.SceneMode.SCENE3D && this.scene.globe.tilesLoaded) {
      const position = this.scene.globe.pick(ray, this.scene) as Cesium.Cartesian3 | undefined;
      if (Cesium.defined(position)) {
        if (
          Number.isFinite(position.x) &&
          Number.isFinite(position.y) &&
          Number.isFinite(position.z)
        ) {
          return position;
        }
      }
    }
    const ellipsoidPosition = this.viewer.camera.pickEllipsoid(
      windowPosition,
      this.scene.globe.ellipsoid
    ) as Cesium.Cartesian3 | undefined;
    if (ellipsoidPosition) {
      if (
        Number.isFinite(ellipsoidPosition.x) &&
        Number.isFinite(ellipsoidPosition.y) &&
        Number.isFinite(ellipsoidPosition.z)
      ) {
        return ellipsoidPosition;
      }
    }
    return null;
  }

  /**
   * 添加一个点到临时位置数组并创建点实体
   */
  protected addPoint(position: Cesium.Cartesian3): void {
    this.tempPositions.push(position.clone());

    const carto = Cesium.Cartographic.fromCartesian(position);
    const elevatedPosition = Cesium.Cartesian3.fromRadians(
      carto.longitude,
      carto.latitude,
      (carto.height || 0) + this.offsetHeight
    );

    const pointEntity = this.entities.add({
      position: elevatedPosition,
      point: {
        pixelSize: 8,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.NONE,
        scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 1.5e7, 0.5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    this.tempEntities.push(pointEntity);
  }

  /**
   * 创建总长/面积标签图片
   */
  protected createTotalLengthBillboardImage(text: string): HTMLCanvasElement {
    const paddingX = 12;
    const paddingY = 6;
    const font = "bold 16px 'Microsoft YaHei', 'PingFang SC', sans-serif";

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.width = 1;
      canvas.height = 1;
      return canvas;
    }

    ctx.font = font;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 20;

    canvas.width = Math.ceil(textWidth + paddingX * 2);
    canvas.height = Math.ceil(textHeight + paddingY * 2);

    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    return canvas;
  }

  /**
   * 创建分段长度标签图片
   */
  protected createSegmentLengthBillboardImage(text: string): HTMLCanvasElement {
    return this.createTotalLengthBillboardImage(text);
  }

  /**
   * 清理临时实体
   */
  protected clearTempEntities(): void {
    this.tempEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.tempEntities = [];

    this.tempLabelEntities.forEach((entity) => {
      if (entity) {
        this.entities.remove(entity);
      }
    });
    this.tempLabelEntities = [];
  }

  /**
   * 抽象方法：更新绘制实体（预览）
   */
  abstract updateDrawingEntity(previewPoint?: Cesium.Cartesian3): void;

  /**
   * 抽象方法：完成绘制
   */
  abstract finishDrawing(): DrawResult | null;

  /**
   * 抽象方法：获取绘制类型
   */
  abstract getDrawType(): "line" | "polygon" | "rectangle" | "circle";
}

