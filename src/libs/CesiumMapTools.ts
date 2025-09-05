
/**
 * Cesium地图工具类
 * 提供地图初始化、点位添加、测距、测面、视锥体绘制等功能
 */
import * as Cesium from 'cesium';
import type { 
  Viewer, Cartesian3, Cartographic, Color, Entity, 
  ScreenSpaceEventHandler, CallbackProperty, PolygonHierarchy,
  HeadingPitchRoll, PerspectiveFrustum, Primitive, GeometryInstance,
  PerInstanceColorAppearance, FrustumGeometry, FrustumOutlineGeometry,
  VertexFormat, ColorGeometryInstanceAttribute, Quaternion
} from 'cesium';

// 配置接口定义
export interface MapToolsConfig {
  containerId: string; // 地图容器ID
  viewerOptions?: Cesium.Viewer.ConstructorOptions; // 地图初始化配置项
  mapCenter?: {
    longitude: number; // 中心点经度
    latitude: number; // 中心点纬度
    height: number; // 中心点高度
    pitch?: number; // 俯仰角
    heading?: number; // 航向角
  };
  zoomLevels?: number[]; // 缩放级别数组
  defaultZoom?: number; // 默认缩放级别索引
}

/**
 * 点位绘制选项
 */
export interface PointOptions {
  pixelSize?: number; // 点大小
  color?: Color; // 点颜色
  outlineColor?: Color; // 轮廓颜色
  outlineWidth?: number; // 轮廓宽度
  showLabel?: boolean; // 是否显示标签
  labelText?: string; // 标签文本
  onClick?: (position: Cartesian3, cartographic: Cartographic) => void; // 点击回调
}

/**
 * 线条绘制选项
 */
export interface LineOptions {
  width?: number; // 线条宽度
  material?: Cesium.MaterialProperty | Color; // 线条材质或颜色
  showDistance?: boolean; // 是否显示距离
  dashPattern?: number; // 虚线模式
  onClick?: (positions: Cartesian3[], distance: number) => void; // 点击回调
}

/**
 * 多边形绘制选项
 */
export interface PolygonOptions {
  material?: Cesium.MaterialProperty | Color; // 填充材质或颜色
  outline?: boolean;
  outlineColor?: Color; // 轮廓颜色
  outlineWidth?: number; // 轮廓宽度
  showArea?: boolean; // 是否显示面积
  onClick?: (positions: Cartesian3[], area: number) => void; // 点击回调
}

/**
 * 视锥体绘制选项
 */
export interface FrustumOptions {
  position?: Cartesian3;
  orientation?: Quaternion;
  fov?: number;
  aspectRatio?: number;
  near?: number;
  far?: number;
  fillColor?: Color;
  outlineColor?: Color;
  onRightClick?: (position: Cartesian3) => void;
}

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

export interface VerticalLineOptions {
  startPosition: Cartesian3;
  height: number;
  width?: number;
  material?: Cesium.MaterialProperty | Color;
  showLabel?: boolean;
}

export * as Cesium from 'cesium';

/**
 * Cesium地图工具类
 * 提供地图初始化、点位添加、测距、测面、视锥体绘制等功能
 */
export class CesiumMapTools {
  private viewer!: Viewer; // 地图查看器实例
  private handler!: ScreenSpaceEventHandler; // 屏幕事件处理器
  private containerId: string; // 地图容器ID
  private mapCenter?: MapToolsConfig['mapCenter']; // 地图中心点配置
  private viewerOptions?: Cesium.Viewer.ConstructorOptions; // 地图初始化配置项
  private drawingMode: string | null = null; // 当前绘图模式
  private activeEntity: Entity | null = null; // 当前活动实体
  private tempPositions: Cartesian3[] = []; // 临时位置数组
  private tempEntities: Entity[] = []; // 临时实体数组
  private frustumPrimitives: Primitive[] = []; // 视锥体图元数组
  private zoomLevels: number[]; // 缩放级别数组
  private currentZoomIndex: number = 0; // 当前缩放级别索引
  private clickCallbacks: Map<Entity, () => void> = new Map(); // 点击回调映射表

  /**
   * 构造函数
   * @param config 地图工具配置对象
   */
  constructor(config: MapToolsConfig) {
    this.containerId = config.containerId;
    this.mapCenter = config.mapCenter;
    this.viewerOptions = config.viewerOptions;
    this.zoomLevels = config.zoomLevels || [5000000, 2500000, 1250000, 650000, 300000, 150000, 70000, 35000, 18000, 9000, 4500, 2200, 1100];
    this.currentZoomIndex = config.defaultZoom || 5;
  }

  // 初始化地图
  async initialize(): Promise<Viewer> {
    Cesium.Ion.defaultAccessToken = (import.meta as any).env.VITE_CESIUM_TOKEN;
    
    this.viewer = new Cesium.Viewer(this.containerId, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      scene3DOnly: false,
      ...this.viewerOptions
    });

    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // 设置初始视角
    if (this.mapCenter) {
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          this.mapCenter.longitude,
          this.mapCenter.latitude,
          this.mapCenter.height
        ),
        orientation: {
          heading: Cesium.Math.toRadians(this.mapCenter.heading || 0),
          pitch: Cesium.Math.toRadians(this.mapCenter.pitch || -30),
          roll: 0
        }
      });
    }

    // 设置点击事件监听
    this.setupClickHandler();

    return this.viewer;
  }

  private setupClickHandler(): void {
    this.handler.setInputAction((movement: any) => {
      const pickedObject = this.viewer.scene.pick(movement.position);
      if (pickedObject && pickedObject.id && this.clickCallbacks.has(pickedObject.id)) {
        const callback = this.clickCallbacks.get(pickedObject.id);
        callback?.();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // 基础地图功能
  setContainerSize(width: string, height: string): void {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.style.width = width;
      container.style.height = height;
      this.viewer.resize();
    }
  }

  zoomIn(): void {
    if (this.currentZoomIndex > 0) {
      this.currentZoomIndex--;
      this.setZoom(this.currentZoomIndex);
    }
  }

  zoomOut(): void {
    if (this.currentZoomIndex < this.zoomLevels.length - 1) {
      this.currentZoomIndex++;
      this.setZoom(this.currentZoomIndex);
    }
  }

  setZoom(level: number): void {
    if (level >= 0 && level < this.zoomLevels.length) {
      this.currentZoomIndex = level;
      const cameraPosition = this.viewer.camera.positionCartographic;
      const newPosition = Cesium.Cartesian3.fromRadians(
        cameraPosition.longitude,
        cameraPosition.latitude,
        this.zoomLevels[level]
      );
      this.viewer.camera.flyTo({
        destination: newPosition,
        duration: 0.5
      });
    }
  }

  toggle2D3D(): void {
    const currentMode = this.viewer.scene.mode;
    const targetMode = currentMode === Cesium.SceneMode.SCENE3D 
      ? Cesium.SceneMode.SCENE2D 
      : Cesium.SceneMode.SCENE3D;
    this.viewer.scene.mode = targetMode;
  }

  // 点位功能
  addPoint(position: Cartesian3, options: PointOptions = {}): Entity {
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const lng = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
    const lat = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
    const height = cartographic.height.toFixed(2);

    const entity = this.viewer.entities.add({
      position: position,
      point: {
        pixelSize: options.pixelSize || 8,
        color: options.color || Cesium.Color.RED,
        outlineColor: options.outlineColor || Cesium.Color.WHITE,
        outlineWidth: options.outlineWidth || 2
      }
    });

    if (options.showLabel !== false) {
      entity.label = {
        text: options.labelText || `经度: ${lng}\n纬度: ${lat}\n高度: ${height}m`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -15)
      } as any;
    }

    if (options.onClick) {
      this.clickCallbacks.set(entity, () => {
        options.onClick!(position, cartographic);
      });
    }

    return entity;
  }

  // 测距功能
  startDistanceMeasurement(options: LineOptions = {}): void {
    this.clearDrawing();
    this.drawingMode = 'distance';
    
    this.handler.setInputAction((movement: any) => {
      const cartesian = this.viewer.scene.pickPosition(movement.position);
      if (!cartesian) return;

      if (this.tempPositions.length < 2) {
        this.tempPositions.push(cartesian);
        
        const pointEntity = this.viewer.entities.add({
          position: cartesian,
          point: {
            pixelSize: 5,
            color: Cesium.Color.YELLOW
          }
        });
        this.tempEntities.push(pointEntity);
      }

      if (this.tempPositions.length === 2) {
        this.finishDistanceMeasurement(options);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  private finishDistanceMeasurement(options: LineOptions): void {
    const [start, end] = this.tempPositions;
    const distance = Cesium.Cartesian3.distance(start, end);
    const midPoint = Cesium.Cartesian3.midpoint(start, end, new Cesium.Cartesian3());

    // 创建测量线
    const lineEntity = this.viewer.entities.add({
      polyline: {
        positions: this.tempPositions,
        width: options.width || 3,
        material: options.material || Cesium.Color.BLUE
      }
    });

    // 添加距离标签
    this.viewer.entities.add({
      position: midPoint,
      label: {
        text: `距离: ${distance.toFixed(2)} 米`,
        font: '14px sans-serif',
        fillColor: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2
      } as any
    });

    if (options.onClick) {
      this.clickCallbacks.set(lineEntity, () => {
        options.onClick!(this.tempPositions, distance);
      });
    }

    this.clearDrawing();
  }

  // 测面功能
  startAreaMeasurement(options: PolygonOptions = {}): void {
    this.clearDrawing();
    this.drawingMode = 'area';
    
    this.activeEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(this.tempPositions), false),
        material: options.material || Cesium.Color.YELLOW.withAlpha(0.5),
        outline: options.outline !== false,
        outlineColor: options.outlineColor || Cesium.Color.BLACK,
        outlineWidth: options.outlineWidth || 2
      }
    });

    this.handler.setInputAction((movement: any) => {
      const cartesian = this.viewer.scene.pickPosition(movement.position);
      if (!cartesian) return;

      this.tempPositions.push(cartesian);
      
      const pointEntity = this.viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 5,
          color: Cesium.Color.YELLOW
        }
      });
      this.tempEntities.push(pointEntity);

    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.handler.setInputAction(() => {
      if (this.tempPositions.length >= 3) {
        this.finishAreaMeasurement(options);
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  private finishAreaMeasurement(options: PolygonOptions): void {
    try {
      const ellipsoid = this.viewer.scene.globe.ellipsoid;
      const cartographics = this.tempPositions.map(p => ellipsoid.cartesianToCartographic(p));
      
      let area = 0;
      const R = 6378137;
      for (let i = 0; i < cartographics.length; i++) {
        const j = (i + 1) % cartographics.length;
        area += (cartographics[j].longitude - cartographics[i].longitude) * 
                (cartographics[j].latitude + cartographics[i].latitude);
      }
      area = Math.abs((area * R * R) / 2);

      const boundingSphere = Cesium.BoundingSphere.fromPoints(this.tempPositions);
      const centroid = boundingSphere.center;

      this.viewer.entities.add({
        position: centroid,
        label: {
          text: `面积: ${area.toFixed(2)} 平方米`,
          font: '14px sans-serif',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2
        } as any
      });

      if (options.onClick && this.activeEntity) {
        this.clickCallbacks.set(this.activeEntity, () => {
          options.onClick!(this.tempPositions, area);
        });
      }

    } catch (error) {
      console.error('面积计算错误:', error);
    }

    // this.clearDrawing();
  }

  // 视锥体功能
  drawFrustum(options: FrustumOptions = {}): void {
    this.clearFrustum();

    const position = options.position || this.viewer.camera.positionWC;
    const orientation = options.orientation || Cesium.Quaternion.fromRotationMatrix(
      Cesium.Matrix4.getRotation(this.viewer.camera.transform, new Cesium.Matrix3())
    );
    
    const frustum = new Cesium.PerspectiveFrustum({
      fov: Cesium.Math.toRadians(options.fov || 60),
      aspectRatio: options.aspectRatio || 1.0,
      near: options.near || 1.0,
      far: options.far || 1000.0
    });

    // 创建视锥体填充
    const fillGeometry = new Cesium.FrustumGeometry({
      frustum: frustum,
      origin: position,
      orientation: orientation,
      vertexFormat: Cesium.VertexFormat.POSITION_ONLY
    });

    const fillInstance = new Cesium.GeometryInstance({
      geometry: fillGeometry,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          options.fillColor || new Cesium.Color(1.0, 0.0, 0.0, 0.3)
        )
      }
    });

    const fillPrimitive = new Cesium.Primitive({
      geometryInstances: fillInstance,
      appearance: new Cesium.PerInstanceColorAppearance({
        closed: true,
        flat: true
      })
    });

    // 创建视锥体轮廓
    const outlineGeometry = new Cesium.FrustumOutlineGeometry({
      frustum: frustum,
      origin: position,
      orientation: orientation
    });

    const outlineInstance = new Cesium.GeometryInstance({
      geometry: outlineGeometry,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          options.outlineColor || new Cesium.Color(1.0, 1.0, 1.0, 1.0)
        )
      }
    });

    const outlinePrimitive = new Cesium.Primitive({
      geometryInstances: outlineInstance,
      appearance: new Cesium.PerInstanceColorAppearance({
        closed: true,
        flat: true
      })
    });

    this.viewer.scene.primitives.add(fillPrimitive);
    this.viewer.scene.primitives.add(outlinePrimitive);
    this.frustumPrimitives.push(fillPrimitive, outlinePrimitive);

    // 右键点击事件
    if (options.onRightClick) {
      this.handler.setInputAction((movement: any) => {
        if (movement.position && options.onRightClick) {
          options.onRightClick(position);
        }
      }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
  }

  // 添加覆盖物
  addOverlay(options: OverlayOptions): Entity {
    const entityConfig: any = {
      position: options.position
    };

    switch (options.type) {
      case 'point':
        entityConfig.point = options.point || {
          pixelSize: 10,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2
        };
        break;
      
      case 'label':
        entityConfig.label = options.label || {
          text: '标签',
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2
        };
        break;
      
      case 'billboard':
        entityConfig.billboard = options.billboard || {
          image: '/default-icon.png',
          scale: 1.0
        };
        break;
      
      case 'model':
        entityConfig.model = options.model || {
          uri: '/default-model.gltf',
          scale: 1.0
        };
        break;
      
      case 'cylinder':
        entityConfig.cylinder = options.cylinder || {
          length: 100,
          topRadius: 10,
          bottomRadius: 10,
          material: Cesium.Color.RED.withAlpha(0.5)
        };
        break;
    }

    return this.viewer.entities.add(entityConfig);
  }

  // 清理功能
  clearDrawing(): void {
    if (this.handler) {
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
    if (this.activeEntity) {
      this.viewer.entities.remove(this.activeEntity);
      this.activeEntity = null;
    }
    this.tempEntities.forEach(entity => this.viewer.entities.remove(entity));
    this.tempEntities = [];
    this.tempPositions = [];
    this.drawingMode = null;
  }

  clearFrustum(): void {
    this.frustumPrimitives.forEach(primitive => {
      this.viewer.scene.primitives.remove(primitive);
    });
    this.frustumPrimitives = [];
    this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  clearAll(): void {
    this.clearDrawing();
    this.clearFrustum();
    this.viewer.entities.removeAll();
    this.clickCallbacks.clear();
  }

  // 垂直线绘制
  drawVerticalLine(options: VerticalLineOptions): Entity {
    const startCartographic = Cesium.Cartographic.fromCartesian(options.startPosition);
    const endPosition = Cesium.Cartesian3.fromRadians(
      startCartographic.longitude,
      startCartographic.latitude,
      startCartographic.height + options.height
    );

    const lineEntity = this.viewer.entities.add({
      polyline: {
        positions: [options.startPosition, endPosition],
        width: options.width || 2,
        material: options.material || Cesium.Color.RED
      }
    });

    if (options.showLabel) {
      this.viewer.entities.add({
        position: endPosition,
        label: {
          text: `高度: ${options.height} 米`,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1
        } as any
      });
    }

    return lineEntity;
  }

  // 获取当前地图实例
  getViewer(): Viewer {
    return this.viewer;
  }

  // 销毁清理
  destroy(): void {
    this.clearAll();
    if (this.handler) {
      this.handler.destroy();
    }
    if (this.viewer) {
      this.viewer.destroy();
    }
  }
}
