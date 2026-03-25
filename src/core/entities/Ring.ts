import * as Cesium from 'cesium';
import type { Viewer, Entity, Color } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayPosition } from './BaseOverlay';

/**
 * Ring 配置选项
 */
export interface RingOptions extends BaseOverlayOptions {
  /** 中心点位置 */
  position: OverlayPosition;
  /** 半径（米） */
  radius: number;
  /** 发光颜色 */
  color?: Color | string;
  /** 是否显示内层线（默认 true） */
  showInnerLine?: boolean;
  /** 内层线颜色 */
  lineColor?: Color | string;
  /** 内层线型（默认 'solid'） */
  lineStyle?: 'solid' | 'dashed';
  /** 虚线材质模式（默认 'stripe'） */
  lineMaterialMode?: 'stripe' | 'dash';
  /** 条纹重复次数（默认 32） */
  stripeRepeat?: number;
  /** 虚线长度（默认 16） */
  dashLength?: number;
  /** 虚线模式（16bit pattern） */
  dashPattern?: number;
  /** 间隙颜色 */
  gapColor?: Color | string;
  /** 外环宽度（默认 8） */
  width?: number;
  /** 发光强度（0-1，默认 0.25） */
  glowPower?: number;
  /** 是否贴地（默认 true） */
  clampToGround?: boolean;
  /** 贴地抬高量（米） */
  groundHeightEpsilon?: number;
  /** 圆环分段数（默认 128） */
  segments?: number;
}

/**
 * Ring 发光圆环类
 * 
 * 用于在地图上创建边缘发光的圆环效果。
 * 使用 PolylineGlowMaterialProperty 实现发光效果。
 * 
 * @example
 * ```typescript
 * const ring = new Ring(viewer, {
 *   position: [120.1, 30.2],
 *   radius: 1000,
 *   color: '#00FFFF',
 *   glowPower: 0.5,
 *   width: 10
 * });
 * viewer.entities.add(ring.getEntity());
 * ```
 */
export class Ring extends BaseOverlay {
  private ringOptions: RingOptions;
  private innerEntity?: Entity;

  constructor(viewer: Viewer, options: RingOptions) {
    super(viewer, options);
    this.ringOptions = options;
    
    // 创建发光圆环
    this.createRing(options);
    
    // 设置覆盖物类型标识
    (this.entity as any)._overlayType = 'ring';
  }

  /**
   * 创建发光圆环
   */
  private createRing(options: RingOptions): void {
    const position = this.toCartesian3(options.position)!;
    const carto = Cesium.Cartographic.fromCartesian(position);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const heightMeters = clampToGround ? groundHeightEpsilon : (carto.height ?? 0);
    const segments = options.segments ?? 128;
    const width = options.width ?? 8;
    const glowPower = Math.max(0, Math.min(options.glowPower ?? 0.25, 1));
    const showInnerLine = options.showInnerLine ?? true;

    // 生成圆环顶点
    const ringPositions = this.generateCirclePositions(carto, options.radius, heightMeters, segments);

    // 创建外层发光材质
    const glowColor = this.resolveColor(options.color, Cesium.Color.CYAN);
    const glowMaterial = new Cesium.PolylineGlowMaterialProperty({
      color: glowColor,
      glowPower,
    });

    // 创建外层发光折线
    this.entity.polyline = new Cesium.PolylineGraphics({
      positions: ringPositions,
      width,
      material: glowMaterial,
      clampToGround,
      zIndex: 0,
    });

    // 创建内层实线/虚线（可选）
    if (showInnerLine) {
      const innerWidth = Math.max(1, width - 2);
      const lineMaterial = this.createLineMaterial(options);
      
      this.innerEntity = this.viewer.entities.add({
        polyline: {
          positions: ringPositions,
          width: innerWidth,
          material: lineMaterial,
          clampToGround,
          zIndex: 1,
        },
      });

      (this.entity as any)._innerEntity = this.innerEntity;
    }

    // 保存元数据
    (this.entity as any)._centerCartographic = carto;
    (this.entity as any)._outerRadius = options.radius;
    (this.entity as any)._ringSegments = segments;
    (this.entity as any)._ringGlowPower = glowPower;
    (this.entity as any)._groundHeightEpsilon = groundHeightEpsilon;
  }

  /**
   * 创建内层线材质
   */
  private createLineMaterial(options: RingOptions): Cesium.MaterialProperty {
    const lineColor = this.resolveColor(options.lineColor, Cesium.Color.WHITE);
    const lineStyle = options.lineStyle ?? 'solid';

    if (lineStyle === 'dashed') {
      const mode = options.lineMaterialMode ?? 'stripe';
      const gapColor = this.resolveColor(options.gapColor, Cesium.Color.TRANSPARENT);

      if (mode === 'dash') {
        return new Cesium.PolylineDashMaterialProperty({
          color: lineColor,
          dashLength: options.dashLength ?? 16,
          gapColor: gapColor,
          ...(options.dashPattern !== undefined ? { dashPattern: options.dashPattern } : {}),
        });
      }

      return new Cesium.StripeMaterialProperty({
        orientation: Cesium.StripeOrientation.VERTICAL,
        evenColor: lineColor,
        oddColor: gapColor,
        repeat: options.stripeRepeat ?? 32,
      });
    }

    return new Cesium.ColorMaterialProperty(lineColor);
  }

  /**
   * 生成近似圆顶点
   */
  private generateCirclePositions(center: Cesium.Cartographic, radiusMeters: number, heightMeters: number, segments: number): Cesium.Cartesian3[] {
    const R = 6378137.0;
    const lat1 = center.latitude;
    const lon1 = center.longitude;
    const d = radiusMeters / R;
    const positions: Cesium.Cartesian3[] = [];

    for (let i = 0; i < segments; i++) {
      const bearing = (i / segments) * Cesium.Math.TWO_PI;
      const sinLat1 = Math.sin(lat1);
      const cosLat1 = Math.cos(lat1);
      const sinD = Math.sin(d);
      const cosD = Math.cos(d);
      const sinBearing = Math.sin(bearing);
      const cosBearing = Math.cos(bearing);
      const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * cosBearing);
      const lon2 = lon1 + Math.atan2(sinBearing * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));
      positions.push(Cesium.Cartesian3.fromRadians(lon2, lat2, heightMeters));
    }

    // 闭合圆环
    if (positions.length > 0) {
      positions.push(positions[0]);
    }

    return positions;
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
   * 更新 Ring 配置
   */
  update(options: Partial<RingOptions>): void {
    if (this.destroyed || !this.entity.polyline) return;

    this.ringOptions = { ...this.ringOptions, ...options };

    // 检查是否需要重建内层线
    if (options.showInnerLine !== undefined) {
      if (!options.showInnerLine && this.innerEntity) {
        this.viewer.entities.remove(this.innerEntity);
        this.innerEntity = undefined;
        (this.entity as any)._innerEntity = undefined;
      } else if (options.showInnerLine && !this.innerEntity) {
        this.rebuildInnerLine();
      }
    }

    // 更新位置和半径
    if (options.position !== undefined || options.radius !== undefined) {
      this.updateGeometry();
    }

    // 更新发光效果
    if (options.color !== undefined || options.glowPower !== undefined) {
      const glowColor = this.resolveColor(options.color, Cesium.Color.CYAN);
      const glowPower = Math.max(0, Math.min(options.glowPower ?? (this.entity as any)._ringGlowPower, 1));
      this.entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
        color: glowColor,
        glowPower,
      });
      (this.entity as any)._ringGlowPower = glowPower;
    }

    // 更新宽度
    if (options.width !== undefined) {
      this.entity.polyline.width = new Cesium.ConstantProperty(options.width);
      if (this.innerEntity?.polyline) {
        this.innerEntity.polyline.width = new Cesium.ConstantProperty(Math.max(1, options.width - 2));
      }
    }

    // 更新内层线样式
    if (this.innerEntity && (
      options.lineColor !== undefined ||
      options.lineStyle !== undefined ||
      options.lineMaterialMode !== undefined
    )) {
      if (this.innerEntity!.polyline) {
        this.innerEntity!.polyline.material = this.createLineMaterial(this.ringOptions);
      }
    }

    // 更新可见性
    if (options.show !== undefined) {
      this.entity.show = options.show;
      if (this.innerEntity) {
        this.innerEntity.show = options.show;
      }
    }
  }

  /**
   * 重建内层线
   */
  private rebuildInnerLine(): void {
    const carto = (this.entity as any)._centerCartographic as Cesium.Cartographic | undefined;
    const radius = (this.entity as any)._outerRadius as number | undefined;
    const segments = (this.entity as any)._ringSegments as number | undefined;
    const groundHeightEpsilon = (this.entity as any)._groundHeightEpsilon as number | undefined;
    const width = (this.entity.polyline!.width as any)?.getValue?.(Cesium.JulianDate.now()) ?? 8;

    if (!carto || radius === undefined) return;

    const clampToGroundValue = (this.entity.polyline as any).clampToGround?.getValue?.(Cesium.JulianDate.now());
    const clampToGround = typeof clampToGroundValue === 'boolean' ? clampToGroundValue : true;
    const heightMeters = clampToGround ? (groundHeightEpsilon ?? 0) : (carto.height ?? 0);
    const ringPositions = this.generateCirclePositions(carto, radius, heightMeters, segments || 128);

    this.innerEntity = this.viewer.entities.add({
      polyline: {
        positions: ringPositions,
        width: Math.max(1, width - 2),
        material: this.createLineMaterial(this.ringOptions),
        clampToGround,
        zIndex: 1,
      },
    });

    (this.entity as any)._innerEntity = this.innerEntity;
  }

  /**
   * 更新几何形状
   */
  private updateGeometry(): void {
    const position = this.toCartesian3(this.ringOptions.position)!;
    const carto = Cesium.Cartographic.fromCartesian(position);
    const radius = this.ringOptions.radius;
    const segments = this.ringOptions.segments ?? 128;
    const clampToGround = this.ringOptions.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(this.ringOptions.groundHeightEpsilon ?? 0)) : 0;
    const heightMeters = clampToGround ? groundHeightEpsilon : (carto.height ?? 0);

    const ringPositions = this.generateCirclePositions(carto, radius, heightMeters, segments || 128);

    this.entity.polyline!.positions = new Cesium.ConstantProperty(ringPositions);
    (this.entity.polyline as any).clampToGround = new Cesium.ConstantProperty(clampToGround);

    if (this.innerEntity?.polyline) {
      this.innerEntity.polyline.positions = new Cesium.ConstantProperty(ringPositions);
      (this.innerEntity.polyline as any).clampToGround = new Cesium.ConstantProperty(clampToGround);
    }

    (this.entity as any)._centerCartographic = carto;
    (this.entity as any)._outerRadius = radius;
    (this.entity as any)._ringSegments = segments || 128;
    (this.entity as any)._groundHeightEpsilon = groundHeightEpsilon;
  }

  /**
   * 更新位置
   */
  setPosition(position: OverlayPosition): void {
    if (this.destroyed) return;
    this.update({ position });
  }

  /**
   * 更新半径
   */
  setRadius(radius: number): void {
    if (this.destroyed) return;
    this.update({ radius });
  }

  /**
   * 获取位置（经纬度）
   */
  getPosition(): [number, number] | null {
    const carto = (this.entity as any)._centerCartographic as Cesium.Cartographic | undefined;
    if (carto) {
      return [
        Cesium.Math.toDegrees(carto.longitude),
        Cesium.Math.toDegrees(carto.latitude),
      ];
    }
    return null;
  }

  /**
   * 获取半径
   */
  getRadius(): number {
    return (this.entity as any)._outerRadius || this.ringOptions.radius;
  }

  /**
   * 从场景中移除圆环
   */
  remove(): void {
    if (this.destroyed) return;

    // 移除内层实体
    if (this.innerEntity) {
      this.viewer.entities.remove(this.innerEntity);
      this.innerEntity = undefined;
    }

    // 调用父类方法移除 Entity
    super.remove();
  }
}