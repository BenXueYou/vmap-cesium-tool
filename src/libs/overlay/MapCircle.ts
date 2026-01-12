import * as Cesium from "cesium";
import type { Viewer, Entity, Cartesian3, Color, HeightReference } from "cesium";
import type { OverlayPosition, OverlayEntity } from './types';

/**
 * Circle 选项
 */
export interface CircleOptions {
  position: OverlayPosition;
  radius: number; // 米
  material?: Cesium.MaterialProperty | Color | string;
  outline?: boolean;
  outlineColor?: Color | string;
  outlineWidth?: number;
  /**
   * 粗边框（outlineWidth>1）模式下用于近似圆的分段数，越大越圆滑但更耗性能。
   * 默认 256。
   */
  segments?: number;
  /**
   * 是否贴地（默认：在粗边框模式下为 true）。
   * - true：填充与边框都贴地。
   * - false：填充与边框都使用 position 高度悬空。
   */
  clampToGround?: boolean;
  heightReference?: HeightReference;
  extrudedHeight?: number;
  heightEpsilon?: number; // 高度容差，用于环形方案
  onClick?: (entity: Entity) => void;
  id?: string;
}

/**
 * Circle 工具类
 */
export class MapCircle {
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
      } else if (position.length === 3) {
        return Cesium.Cartesian3.fromDegrees(position[0], position[1], position[2]);
      }
    }
    throw new Error('Invalid position format');
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

  /**
   * 解析材质
   */
  private resolveMaterial(material?: Cesium.MaterialProperty | Color | string): Cesium.MaterialProperty | Color {
    if (!material) {
      return Cesium.Color.BLUE.withAlpha(0.5);
    }
    if (typeof material === 'string') {
      return this.resolveColor(material);
    }
    if (material instanceof Cesium.Color) {
      return material;
    }
    return material;
  }

  /**
   * 添加 Circle（圆形）
   */
  public add(options: CircleOptions): Entity {
    const position = this.convertPosition(options.position);
    const id = options.id || `circle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const material = this.resolveMaterial(options.material);

    // 判断是否启用双层椭圆环方案：当 outlineWidth>1 时，将其视为米单位厚度，使用双层椭圆实现粗边框
    const ringThickness = (options.outlineWidth && options.outlineWidth > 1) ? options.outlineWidth : 0;

    if (ringThickness > 0) {
      const clampToGround = options.clampToGround ?? true;
      const baseCartoRaw = Cesium.Cartographic.fromCartesian(position);
      const baseHeight = clampToGround ? 0 : ((baseCartoRaw?.height ?? 0) as number);
      const heightReference = clampToGround
        ? Cesium.HeightReference.CLAMP_TO_GROUND
        : (options.heightReference ?? Cesium.HeightReference.NONE);

      const heightEpsilon = options.heightEpsilon ?? (clampToGround ? 0 : 0.01);
      const ringHeight = baseHeight + heightEpsilon;

      const baseCarto = new Cesium.Cartographic(baseCartoRaw.longitude, baseCartoRaw.latitude, 0);
      const centerCartesian = Cesium.Cartesian3.fromRadians(baseCartoRaw.longitude, baseCartoRaw.latitude, 0);

      const ringSegments = Math.max(16, Math.floor(options.segments ?? 256));

      const outerRadius = options.radius;
      const innerRadius = Math.max(0, options.radius - ringThickness);

      // 统一几何：外环与内填充都使用同样的近似圆顶点，避免“外圈是多边形/内圈是真圆”产生缝隙
      const outerPositions = this.generateCirclePositions(baseCarto, outerRadius, 0, ringSegments);
      const innerPositions = this.generateCirclePositions(baseCarto, innerRadius, 0, ringSegments);

      const outer = this.entities.add({
        id,
        // 使用带洞的多边形，只渲染环带区域，不填充中心
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)]),
          material: new Cesium.ColorMaterialProperty(options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK),
          outline: false,
          heightReference,
          ...(clampToGround ? {} : { height: ringHeight }),
        },
      });

      const inner = this.entities.add({
        id: `${id}__fill`,
        position: centerCartesian,
        polygon: {
          hierarchy: innerPositions,
          material: material instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(material) : (material as Cesium.MaterialProperty),
          outline: false,
          heightReference,
          ...(clampToGround ? {} : { height: ringHeight }),
          extrudedHeight: options.extrudedHeight,
        },
      });

      if (options.onClick) {
        const outerEntity = outer as OverlayEntity;
        const innerEntity = inner as OverlayEntity;
        outerEntity._onClick = options.onClick;
        innerEntity._onClick = options.onClick;
      }

      // 记录元数据，便于更新/移除
      const outerEntity = outer as OverlayEntity;
      outerEntity._innerEntity = inner;
      outerEntity._isRing = true;
      outerEntity._ringThickness = ringThickness;
      outerEntity._fillMaterial = material;
      outerEntity._ringHeightEpsilon = heightEpsilon;
      outerEntity._centerCartographic = new Cesium.Cartographic(baseCartoRaw.longitude, baseCartoRaw.latitude, baseHeight);
      outerEntity._outerRadius = outerRadius;
      outerEntity._innerRadius = innerRadius;
      outerEntity._ringSegments = ringSegments;
      outerEntity._clampToGround = clampToGround;
      outerEntity._baseHeight = baseHeight;

      return outer;
    } else {
      // 非环形：默认贴地（可通过 clampToGround:false 或传入 heightReference 覆盖）
      const clampToGround = options.clampToGround ?? true;
      const heightReference =
        options.heightReference ?? (clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE);

      // Cesium 的 ellipse 高度以 ellipse.height 为准（position 的高度不一定会被当作图形高度使用）。
      // 因此统一策略：position 始终使用地表点（height=0），悬空高度通过 ellipse.height 表达。
      const carto = Cesium.Cartographic.fromCartesian(position);
      const surfacePosition = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
      const heightMeters = clampToGround ? 0 : (carto.height ?? 0);

      const entity = this.entities.add({
        id,
        position: surfacePosition,
        ellipse: {
          semiMajorAxis: options.radius,
          semiMinorAxis: options.radius,
          material,
          outline: options.outline ?? true,
          outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor) : Cesium.Color.BLACK,
          outlineWidth: options.outlineWidth ?? 1,
          heightReference,
          height: heightMeters,
          extrudedHeight: options.extrudedHeight,
        },
      });

      if (options.onClick) {
        const overlayEntity = entity as OverlayEntity;
        overlayEntity._onClick = options.onClick;
      }

      (entity as OverlayEntity)._clampToGround = clampToGround;
      (entity as OverlayEntity)._baseHeight = heightMeters;

      return entity;
    }
  }

  /**
   * 生成近似圆（多边形）顶点，返回 Cartesian3 数组。
   * 使用大圆航线公式，segments 越大越平滑。
   */
  private generateCirclePositions(center: Cesium.Cartographic, radiusMeters: number, heightMeters: number, segments: number = 128): Cesium.Cartesian3[] {
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
    return positions;
  }

  /**
   * 更新 Circle 位置
   */
  public updatePosition(entity: Entity, position: OverlayPosition): void {
    const newPosition = this.convertPosition(position);
    const overlay = entity as OverlayEntity;

    let carto: Cesium.Cartographic | undefined;
    try {
      carto = Cesium.Cartographic.fromCartesian(newPosition);
    } catch {
      carto = undefined;
    }
    if (!carto) {
      entity.position = new Cesium.ConstantPositionProperty(newPosition);
      const innerFallback = overlay._innerEntity;
      if (innerFallback) {
        innerFallback.position = new Cesium.ConstantPositionProperty(newPosition);
      }
      return;
    }

    const clampToGround = overlay._clampToGround ?? false;
    const baseHeight = clampToGround ? 0 : (carto.height ?? 0);
    const heightEpsilon = overlay._ringHeightEpsilon ?? 0;
    const ringHeight = baseHeight + heightEpsilon;
    overlay._baseHeight = baseHeight;

    const surfacePosition = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);

    // 环形（粗边框）方案：外层是 polygon（环带），需要重建 hierarchy；内层是 ellipse，用 height 控制悬空
    if (overlay._isRing && entity.polygon) {
      overlay._centerCartographic = new Cesium.Cartographic(carto.longitude, carto.latitude, baseHeight);

      const outerRadius = overlay._outerRadius;
      const innerRadius = overlay._innerRadius;
      const segments = overlay._ringSegments ?? 256;
      if (outerRadius !== undefined && innerRadius !== undefined) {
        const baseCarto0 = new Cesium.Cartographic(carto.longitude, carto.latitude, 0);
        const outerPositions = this.generateCirclePositions(baseCarto0, outerRadius, 0, segments);
        const innerPositions = this.generateCirclePositions(baseCarto0, innerRadius, 0, segments);
        entity.polygon.hierarchy = new Cesium.ConstantProperty(
          new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(innerPositions)])
        );

        const inner = overlay._innerEntity;
        if (inner && inner.polygon) {
          inner.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(innerPositions));
        }
      }

      // 高度策略：贴地=CLAMP_TO_GROUND；悬空=NONE + height
      (entity.polygon as any).heightReference = new Cesium.ConstantProperty(
        clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
      );
      if (clampToGround) {
        (entity.polygon as any).height = undefined;
      } else {
        (entity.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
      }

      const inner = overlay._innerEntity;
      if (inner) {
        inner.position = new Cesium.ConstantPositionProperty(surfacePosition);
        if (inner.polygon) {
          (inner.polygon as any).heightReference = new Cesium.ConstantProperty(
            clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
          );
          if (clampToGround) {
            (inner.polygon as any).height = undefined;
          } else {
            (inner.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
          }
        }
      }
      return;
    }

    // 非环形：position 使用地表点，高度用 ellipse.height 表达
    entity.position = new Cesium.ConstantPositionProperty(surfacePosition);
    overlay._baseHeight = clampToGround ? 0 : baseHeight;
    if (entity.ellipse) {
      entity.ellipse.heightReference = new Cesium.ConstantProperty(
        clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
      );
      entity.ellipse.height = new Cesium.ConstantProperty(clampToGround ? 0 : baseHeight);
    }
  }

  /**
   * 更新 Circle 半径
   */
  public updateRadius(entity: Entity, radius: number): void {
    const overlayEntity = entity as OverlayEntity;
    const thickness = overlayEntity._ringThickness;

    // 环形（粗边框）：需要重建外环 + 内填充的 polygon hierarchy
    if (overlayEntity._isRing && entity.polygon && thickness !== undefined) {
      const center = overlayEntity._centerCartographic;
      if (!center) return;
      const clampToGround = overlayEntity._clampToGround ?? false;
      const baseHeight = overlayEntity._baseHeight ?? 0;
      const heightEpsilon = overlayEntity._ringHeightEpsilon ?? 0;
      const ringHeight = baseHeight + heightEpsilon;
      const segments = overlayEntity._ringSegments ?? 256;

      overlayEntity._outerRadius = radius;
      overlayEntity._innerRadius = Math.max(0, radius - thickness);

      const baseCarto0 = new Cesium.Cartographic(center.longitude, center.latitude, 0);
      const outerPositions = this.generateCirclePositions(baseCarto0, overlayEntity._outerRadius, 0, segments);
      const holePositions = this.generateCirclePositions(baseCarto0, overlayEntity._innerRadius, 0, segments);
      entity.polygon.hierarchy = new Cesium.ConstantProperty(
        new Cesium.PolygonHierarchy(outerPositions, [new Cesium.PolygonHierarchy(holePositions)])
      );
      (entity.polygon as any).heightReference = new Cesium.ConstantProperty(
        clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
      );
      if (!clampToGround) {
        (entity.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
      }

      const inner = overlayEntity._innerEntity;
      if (inner && inner.polygon) {
        inner.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(holePositions));
        (inner.polygon as any).heightReference = new Cesium.ConstantProperty(
          clampToGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE
        );
        if (!clampToGround) {
          (inner.polygon as any).height = new Cesium.ConstantProperty(ringHeight);
        }
      }
      return;
    }

    // 非环形：按 ellipse 半径更新
    if (entity.ellipse) {
      entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(radius);
      entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(radius);
    }
  }

  /**
   * 更新 Circle 样式
   */
  public updateStyle(entity: Entity, options: Partial<Pick<CircleOptions, 'material' | 'outline' | 'outlineColor' | 'outlineWidth'>>): void {
    const overlay = entity as OverlayEntity;

    // 环形（粗边框）方案：外层 polygon 是边框，内层 polygon 是填充
    if (overlay._isRing && entity.polygon) {
      const inner = overlay._innerEntity;
      if (options.outlineColor !== undefined) {
        entity.polygon.material = new Cesium.ColorMaterialProperty(this.resolveColor(options.outlineColor));
      }
      if (options.material !== undefined && inner && inner.polygon) {
        const mat = this.resolveMaterial(options.material);
        inner.polygon.material = mat instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(mat) : (mat as Cesium.MaterialProperty);
        overlay._fillMaterial = options.material;
      }
      if (options.outlineWidth !== undefined) {
        const thickness = Math.max(0, options.outlineWidth);
        overlay._ringThickness = thickness;
        const outerRadius = overlay._outerRadius;
        if (outerRadius !== undefined) {
          this.updateRadius(entity, outerRadius);
        }
      }
      return;
    }

    // 非环形：按原生 ellipse outline/material
    if (entity.ellipse) {
      if (options.material !== undefined) {
        const mat = this.resolveMaterial(options.material);
        entity.ellipse.material = mat instanceof Cesium.Color ? new Cesium.ColorMaterialProperty(mat) : (mat as Cesium.MaterialProperty);
      }
      if (options.outline !== undefined) {
        entity.ellipse.outline = new Cesium.ConstantProperty(options.outline);
      }
      if (options.outlineColor !== undefined) {
        entity.ellipse.outlineColor = new Cesium.ConstantProperty(this.resolveColor(options.outlineColor));
      }
      if (options.outlineWidth !== undefined) {
        entity.ellipse.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      }
    }
  }

  /**
   * 移除 Circle（通过实体或实体 id）
   */
  public remove(entityOrId: Entity | string): boolean {
    const entity = typeof entityOrId === 'string' ? this.entities.getById(entityOrId) : entityOrId;
    if (!entity) return false;
    const overlayEntity = entity as OverlayEntity;
    const inner = overlayEntity._innerEntity;
    if (inner) {
      (inner as OverlayEntity)._onClick = undefined;
      this.entities.remove(inner);
    }
    overlayEntity._onClick = undefined;
    return this.entities.remove(entity);
  }
} 

