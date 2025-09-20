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
  VertexFormat, ColorGeometryInstanceAttribute, Quaternion,
  PolylineDashMaterialProperty
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
  showDistance?: boolean; // 是否显示距离 (对于多段线，显示总长度)
  dashPattern?: number; // 虚线模式 (例如 0xff for dashed)
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
  dashPattern?: number; // 虚线模式 (轮廓)
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
  private activeEntity: Entity | null = null; // 当前活动实体 (用于测面)
  private tempPositions: Cartesian3[] = []; // 临时位置数组
  private tempEntities: Entity[] = []; // 临时实体数组 (点和线段)
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
    // 注意: 实际项目中需要设置 Cesium.Ion.defaultAccessToken
    // Cesium.Ion.defaultAccessToken = (import.meta as any).env.VITE_CESIUM_TOKEN;
    
    // 设置默认 viewer 选项，允许用户覆盖
    const defaultViewerOptions: Cesium.Viewer.ConstructorOptions = {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false, // 禁用信息框以减少交互冲突
      sceneModePicker: false,
      selectionIndicator: false, // 禁用选取指示器以减少交互冲突
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      scene3DOnly: false,
    };

    this.viewer = new Cesium.Viewer(this.containerId, {
      ...defaultViewerOptions,
      ...this.viewerOptions // 用户配置覆盖默认配置
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

  // 测距功能 (改进为支持多点折线)
  startDistanceMeasurement(options: LineOptions = {}): void {
    this.clearDrawing();
    this.drawingMode = 'distance';
    
    let tempLineEntity: Entity | null = null;
    let totalDistanceLabelEntity: Entity | null = null;
    let segmentEntities: Entity[] = []; // 存储每个线段的实体

    // 设置鼠标样式为十字
    const canvas = this.viewer.scene.canvas;
    canvas.style.cursor = 'crosshair';

    // 鼠标移动事件 - 实时显示当前线段和距离
    this.handler.setInputAction((movement: any) => {
      if (this.tempPositions.length === 0) return;
      
      const cartesian = this.viewer.scene.pickPosition(movement.endPosition);
      if (!cartesian) return;

      // 移除上一次的临时连线
      if (tempLineEntity) {
        this.viewer.entities.remove(tempLineEntity);
        tempLineEntity = null;
      }

      // 创建临时连线 (当前最后一个点到鼠标位置)
      const positions = [this.tempPositions[this.tempPositions.length - 1], cartesian];
      const material = options.dashPattern ? new Cesium.PolylineDashMaterialProperty({
        color: (options.material as Cesium.Color | undefined) || Cesium.Color.YELLOW.withAlpha(0.7),
        dashPattern: options.dashPattern
      }) : options.material || Cesium.Color.YELLOW.withAlpha(0.7);

      tempLineEntity = this.viewer.entities.add({
        polyline: {
          positions: positions,
          width: options.width || 2,
          material: material
        }
      });

      // 更新总距离标签位置 (放在最后一个点)
      if (totalDistanceLabelEntity && this.tempPositions.length > 0) {
          // 直接赋值为最后一个点，避免类型不兼容问题
          totalDistanceLabelEntity.position = this.tempPositions[this.tempPositions.length - 1];
      }

    // 左键点击事件 - 添加点位和线段
    this.handler.setInputAction((movement: any) => {
      const cartesian = this.viewer.scene.pickPosition(movement.position);
      if (!cartesian) return;

      this.tempPositions.push(cartesian);
      const pointEntity = this.viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 6,
          color: Cesium.Color.YELLOW
        }
      });
      this.tempEntities.push(pointEntity); // Add point to temp entities

      // 如果不是第一个点，则创建线段
      if (this.tempPositions.length > 1) {
        const prevPosition = this.tempPositions[this.tempPositions.length - 2];
        const segmentPositions = [prevPosition, cartesian];
        const distance = Cesium.Cartesian3.distance(prevPosition, cartesian);
        const midPoint = Cesium.Cartesian3.midpoint(prevPosition, cartesian, new Cesium.Cartesian3());
        
        const material = options.dashPattern ? new Cesium.PolylineDashMaterialProperty({
            color: (options.material as Cesium.Color | undefined) || Cesium.Color.BLUE,
            dashPattern: options.dashPattern
        }) : options.material || Cesium.Color.BLUE;

        const segmentEntity = this.viewer.entities.add({
          polyline: {
            positions: segmentPositions,
            width: options.width || 3,
            material: material
          }
        });
        segmentEntities.push(segmentEntity);
        this.tempEntities.push(segmentEntity); // Add line segment to temp entities

        // 添加线段距离标签
        if (options.showDistance !== false) {
            const labelEntity = this.viewer.entities.add({
              position: midPoint,
              label: {
                text: `${distance.toFixed(2)} m`,
                font: '12px sans-serif',
                fillColor: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                pixelOffset: new Cesium.Cartesian2(0, -10) // Offset label slightly
              } as any
            });
            this.tempEntities.push(labelEntity); // Add label to temp entities
        }
      }

      // 更新总距离
      if (this.tempPositions.length > 1) {
        let totalDistance = 0;
        for (let i = 1; i < this.tempPositions.length; i++) {
            totalDistance += Cesium.Cartesian3.distance(this.tempPositions[i-1], this.tempPositions[i]);
        }
        const lastPoint = this.tempPositions[this.tempPositions.length - 1];

        // 移除旧的总距离标签
        if (totalDistanceLabelEntity) {
            this.viewer.entities.remove(totalDistanceLabelEntity);
        }
        // 添加新的总距离标签
        totalDistanceLabelEntity = this.viewer.entities.add({
          position: lastPoint,
          label: {
            text: `总长: ${totalDistance.toFixed(2)} m`,
            font: '14px sans-serif',
            fillColor: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            pixelOffset: new Cesium.Cartesian2(0, 20) // Offset above the point
          } as any
        });
        this.tempEntities.push(totalDistanceLabelEntity); // Add total label to temp entities
      }

    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 右键点击事件 - 删除上一个点位和相关线段
    this.handler.setInputAction((movement: any) => {
      if (this.tempPositions.length > 0) {
        // Remove last point
        this.tempPositions.pop();
        const pointEntity = this.tempEntities.pop(); // Get last added entity (point)
        if (pointEntity) this.viewer.entities.remove(pointEntity);

        // Remove last line segment and its label if they exist
        if (segmentEntities.length > 0) {
            const segmentEntity = segmentEntities.pop();
            if (segmentEntity) {
                this.viewer.entities.remove(segmentEntity);
                // Remove associated label (assuming it's the last temp entity)
                const labelEntity = this.tempEntities.pop();
                if (labelEntity && labelEntity !== pointEntity && labelEntity !== totalDistanceLabelEntity) {
                    this.viewer.entities.remove(labelEntity);
                } else if (labelEntity) {
                     // If it was the label, push it back or handle differently if needed
                     this.tempEntities.push(labelEntity);
                }
            }
        }

        // Remove temporary line if exists
        if (tempLineEntity) {
            this.viewer.entities.remove(tempLineEntity);
            tempLineEntity = null;
        }

        // Update total distance label or remove it if no points left
        if (totalDistanceLabelEntity) {
            this.viewer.entities.remove(totalDistanceLabelEntity);
            totalDistanceLabelEntity = null;
        }
        if (this.tempPositions.length > 1) {
            let totalDistance = 0;
            for (let i = 1; i < this.tempPositions.length; i++) {
                totalDistance += Cesium.Cartesian3.distance(this.tempPositions[i-1], this.tempPositions[i]);
            }
            const lastPoint = this.tempPositions[this.tempPositions.length - 1];
            totalDistanceLabelEntity = this.viewer.entities.add({
              position: lastPoint,
              label: {
                text: `总长: ${totalDistance.toFixed(2)} m`,
                font: '14px sans-serif',
                fillColor: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                pixelOffset: new Cesium.Cartesian2(0, 20)
              } as any
            });
             this.tempEntities.push(totalDistanceLabelEntity); // Add updated total label to temp entities
        } else if (this.tempPositions.length === 1) {
             // If only one point left, remove any remaining segment entities
             segmentEntities.forEach(e => this.viewer.entities.remove(e));
             segmentEntities = [];
             // Clear temp entities related to segments and labels, but keep the point
             // This logic might need refinement based on exact order of additions
             // A safer approach would be to track segment entities separately from tempEntities
             // For simplicity here, we assume tempEntities order is point, segment, label, segment, label, ...
             // So after removing last 3 (label, segment, point), we should be left with the first point's entities
             // This is fragile, better to manage segmentEntities independently
        }
        
        // If no points left, clear everything
        if (this.tempPositions.length === 0) {
             this.clearDrawing(); // This will clean up properly
        }
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // 双击结束绘制
    this.handler.setInputAction(() => {
        // 移除临时实体 (当前鼠标跟随的线)
        if (tempLineEntity) {
            this.viewer.entities.remove(tempLineEntity);
            tempLineEntity = null;
        }
        this.finishDistanceMeasurement(options);
        this.endDrawing();
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  }

  /**
   * 完成距离测量 (创建最终实体并注册回调)
   * @param options - 测量线的配置选项
   */
  private finishDistanceMeasurement(options: LineOptions): void {
    if (this.tempPositions.length < 2) return;

    let totalDistance = 0;
    const finalPositions: Cartesian3[] = [...this.tempPositions]; // Copy positions

    // 创建最终的折线实体 (可以是实线或虚线)
    const material = options.dashPattern ? new Cesium.PolylineDashMaterialProperty({
        color: (options.material as Cesium.Color | undefined) || Cesium.Color.BLUE,
        dashPattern: options.dashPattern
    }) : options.material || Cesium.Color.BLUE;

    const finalLineEntity = this.viewer.entities.add({
      polyline: {
        positions: finalPositions,
        width: options.width || 3,
        material: material
      }
    });

    // 计算总距离
    for (let i = 1; i < finalPositions.length; i++) {
        totalDistance += Cesium.Cartesian3.distance(finalPositions[i-1], finalPositions[i]);
    }

    // 如果有点击回调函数，则注册点击事件
    if (options.onClick) {
      this.clickCallbacks.set(finalLineEntity, () => {
        options.onClick!(finalPositions, totalDistance);
      });
    }
  }


  // 测面功能 (改进面积计算)
  startAreaMeasurement(options: PolygonOptions = {}): void {
    this.clearDrawing();
    this.drawingMode = 'area';
    
    let tempLineEntity: Entity | null = null;
    let tempLabelEntity: Entity | null = null;

    // 设置鼠标样式为十字
    const canvas = this.viewer.scene.canvas;
    canvas.style.cursor = 'crosshair';

    // 创建活动多边形实体 (使用 CallbackProperty 实现实时更新)
    this.activeEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
            // Include the mouse position if available for real-time preview
            // We'll manage this inside the mouse move handler
            return new Cesium.PolygonHierarchy(this.tempPositions);
        }, false),
        material: options.material || Cesium.Color.YELLOW.withAlpha(0.3),
        outline: options.outline !== false,
        outlineColor: options.outlineColor || Cesium.Color.BLACK,
        outlineWidth: options.outlineWidth || 2
      }
    });

    // 鼠标移动事件 - 实时显示连线和面积
    this.handler.setInputAction((movement: any) => {
      if (this.tempPositions.length === 0) return;
      
      const cartesian = this.viewer.scene.pickPosition(movement.endPosition);
      if (!cartesian) return;

      // 移除临时连线和标签
      if (tempLineEntity) {
        this.viewer.entities.remove(tempLineEntity);
      }
      if (tempLabelEntity) {
        this.viewer.entities.remove(tempLabelEntity);
      }

      // 创建临时连线 (最后一个点到鼠标位置)
      const positions = [...this.tempPositions, cartesian];
      if (positions.length >= 2) {
          const material = options.dashPattern ? new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.YELLOW.withAlpha(0.7),
              dashPattern: options.dashPattern
          }) : Cesium.Color.YELLOW.withAlpha(0.7);

          tempLineEntity = this.viewer.entities.add({
          polyline: {
            positions: positions,
            width: 2,
            material: material
          }
        });
      }

      // 计算并显示实时面积（如果有3个以上点）
      if (this.tempPositions.length >= 2) {
        const tempAreaPositions = [...this.tempPositions, cartesian];
        try {
          // 使用更准确的球面多边形面积计算
          const ellipsoid = this.viewer.scene.globe.ellipsoid;
          let area = 0;
          if (tempAreaPositions.length >= 3) {
            // 使用 L'Huilier's Theorem 计算球面多边形面积
            const R = ellipsoid.maximumRadius;
            const vertices = tempAreaPositions.map(p => ellipsoid.cartesianToCartographic(p));
            
            // 计算边长和角度
            const edges: number[] = [];
            const angles: number[] = [];
            
            for (let i = 0; i < vertices.length; i++) {
              const p1 = vertices[i];
              const p2 = vertices[(i + 1) % vertices.length];
              const geodesic = new Cesium.EllipsoidGeodesic(p1, p2, ellipsoid);
              edges.push(geodesic.surfaceDistance / R); // 边长（弧度）
            }
            
            for (let i = 0; i < vertices.length; i++) {
              const a = edges[i];
              const b = edges[(i + vertices.length - 1) % vertices.length];
              const c_cart = vertices[i];
              const a_cart = vertices[(i + 1) % vertices.length];
              const b_cart = vertices[(i + vertices.length - 1) % vertices.length];
              
              // 计算顶点角度 (使用向量)
              const va = Cesium.Cartesian3.subtract(
                ellipsoid.cartographicToCartesian(a_cart),
                ellipsoid.cartographicToCartesian(c_cart),
                new Cesium.Cartesian3()
              );
              Cesium.Cartesian3.normalize(va, va);
              const vb = Cesium.Cartesian3.subtract(
                ellipsoid.cartographicToCartesian(b_cart),
                ellipsoid.cartographicToCartesian(c_cart),
                new Cesium.Cartesian3()
              );
              Cesium.Cartesian3.normalize(vb, vb);
              const dot = Cesium.Cartesian3.dot(va, vb);
              // 限制点积范围以避免 acos 域错误
              const clampedDot = Math.max(-1, Math.min(1, dot));
              angles.push(Math.acos(clampedDot));
            }
            
            // 应用 L'Huilier's Theorem
            let sum = 0;
            for (let i = 0; i < vertices.length; i++) {
              const a = edges[i];
              const b = edges[(i + 1) % vertices.length];
              const c = edges[(i + 2) % vertices.length];
              const A = angles[(i + 1) % vertices.length]; // 角度对应于边 b
              
              const s = (a + b + c) / 2;
              const tanSum = Math.tan(s / 2) * Math.tan((s - a) / 2) * Math.tan((s - b) / 2) * Math.tan((s - c) / 2);
              if (tanSum > 0) { // 避免负数开方
                sum += 4 * Math.atan(Math.sqrt(tanSum));
              }
            }
            area = Math.abs(sum * R * R);
          }
          
          
          const boundingSphere = Cesium.BoundingSphere.fromPoints(tempAreaPositions);
          const centroid = boundingSphere.center;
          
          tempLabelEntity = this.viewer.entities.add({
            position: centroid,
            label: {
              text: `面积: ${area >= 1000000 ? (area / 1000000).toFixed(2) + ' km²' : area.toFixed(2) + ' m²'}`,
              font: '12px sans-serif',
              fillColor: Cesium.Color.CYAN,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1
            } as any
          });
        } catch (error) {
          console.error('实时面积计算错误:', error);
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 左键点击事件 - 添加点位
    this.handler.setInputAction((movement: any) => {
      const cartesian = this.viewer.scene.pickPosition(movement.position);
      if (!cartesian) return;

      this.tempPositions.push(cartesian);
      const pointEntity = this.viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 6,
          color: Cesium.Color.YELLOW
        }
      });
      this.tempEntities.push(pointEntity); // Track point entities

    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 右键点击事件 - 删除当前点位 (最后一个点)
    this.handler.setInputAction((movement: any) => {
      if (this.tempPositions.length > 0) {
        // 删除最后一个点
        this.tempPositions.pop();
        const pointEntity = this.tempEntities.pop(); // Get last added entity (point)
        if (pointEntity) this.viewer.entities.remove(pointEntity);

        // 移除临时实体
        if (tempLineEntity) {
          this.viewer.entities.remove(tempLineEntity);
          tempLineEntity = null;
        }
        if (tempLabelEntity) {
          this.viewer.entities.remove(tempLabelEntity);
          tempLabelEntity = null;
        }
        
        // 如果点少于3个，清除绘制
        if (this.tempPositions.length < 3) {
          this.clearDrawing();
        }
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // 双击结束绘制
    this.handler.setInputAction(() => {
      if (this.tempPositions.length >= 3) {
        // 移除临时实体
        if (tempLineEntity) {
          this.viewer.entities.remove(tempLineEntity);
          tempLineEntity = null;
        }
        if (tempLabelEntity) {
          this.viewer.entities.remove(tempLabelEntity);
          tempLabelEntity = null;
        }
        this.finishAreaMeasurement(options);
      }
      this.endDrawing();
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  }

  /**
   * 完成区域测量并计算面积
   * @param options - 多边形测量选项，包含点击回调函数
   */
  private finishAreaMeasurement(options: PolygonOptions): void {
    if (this.tempPositions.length < 3) return;
    try {
      // 使用更准确的球面多边形面积计算 (L'Huilier's Theorem)
      const ellipsoid = this.viewer.scene.globe.ellipsoid;
      let area = 0;
      const finalPositions = [...this.tempPositions]; // Copy final positions

      const R = ellipsoid.maximumRadius;
      const vertices = finalPositions.map(p => ellipsoid.cartesianToCartographic(p));
      
      // 计算边长和角度
      const edges: number[] = [];
      const angles: number[] = [];
      
      for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];
        const geodesic = new Cesium.EllipsoidGeodesic(p1, p2, ellipsoid);
        edges.push(geodesic.surfaceDistance / R); // 边长（弧度）
      }
      
      for (let i = 0; i < vertices.length; i++) {
        const a = edges[i];
        const b = edges[(i + vertices.length - 1) % vertices.length];
        const c_cart = vertices[i];
        const a_cart = vertices[(i + 1) % vertices.length];
        const b_cart = vertices[(i + vertices.length - 1) % vertices.length];
        
        // 计算顶点角度 (使用向量)
        const va = Cesium.Cartesian3.subtract(
          ellipsoid.cartographicToCartesian(a_cart),
          ellipsoid.cartographicToCartesian(c_cart),
          new Cesium.Cartesian3()
        );
        Cesium.Cartesian3.normalize(va, va);
        const vb = Cesium.Cartesian3.subtract(
          ellipsoid.cartographicToCartesian(b_cart),
          ellipsoid.cartographicToCartesian(c_cart),
          new Cesium.Cartesian3()
        );
        Cesium.Cartesian3.normalize(vb, vb);
        const dot = Cesium.Cartesian3.dot(va, vb);
        // 限制点积范围以避免 acos 域错误
        const clampedDot = Math.max(-1, Math.min(1, dot));
        angles.push(Math.acos(clampedDot));
      }
      
      // 应用 L'Huilier's Theorem
      let sum = 0;
      for (let i = 0; i < vertices.length; i++) {
        const a = edges[i];
        const b = edges[(i + 1) % vertices.length];
        const c = edges[(i + 2) % vertices.length];
        const A = angles[(i + 1) % vertices.length]; // 角度对应于边 b
        
        const s = (a + b + c) / 2;
        const tanSum = Math.tan(s / 2) * Math.tan((s - a) / 2) * Math.tan((s - b) / 2) * Math.tan((s - c) / 2);
        if (tanSum > 0) { // 避免负数开方
          sum += 4 * Math.atan(Math.sqrt(tanSum));
        }
      }
      area = Math.abs(sum * R * R);
      
      // 计算多边形的包围球和中心点
      const boundingSphere = Cesium.BoundingSphere.fromPoints(finalPositions);
      const centroid = boundingSphere.center;
      
      // 格式化面积显示
      let areaText: string;
      if (area >= 1000000) {
        areaText = `面积: ${(area / 1000000).toFixed(2)} km²`;
      } else {
        areaText = `面积: ${area.toFixed(2)} m²`;
      }
      
      // 在多边形中心点添加面积标签
      this.viewer.entities.add({
        position: centroid,
        label: {
          text: areaText,
          font: '14px sans-serif',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2
        } as any
      });
      
      // 如果有点击回调函数且存在活动实体，则设置点击回调
      // 注意：activeEntity 是多边形本身，我们将其用于点击回调
      if (options.onClick && this.activeEntity) {
        this.clickCallbacks.set(this.activeEntity, () => {
          options.onClick!(finalPositions, area);
        });
      }
    } catch (error) {
      // 捕获并计算过程中的错误
      console.error('面积计算错误:', error);
    }
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
          image: '/default-icon.png', // Note: This path needs to be valid
          scale: 1.0
        };
        break;
      
      case 'model':
        entityConfig.model = options.model || {
          uri: '/default-model.gltf', // Note: This path needs to be valid
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

  // 结束绘制
  endDrawing(): void {
    this.drawingMode = null;
    if (this.handler) {
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK); // Remove double click handler
    }
    // 恢复鼠标样式
    if (this.viewer && this.viewer.scene) {
      this.viewer.scene.canvas.style.cursor = 'default';
    }
  }

  // 清理功能
  clearDrawing(): void {
    // 移除所有临时实体
    this.tempEntities.forEach(entity => {
        if (entity && entity.id) { // Check if entity exists and has an ID
             this.viewer.entities.remove(entity);
        }
    });
    this.tempEntities = [];
    this.tempPositions = [];
    this.drawingMode = null;
    this.activeEntity = null; // Clear active entity for area measurement
    
    // 移除事件监听器
    if (this.handler) {
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
    
    // 恢复鼠标样式
    if (this.viewer && this.viewer.scene) {
      this.viewer.scene.canvas.style.cursor = 'default';
    }
  }

/**
 * 清除视锥体相关的方法
 * 该方法用于移除场景中的视锥体图形，并清除相关的事件监听器
 */
  clearFrustum(): void {
  // 遍历视锥体图元数组，从场景中移除每个图元
    this.frustumPrimitives.forEach(primitive => {
      if (primitive && !primitive.isDestroyed()) { // Check if primitive exists and is not destroyed
           this.viewer.scene.primitives.remove(primitive);
      }
    });
  // 清空视锥体图元数组
    this.frustumPrimitives = [];
  // 移除右键点击事件监听器 (注意：这会移除所有右键监听器，如果其他功能也用右键需要小心)
    if(this.handler) {
         this.handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    }
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
          text: `高度: ${options.height} m`,
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




