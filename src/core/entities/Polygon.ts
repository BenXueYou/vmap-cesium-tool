import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, MaterialProperty, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * Polygon 配置选项
 */
export interface PolygonOptions extends BaseOverlayOptions {
  /** 位置数组（至少 3 个点） */
  positions: OverlayPosition[];
  /** 填充材质 */
  material?: MaterialProperty | Color | string;
  /** 是否显示边框（默认 true） */
  outline?: boolean;
  /** 边框颜色 */
  outlineColor?: Color | string;
  /** 边框宽度（默认 1） */
  outlineWidth?: number;
  /** 是否贴地（默认 true） */
  clampToGround?: boolean;
  /** 贴地抬高量（米，clampToGround=true 时生效） */
  groundHeightEpsilon?: number;
  /** 高度参考 */
  heightReference?: HeightReference;
  /** 拉伸高度 */
  extrudedHeight?: number;
}

/**
 * Polygon 多边形类
 * 
 * 用于在地图上创建多边形，支持自定义填充、边框和贴地属性。
 * 
 * @example
 * ```typescript
 * const polygon = new Polygon(viewer, {
 *   positions: [
 *     [120.1, 30.2],
 *     [120.2, 30.3],
 *     [120.3, 30.25]
 *   ],
 *   material: 'rgba(255, 0, 0, 0.5)',
 *   outline: true,
 *   outlineColor: '#FF0000',
 *   outlineWidth: 2
 * });
 * viewer.entities.add(polygon.getEntity());
 * ```
 */
export class Polygon extends BaseOverlay {
  private polygonOptions: PolygonOptions;
  private borderEntity?: Entity;

  constructor(viewer: Viewer, options: PolygonOptions) {
    super(viewer, options);
    this.polygonOptions = options;
    
    // 设置多边形属性
    this.entity.polygon = this.createPolygonGraphics(options);
    
    // 如果有边框宽度且大于 1，创建独立的边框折线
    if (options.outlineWidth && options.outlineWidth > 1) {
      this.borderEntity = this.createBorderPolyline(options);
      (this.entity as any)._borderEntity = this.borderEntity;
      (this.entity as any)._isThickOutline = true;
    }
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'polygon';
  }

  /**
   * 创建 PolygonGraphics 对象
   */
  private createPolygonGraphics(options: PolygonOptions): Cesium.PolygonGraphics {
    const positions = options.positions.map(pos => this.toCartesian3(pos)!);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    
    // 计算表面位置
    const surfacePositions = this.elevatePositions(positions, 0);
    
    // 确定高度参考
    const heightReference = options.heightReference ?? (
      clampToGround
        ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
        : Cesium.HeightReference.NONE
    );

    return new Cesium.PolygonGraphics({
      hierarchy: surfacePositions,
      material: this.resolveMaterial(options.material),
      outline: options.outline ?? true,
      outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor, Cesium.Color.BLACK) : undefined,
      outlineWidth: options.outlineWidth ?? 1,
      heightReference,
      ...(clampToGround && groundHeightEpsilon > 0 ? { height: groundHeightEpsilon } : {}),
      extrudedHeight: options.extrudedHeight,
    });
  }

  /**
   * 创建粗边框折线
   */
  private createBorderPolyline(options: PolygonOptions): Entity {
    const positions = options.positions.map(pos => this.toCartesian3(pos)!);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const baseHeight = clampToGround ? 0 : (Cesium.Cartographic.fromCartesian(positions[0])?.height ?? 0);
    
    // 构造闭合边界路径
    const borderPositions = this.elevatePositions(positions, clampToGround ? groundHeightEpsilon : baseHeight);
    const closedPositions: Cesium.Cartesian3[] = [...borderPositions];
    if (closedPositions.length >= 2) {
      closedPositions.push(closedPositions[0]);
    }

    return this.viewer.entities.add({
      polyline: {
        positions: closedPositions,
        width: options.outlineWidth ?? 2,
        material: new Cesium.ColorMaterialProperty(
          this.resolveColor(options.outlineColor ?? Cesium.Color.ORANGE, Cesium.Color.ORANGE)
        ),
        clampToGround,
        ...(clampToGround ? { zIndex: 1 } : {}),
      },
    });
  }

  /**
   * 解析材质
   */
  private resolveMaterial(material?: MaterialProperty | Color | string): MaterialProperty {
    if (!material) {
      return new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.5));
    }
    if (typeof material === 'string') {
      return new Cesium.ColorMaterialProperty(this.resolveColor(material, Cesium.Color.BLUE.withAlpha(0.5)));
    }
    if (material instanceof Cesium.Color) {
      return new Cesium.ColorMaterialProperty(material);
    }
    return material;
  }

  /**
   * 解析颜色值
   */
  private resolveColor(color: Color | string | undefined, fallback: Color): Color {
    if (!color) return fallback;
    if (color instanceof Cesium.Color) return color;
    try {
      return Cesium.Color.fromCssColorString(color);
    } catch {
      return fallback;
    }
  }

  /**
   * 抬高位置点
   */
  private elevatePositions(positions: Cesium.Cartesian3[], heightMeters: number): Cesium.Cartesian3[] {
    return positions.map((p) => {
      const c = Cesium.Cartographic.fromCartesian(p);
      return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, heightMeters);
    });
  }

  /**
   * 更新 Polygon 配置
   */
  update(options: Partial<PolygonOptions>): void {
    if (this.destroyed) return;
    
    this.polygonOptions = { ...this.polygonOptions, ...options };
    
    if (!this.entity.polygon) {
      this.entity.polygon = this.createPolygonGraphics(options as PolygonOptions);
      return;
    }
    
    // 更新位置
    if (options.positions !== undefined) {
      const positions = options.positions.map(pos => this.toCartesian3(pos)!);
      const clampToGround = options.clampToGround ?? this.polygonOptions.clampToGround ?? true;
      const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
      
      const surfacePositions = this.elevatePositions(positions, 0);
      this.entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(surfacePositions));
      
      if (clampToGround) {
        (this.entity.polygon as any).heightReference = new Cesium.ConstantProperty(
          groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND
        );
        (this.entity.polygon as any).height = groundHeightEpsilon > 0 
          ? new Cesium.ConstantProperty(groundHeightEpsilon) 
          : undefined;
      } else {
        (this.entity.polygon as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
      }
      
      // 更新边框
      if (this.borderEntity && this.borderEntity.polyline) {
        const baseHeight = clampToGround ? groundHeightEpsilon : (Cesium.Cartographic.fromCartesian(positions[0])?.height ?? 0);
        const borderPositions = this.elevatePositions(positions, baseHeight);
        const closedPositions: Cesium.Cartesian3[] = [...borderPositions];
        if (closedPositions.length >= 2) closedPositions.push(closedPositions[0]);
        
        this.borderEntity.polyline.positions = new Cesium.ConstantProperty(closedPositions);
        (this.borderEntity.polyline as any).clampToGround = new Cesium.ConstantProperty(clampToGround);
      }
    }
    
    // 更新样式
    if (options.material !== undefined) {
      this.entity.polygon.material = this.resolveMaterial(options.material);
    }
    if (options.outline !== undefined) {
      this.entity.polygon.outline = new Cesium.ConstantProperty(options.outline);
    }
    if (options.outlineColor !== undefined) {
      this.entity.polygon.outlineColor = new Cesium.ConstantProperty(
        this.resolveColor(options.outlineColor, Cesium.Color.BLACK)
      );
      if (this.borderEntity && this.borderEntity.polyline) {
        this.borderEntity.polyline.material = new Cesium.ColorMaterialProperty(
          this.resolveColor(options.outlineColor, Cesium.Color.ORANGE)
        );
      }
    }
    if (options.outlineWidth !== undefined) {
      this.entity.polygon.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      if (this.borderEntity && this.borderEntity.polyline) {
        this.borderEntity.polyline.width = new Cesium.ConstantProperty(options.outlineWidth);
      }
    }
    if (options.extrudedHeight !== undefined) {
      this.entity.polygon.extrudedHeight = new Cesium.ConstantProperty(options.extrudedHeight);
    }
    
    // 更新可见性
    if (options.show !== undefined) {
      this.entity.show = options.show;
      if (this.borderEntity) {
        this.borderEntity.show = options.show;
      }
    }
  }

  /**
   * 更新位置
   */
  setPositions(positions: OverlayPosition[]): void {
    if (this.destroyed) return;
    
    const cartesianPositions = positions.map(pos => this.toCartesian3(pos)!);
    const clampToGround = this.polygonOptions.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(this.polygonOptions.groundHeightEpsilon ?? 0)) : 0;
    
    // 更新多边形
    const surfacePositions = this.elevatePositions(cartesianPositions, 0);
    if (this.entity.polygon) {
      this.entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(surfacePositions));
    }
    
    // 更新边框
    if (this.borderEntity && this.borderEntity.polyline) {
      const baseHeight = clampToGround ? groundHeightEpsilon : (Cesium.Cartographic.fromCartesian(cartesianPositions[0])?.height ?? 0);
      const borderPositions = this.elevatePositions(cartesianPositions, baseHeight);
      const closedPositions: Cesium.Cartesian3[] = [...borderPositions];
      if (closedPositions.length >= 2) closedPositions.push(closedPositions[0]);
      
      this.borderEntity.polyline.positions = new Cesium.ConstantProperty(closedPositions);
    }
  }

  /**
   * 获取位置数组（经纬度）
   */
  getPositions(): [number, number][] {
    const hierarchy = this.entity.polygon?.hierarchy?.getValue(Cesium.JulianDate.now());
    if (hierarchy && Array.isArray(hierarchy.positions)) {
      return hierarchy.positions.map((pos: Cesium.Cartesian3) => this.toLngLat(pos));
    }
    return [];
  }

  /**
   * 获取多边形样式
   */
  getStyle(): Partial<PolygonOptions> {
    const polygon = this.entity.polygon;
    if (!polygon) return {};
    
    const now = Cesium.JulianDate.now();
    return {
      material: polygon.material?.getValue(now),
      outline: polygon.outline?.getValue(now),
      outlineColor: polygon.outlineColor?.getValue(now),
      outlineWidth: polygon.outlineWidth?.getValue(now),
      extrudedHeight: polygon.extrudedHeight?.getValue(now),
    };
  }

  /**
   * 从场景中移除多边形
   */
  remove(): void {
    if (this.destroyed) return;
    
    // 移除边框实体
    if (this.borderEntity) {
      this.viewer.entities.remove(this.borderEntity);
      this.borderEntity = undefined;
    }
    
    // 调用父类方法移除 Entity
    super.remove();
  }
}