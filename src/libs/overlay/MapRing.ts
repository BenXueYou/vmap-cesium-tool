import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color } from "cesium";
import type { OverlayPosition, OverlayEntity } from "./types";

/**
 * Ring（边缘发光圆环）选项
 */
export interface RingOptions {
  /** 中心点（经纬度/高度 或 Cartesian3） */
  position: OverlayPosition;
  /** 半径（米） */
  radius: number;
  /** 边缘发光颜色 */
  color?: Color | string;
  /** 是否绘制内层线（默认 true）。关闭可去掉“白色芯子” */
  showInnerLine?: boolean;
  /** 实线颜色 */
  lineColor?: Color | string;
  /** 内层线型：实线/虚线（默认 solid） */
  lineStyle?: "solid" | "dashed";
  /** 虚线材质方案：stripe(默认) / dash */
  lineMaterialMode?: "stripe" | "dash";
  /** stripe 模式：条纹重复次数（默认 32） */
  stripeRepeat?: number;
  /** 虚线长度（像素，默认 16） */
  dashLength?: number;
  /** 虚线模式（16bit pattern，可选） */
  dashPattern?: number;
  /** 虚线间隙颜色（默认透明） */
  gapColor?: Color | string;
  /** 线宽（像素） */
  width?: number;
  /** 外层发光线宽（像素）。优先于 width */
  glowWidth?: number;
  /** 内层实线线宽（像素）。不传则使用自动计算 */
  lineWidth?: number;
  /** 发光强度（0-1），越大越“亮/粗” */
  glowPower?: number;
  /** 是否贴地（默认 true） */
  clampToGround?: boolean;
  /** 圆环分段数（默认 128），越大越圆滑 */
  segments?: number;
  /** 覆盖物点击回调 */
  onClick?: (entity: Entity) => void;
  /** 点击该覆盖物时是否高亮显示（默认 false）。支持传入自定义颜色等参数 */
  clickHighlight?: boolean | { color?: Color | string; fillAlpha?: number };
  id?: string;
}

/**
 * Ring 工具类：使用 polyline + PolylineGlowMaterialProperty 实现发光圆环
 */
export class MapRing {
  private viewer: Viewer;
  private entities: Cesium.EntityCollection;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.entities = viewer.entities;
  }

  /**
   * 转换位置为 Cartesian3
   */
  private convertPosition(position: OverlayPosition): Cartesian3 {
    if (position instanceof Cesium.Cartesian3) {
      return position;
    }
    if (Array.isArray(position)) {
      if (position.length === 2) {
        return Cesium.Cartesian3.fromDegrees(position[0], position[1]);
      }
      if (position.length === 3) {
        return Cesium.Cartesian3.fromDegrees(position[0], position[1], position[2]);
      }
    }
    throw new Error("Invalid position format");
  }

  /**
   * 转换颜色
   */
  private resolveColor(color: Color | string): Color {
    if (color instanceof Cesium.Color) {
      return color;
    }
    try {
      return Cesium.Color.fromCssColorString(color);
    } catch {
      return Cesium.Color.WHITE;
    }
  }

  private resolveLineMaterial(options: {
    lineColor?: Color | string;
    lineStyle?: "solid" | "dashed";
    lineMaterialMode?: "stripe" | "dash";
    stripeRepeat?: number;
    dashLength?: number;
    dashPattern?: number;
    gapColor?: Color | string;
  }): Cesium.MaterialProperty {
    const lineStyle = options.lineStyle ?? "solid";
    const c = options.lineColor ? this.resolveColor(options.lineColor) : Cesium.Color.WHITE;
    if (lineStyle === "dashed") {
      const mode = options.lineMaterialMode ?? "stripe";
      const gap = options.gapColor !== undefined ? this.resolveColor(options.gapColor) : Cesium.Color.TRANSPARENT;
      if (mode === "dash") {
        const dashLength = options.dashLength ?? 16;
        const materialOptions: any = {
          color: c,
          dashLength,
          gapColor: gap,
        };
        if (options.dashPattern !== undefined) {
          materialOptions.dashPattern = options.dashPattern;
        }
        return new Cesium.PolylineDashMaterialProperty(materialOptions);
      }

      const repeat = options.stripeRepeat ?? 32;
      return new Cesium.StripeMaterialProperty({
        // 让条纹沿 polyline 的长度方向变化（更像虚线）
        orientation: Cesium.StripeOrientation.VERTICAL,
        evenColor: c,
        oddColor: gap,
        repeat,
      });
    }
    return new Cesium.ColorMaterialProperty(c);
  }

  private resolveGlowMaterial(glowColor?: Color | string, glowPower?: number): Cesium.MaterialProperty {
    const c = glowColor ? this.resolveColor(glowColor) : Cesium.Color.CYAN;
    const gp = Cesium.Math.clamp(glowPower ?? 0.25, 0.0, 1.0);
    return new Cesium.PolylineGlowMaterialProperty({
      color: c,
      glowPower: gp,
    });
  }

  private getInnerWidth(outerWidth: number): number {
    // 内层实线略细，让外层 glow 能“露出来”
    return Math.max(1, Math.round(outerWidth - 2));
  }

  private addInnerEntity(params: {
    outerId: string;
    ringPositions: Cesium.Cartesian3[];
    innerWidth: number;
    lineMaterial: Cesium.MaterialProperty;
    clampToGround: boolean;
  }): Entity {
    return this.entities.add({
      id: `${params.outerId}__inner`,
      polyline: {
        positions: params.ringPositions,
        width: params.innerWidth,
        material: params.lineMaterial,
        clampToGround: params.clampToGround,
        // clampToGround=true 时生效：保证内层在上
        zIndex: 1,
      },
    });
  }

  private removeInnerEntity(outerEntity: Entity): void {
    const overlay = outerEntity as OverlayEntity;
    if (!overlay._innerEntity) return;
    const innerOverlay = overlay._innerEntity as OverlayEntity;
    innerOverlay._onClick = undefined;
    this.entities.remove(overlay._innerEntity);
    overlay._innerEntity = undefined;
  }

  private rebuildRingPositions(entity: Entity, overlay: OverlayEntity, override?: { segments?: number; clampToGround?: boolean }): Cesium.Cartesian3[] | undefined {
    const center = overlay._centerCartographic;
    const radius = overlay._outerRadius;
    if (!center || radius === undefined) return;

    const nextSegments = override?.segments ?? overlay._ringSegments ?? 128;
    const clampFromEntity =
      (entity.polyline as any)?.clampToGround?.getValue?.(Cesium.JulianDate.now?.()) ?? (entity.polyline as any)?.clampToGround;
    const currentClamp = typeof clampFromEntity === "boolean" ? clampFromEntity : true;
    const isClamp = override?.clampToGround ?? currentClamp;
    const heightMeters = isClamp ? 0 : (center.height ?? 0);

    return this.generateCirclePositions(center, radius, heightMeters, nextSegments);
  }

  /**
   * 生成近似圆顶点（Cartesian3 数组）。segments 越大越平滑。
   * 这里沿用 MapCircle 的大圆航线近似，保证在经纬度空间更稳定。
   */
  private generateCirclePositions(
    center: Cesium.Cartographic,
    radiusMeters: number,
    heightMeters: number,
    segments: number = 128
  ): Cesium.Cartesian3[] {
    const R = 6378137.0; // WGS84 半径近似
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
    // 闭合：追加首点
    if (positions.length > 0) {
      positions.push(positions[0]);
    }
    return positions;
  }

  /**
   * 添加 Ring（边缘发光圆环）
   */
  public add(options: RingOptions): Entity {
    const id = options.id || `ring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const width = options.glowWidth ?? options.width ?? 8;
    const segments = options.segments ?? 128;
    const clampToGround = options.clampToGround ?? true;
    const showInnerLine = options.showInnerLine ?? true;

    const centerCartesian = this.convertPosition(options.position);
    const centerCarto = Cesium.Cartographic.fromCartesian(centerCartesian);
    const heightMeters = clampToGround ? 0 : (centerCarto.height ?? 0);

    const ringPositions = this.generateCirclePositions(centerCarto, options.radius, heightMeters, segments);
    const glowMaterial = this.resolveGlowMaterial(options.color, options.glowPower);
    const lineMaterial = this.resolveLineMaterial({
      lineColor: options.lineColor,
      lineStyle: options.lineStyle,
      lineMaterialMode: options.lineMaterialMode,
      stripeRepeat: options.stripeRepeat,
      dashLength: options.dashLength,
      dashPattern: options.dashPattern,
      gapColor: options.gapColor,
    });
    const innerWidth = options.lineWidth ?? this.getInnerWidth(width);

    // 外层：发光
    const entity = this.entities.add({
      id,
      polyline: {
        positions: ringPositions,
        width,
        material: glowMaterial,
        clampToGround,
        // clampToGround=true 时生效：保证外层在下
        zIndex: 0,
      },
    });

    // 内层：实线/虚线（可关闭，避免“白色芯子”）
    const innerEntity = showInnerLine
      ? this.addInnerEntity({
          outerId: id,
          ringPositions,
          innerWidth,
          lineMaterial,
          clampToGround,
        })
      : undefined;

    const overlayEntity = entity as OverlayEntity;
    overlayEntity._overlayType = "ring";
    overlayEntity._centerCartographic = centerCarto;
    overlayEntity._outerRadius = options.radius;
    overlayEntity._ringSegments = segments;
    overlayEntity._ringGlowPower = Cesium.Math.clamp(options.glowPower ?? 0.25, 0.0, 1.0);
    overlayEntity._ringLineColor = options.lineColor ?? Cesium.Color.WHITE;
    overlayEntity._ringLineStyle = options.lineStyle ?? "solid";
    overlayEntity._ringLineMaterialMode = options.lineMaterialMode ?? "stripe";
    overlayEntity._ringStripeRepeat = options.stripeRepeat;
    overlayEntity._ringDashLength = options.dashLength;
    overlayEntity._ringDashPattern = options.dashPattern;
    overlayEntity._ringGapColor = options.gapColor;
    overlayEntity._ringShowInnerLine = showInnerLine;
    overlayEntity._innerEntity = innerEntity;

    if (options.onClick) {
      overlayEntity._onClick = options.onClick;
      if (innerEntity) {
        const innerOverlay = innerEntity as OverlayEntity;
        // 点击内层也转发给外层，保证回调拿到的是“主实体”
        innerOverlay._onClick = () => options.onClick?.(entity);
      }
    }

    const clickHighlight = options.clickHighlight ?? false;
    const group = innerEntity ? [entity, innerEntity] : [entity];
    overlayEntity._clickHighlight = clickHighlight;
    overlayEntity._highlightEntities = group;
    if (innerEntity) {
      const innerOverlay = innerEntity as OverlayEntity;
      innerOverlay._clickHighlight = clickHighlight;
      innerOverlay._highlightEntities = group;
    }

    return entity;
  }

  /**
   * 更新 Ring 中心
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    if (!entity.polyline) return;
    const overlay = entity as OverlayEntity;
    const segments = overlay._ringSegments ?? 128;
    const radius = overlay._outerRadius ?? 0;

    const centerCartesian = this.convertPosition(position);
    const centerCarto = Cesium.Cartographic.fromCartesian(centerCartesian);

    const clampToGround = (entity.polyline as any).clampToGround?.getValue?.(Cesium.JulianDate.now?.()) ?? (entity.polyline as any).clampToGround;
    const isClamp = typeof clampToGround === "boolean" ? clampToGround : true;
    const heightMeters = isClamp ? 0 : (centerCarto.height ?? 0);
    const ringPositions = this.generateCirclePositions(centerCarto, radius, heightMeters, segments);
    entity.polyline.positions = new Cesium.ConstantProperty(ringPositions);
    if (overlay._innerEntity?.polyline) {
      overlay._innerEntity.polyline.positions = new Cesium.ConstantProperty(ringPositions);
    }
    overlay._centerCartographic = centerCarto;
  }

  /**
   * 更新 Ring 半径
   */
  public updateRadius(entity: Entity, radius: number): void {
    if (!entity.polyline) return;
    const overlay = entity as OverlayEntity;
    const segments = overlay._ringSegments ?? 128;
    const center = overlay._centerCartographic;
    if (!center) return;

    const clampToGround = (entity.polyline as any).clampToGround?.getValue?.(Cesium.JulianDate.now?.()) ?? (entity.polyline as any).clampToGround;
    const isClamp = typeof clampToGround === "boolean" ? clampToGround : true;
    const heightMeters = isClamp ? 0 : (center.height ?? 0);
    const ringPositions = this.generateCirclePositions(center, radius, heightMeters, segments);
    entity.polyline.positions = new Cesium.ConstantProperty(ringPositions);
    if (overlay._innerEntity?.polyline) {
      overlay._innerEntity.polyline.positions = new Cesium.ConstantProperty(ringPositions);
    }
    overlay._outerRadius = radius;
  }

  /**
   * 更新 Ring 样式
   */
  public updateStyle(
    entity: Entity,
    options: Partial<
      Pick<
        RingOptions,
        "color" | "showInnerLine" | "lineColor" | "lineStyle" | "lineMaterialMode" | "stripeRepeat" | "dashLength" | "dashPattern" | "gapColor" | "width" | "glowWidth" | "lineWidth" | "glowPower" | "clampToGround" | "segments"
      >
    >
  ): void {
    if (!entity.polyline) return;
    const overlay = entity as OverlayEntity;

    // 允许动态开关内层线
    if (options.showInnerLine !== undefined) {
      overlay._ringShowInnerLine = options.showInnerLine;
      if (!options.showInnerLine) {
        this.removeInnerEntity(entity);
      } else if (!overlay._innerEntity) {
        const ringPositions = this.rebuildRingPositions(entity, overlay, { clampToGround: options.clampToGround, segments: options.segments });
        if (ringPositions) {
          const clampToGround =
            options.clampToGround ??
            ((entity.polyline as any)?.clampToGround?.getValue?.(Cesium.JulianDate.now?.()) ?? (entity.polyline as any)?.clampToGround);
          const isClamp = typeof clampToGround === "boolean" ? clampToGround : true;

          const outerWidth =
            (entity.polyline.width as any)?.getValue?.(Cesium.JulianDate.now?.()) ??
            (entity.polyline.width as any) ??
            (options.glowWidth ?? options.width ?? 8);
          const computedOuterWidth = typeof outerWidth === "number" ? outerWidth : (options.glowWidth ?? options.width ?? 8);
          const innerWidth = options.lineWidth ?? this.getInnerWidth(computedOuterWidth);

          const lineMaterial = this.resolveLineMaterial({
            lineColor: options.lineColor ?? overlay._ringLineColor,
            lineStyle: options.lineStyle ?? overlay._ringLineStyle,
            lineMaterialMode: options.lineMaterialMode ?? overlay._ringLineMaterialMode,
            stripeRepeat: options.stripeRepeat ?? overlay._ringStripeRepeat,
            dashLength: options.dashLength ?? overlay._ringDashLength,
            dashPattern: options.dashPattern ?? overlay._ringDashPattern,
            gapColor: options.gapColor ?? overlay._ringGapColor,
          });

          const innerEntity = this.addInnerEntity({
            outerId: String(entity.id),
            ringPositions,
            innerWidth,
            lineMaterial,
            clampToGround: isClamp,
          });
          overlay._innerEntity = innerEntity;

          // 如果外层有点击回调，内层也要转发
          if (overlay._onClick) {
            const innerOverlay = innerEntity as OverlayEntity;
            innerOverlay._onClick = () => overlay._onClick?.(entity);
          }
        }
      }
    }

    const nextOuterWidth = options.glowWidth ?? options.width;
    if (nextOuterWidth !== undefined) {
      entity.polyline.width = new Cesium.ConstantProperty(nextOuterWidth);
      if (overlay._innerEntity?.polyline) {
        const nextInnerWidth = options.lineWidth ?? this.getInnerWidth(nextOuterWidth);
        overlay._innerEntity.polyline.width = new Cesium.ConstantProperty(nextInnerWidth);
      }
    } else if (options.lineWidth !== undefined) {
      if (overlay._innerEntity?.polyline) {
        overlay._innerEntity.polyline.width = new Cesium.ConstantProperty(options.lineWidth);
      }
    }

    if (options.color !== undefined || options.glowPower !== undefined) {
      const gp = options.glowPower ?? overlay._ringGlowPower ?? 0.25;
      entity.polyline.material = this.resolveGlowMaterial(options.color ?? Cesium.Color.CYAN, gp);
      overlay._ringGlowPower = Cesium.Math.clamp(gp, 0.0, 1.0);
    }

    const lineStyleChanged =
      options.lineColor !== undefined ||
      options.lineStyle !== undefined ||
      options.lineMaterialMode !== undefined ||
      options.stripeRepeat !== undefined ||
      options.dashLength !== undefined ||
      options.dashPattern !== undefined ||
      options.gapColor !== undefined;

    if (lineStyleChanged && overlay._innerEntity?.polyline) {
      const nextLineColor = options.lineColor ?? overlay._ringLineColor;
      const nextLineStyle = options.lineStyle ?? overlay._ringLineStyle;
      const nextLineMaterialMode = options.lineMaterialMode ?? overlay._ringLineMaterialMode;
      const nextStripeRepeat = options.stripeRepeat ?? overlay._ringStripeRepeat;
      const nextDashLength = options.dashLength ?? overlay._ringDashLength;
      const nextDashPattern = options.dashPattern ?? overlay._ringDashPattern;
      const nextGapColor = options.gapColor ?? overlay._ringGapColor;
      overlay._innerEntity.polyline.material = this.resolveLineMaterial({
        lineColor: nextLineColor,
        lineStyle: nextLineStyle,
        lineMaterialMode: nextLineMaterialMode,
        stripeRepeat: nextStripeRepeat,
        dashLength: nextDashLength,
        dashPattern: nextDashPattern,
        gapColor: nextGapColor,
      });
      overlay._ringLineColor = nextLineColor;
      overlay._ringLineStyle = nextLineStyle;
      overlay._ringLineMaterialMode = nextLineMaterialMode;
      overlay._ringStripeRepeat = nextStripeRepeat;
      overlay._ringDashLength = nextDashLength;
      overlay._ringDashPattern = nextDashPattern;
      overlay._ringGapColor = nextGapColor;
    }

    const center = overlay._centerCartographic;
    const radius = overlay._outerRadius;
    const nextSegments = options.segments ?? overlay._ringSegments;
    const segmentsChanged = options.segments !== undefined && options.segments !== overlay._ringSegments;
    const clampChanged = options.clampToGround !== undefined;

    if (options.clampToGround !== undefined) {
      (entity.polyline as any).clampToGround = new Cesium.ConstantProperty(options.clampToGround);
      if (overlay._innerEntity?.polyline) {
        (overlay._innerEntity.polyline as any).clampToGround = new Cesium.ConstantProperty(options.clampToGround);
      }
    }

    if ((segmentsChanged || clampChanged) && center && radius !== undefined) {
      const isClamp = options.clampToGround ?? true;
      const heightMeters = isClamp ? 0 : (center.height ?? 0);
      const ringPositions = this.generateCirclePositions(center, radius, heightMeters, nextSegments ?? 128);
      entity.polyline.positions = new Cesium.ConstantProperty(ringPositions);
      if (overlay._innerEntity?.polyline) {
        overlay._innerEntity.polyline.positions = new Cesium.ConstantProperty(ringPositions);
      }
      overlay._ringSegments = nextSegments ?? 128;
    }
  }

  /**
   * 显示/隐藏 Ring
   */
  public setVisible(entity: Entity, visible: boolean): void {
    entity.show = visible;
    const overlay = entity as OverlayEntity;
    if (overlay._innerEntity) {
      overlay._innerEntity.show = visible;
    }
  }

  /**
   * 移除 Ring（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === "string" ? this.entities.getById(entityOrId) : entityOrId;
    if (!entity) return false;
    const overlay = entity as OverlayEntity;
    overlay._onClick = undefined;
    if (overlay._innerEntity) {
      const innerOverlay = overlay._innerEntity as OverlayEntity;
      innerOverlay._onClick = undefined;
      this.entities.remove(overlay._innerEntity);
      overlay._innerEntity = undefined;
    }
    return this.entities.remove(entity);
  }
}