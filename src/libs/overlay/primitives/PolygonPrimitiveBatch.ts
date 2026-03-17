import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';

export interface PolygonPrimitiveParts {
  fill: Entity; // 填充代理实体（用于拾取标识）
  border: Entity; // 边框代理实体（用于拾取标识）
}

interface PolygonPrimitiveRecord {
  polygonId: string;
  parts: PolygonPrimitiveParts;
  instanceIds: { fill: string; border: string };
  fillPositions: Cesium.Cartesian3[];
  borderPositions: Cesium.Cartesian3[];
  borderWidth: number;
  fillColor: Cesium.Color;
  borderColor: Cesium.Color;
  visible: boolean;
}

export class PolygonPrimitiveBatch {
  private viewer: Viewer;
  private fillCollection: Cesium.PrimitiveCollection;
  private borderCollection: Cesium.PrimitiveCollection;
  private ownsCollections: boolean;
  private ownedRootCollection: Cesium.PrimitiveCollection | null = null;

  private fillPrimitive: Cesium.GroundPrimitive | null = null;
  private borderPrimitive: Cesium.GroundPolylinePrimitive | null = null;

  private records: Map<string, PolygonPrimitiveRecord> = new Map();
  private rebuildScheduled = false;
  private colorApplyScheduled = false;
  private pendingColorApplyIds: Set<string> = new Set();

  constructor(
    viewer: Viewer,
    options?: {
      fillCollection?: Cesium.PrimitiveCollection;
      borderCollection?: Cesium.PrimitiveCollection;
    }
  ) {
    this.viewer = viewer;

    const fillCollection = options?.fillCollection;
    const borderCollection = options?.borderCollection;

    if (fillCollection || borderCollection) {
      // 当挂载到外部集合下时，这些集合不由本类负责销毁。
      this.fillCollection = (fillCollection ?? borderCollection) as Cesium.PrimitiveCollection;
      this.borderCollection = (borderCollection ?? fillCollection) as Cesium.PrimitiveCollection;
      this.ownsCollections = false;
    } else {
      // 兼容旧用法：创建并持有一个根集合，直接挂到场景上。
      const root = new Cesium.PrimitiveCollection();
      this.ownedRootCollection = root;
      this.fillCollection = root;
      this.borderCollection = root;
      this.ownsCollections = true;
      this.viewer.scene.primitives.add(root);
    }
  }

  public destroy(): void {
    try {
      if (this.fillPrimitive) this.fillCollection.remove(this.fillPrimitive);
      if (this.borderPrimitive) this.borderCollection.remove(this.borderPrimitive);
    } catch {
      // 忽略异常
    }
    this.fillPrimitive = null;
    this.borderPrimitive = null;

    if (this.ownsCollections && this.ownedRootCollection) {
      try {
        this.viewer.scene.primitives.remove(this.ownedRootCollection);
      } catch {
        // 忽略异常
      }
      this.ownedRootCollection = null;
    }

    this.records.clear();
  }

  public upsertGeometry(args: {
    polygonId: string;
    parts: PolygonPrimitiveParts;
    fillPositions: Cesium.Cartesian3[];
    borderPositions: Cesium.Cartesian3[];
    borderWidth: number;
    fillColor: Cesium.Color;
    borderColor: Cesium.Color;
    visible: boolean;
  }): void {
    this.records.set(args.polygonId, {
      polygonId: args.polygonId,
      parts: args.parts,
      instanceIds: {
        fill: `${args.polygonId}__fill`,
        border: `${args.polygonId}__border`,
      },
      fillPositions: args.fillPositions,
      borderPositions: args.borderPositions,
      borderWidth: Math.max(1, Number(args.borderWidth) || 1),
      fillColor: args.fillColor,
      borderColor: args.borderColor,
      visible: args.visible,
    });

    this.scheduleRebuild();
  }

  public remove(polygonId: string): void {
    if (!this.records.has(polygonId)) return;
    this.records.delete(polygonId);
    this.pendingColorApplyIds.delete(polygonId);
    this.scheduleRebuild();
  }

  public setVisible(polygonId: string, visible: boolean): void {
    const rec = this.records.get(polygonId);
    if (!rec) return;
    rec.visible = visible;
    this.applyCurrentColors(polygonId);
  }

  public setColors(polygonId: string, borderColor: Cesium.Color, fillColor: Cesium.Color): void {
    const rec = this.records.get(polygonId);
    if (!rec) return;
    rec.borderColor = borderColor;
    rec.fillColor = fillColor;
    this.applyCurrentColors(polygonId);
  }

  private scheduleApplyColors(polygonId: string): void {
    this.pendingColorApplyIds.add(polygonId);
    if (this.colorApplyScheduled) return;
    this.colorApplyScheduled = true;

    const raf = (globalThis as any).requestAnimationFrame as ((cb: FrameRequestCallback) => number) | undefined;
    const tick = () => {
      this.colorApplyScheduled = false;
      const ids = Array.from(this.pendingColorApplyIds);
      this.pendingColorApplyIds.clear();
      for (const id of ids) {
        this.applyCurrentColors(id);
      }
    };

    if (typeof raf === 'function') {
      raf(tick);
      return;
    }
    setTimeout(tick, 0);
  }

  public setBorderWidth(polygonId: string, borderWidth: number): void {
    const rec = this.records.get(polygonId);
    if (!rec) return;
    rec.borderWidth = Math.max(1, Number(borderWidth) || 1);
    this.scheduleRebuild();
  }

  private scheduleRebuild(): void {
    if (this.rebuildScheduled) return;
    this.rebuildScheduled = true;

    const raf = (globalThis as any).requestAnimationFrame as ((cb: FrameRequestCallback) => number) | undefined;
    if (typeof raf === 'function') {
      raf(() => {
        this.rebuildScheduled = false;
        this.rebuild();
      });
      return;
    }

    setTimeout(() => {
      this.rebuildScheduled = false;
      this.rebuild();
    }, 0);
  }

  private rebuild(): void {
    if (this.fillPrimitive) {
      try { this.fillCollection.remove(this.fillPrimitive); } catch {}
      this.fillPrimitive = null;
    }
    if (this.borderPrimitive) {
      try { this.borderCollection.remove(this.borderPrimitive); } catch {}
      this.borderPrimitive = null;
    }

    const fillInstances: Cesium.GeometryInstance[] = [];
    const borderInstances: Cesium.GeometryInstance[] = [];

    for (const rec of this.records.values()) {
      const fillAlpha = rec.visible ? rec.fillColor.alpha : 0.0;
      const borderAlpha = rec.visible ? rec.borderColor.alpha : 0.0;

      const fillColor = new Cesium.Color(rec.fillColor.red, rec.fillColor.green, rec.fillColor.blue, fillAlpha);
      const borderColor = new Cesium.Color(rec.borderColor.red, rec.borderColor.green, rec.borderColor.blue, borderAlpha);

      const fillGeom = new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(rec.fillPositions),
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      });

      fillInstances.push(
        new Cesium.GeometryInstance({
          geometry: fillGeom,
          id: rec.instanceIds.fill,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(fillColor),
          },
        })
      );

      const borderGeom = new Cesium.GroundPolylineGeometry({
        positions: rec.borderPositions,
        width: rec.borderWidth,
      });

      borderInstances.push(
        new Cesium.GeometryInstance({
          geometry: borderGeom,
          id: rec.instanceIds.border,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(borderColor),
          },
        })
      );
    }

    if (fillInstances.length > 0) {
      this.fillPrimitive = new Cesium.GroundPrimitive({
        geometryInstances: fillInstances,
        appearance: new Cesium.PerInstanceColorAppearance({
          translucent: true,
          flat: true,
        }),
        asynchronous: true,
      });
      this.fillCollection.add(this.fillPrimitive);
    }

    if (borderInstances.length > 0) {
      this.borderPrimitive = new Cesium.GroundPolylinePrimitive({
        geometryInstances: borderInstances,
        appearance: new Cesium.PolylineColorAppearance({
          translucent: true,
        }),
      });
      this.borderCollection.add(this.borderPrimitive);
    }

    for (const rec of this.records.values()) {
      this.applyCurrentColors(rec.polygonId);
    }

    try {
      this.viewer.scene.requestRender?.();
    } catch {
      // 忽略异常
    }
  }

  private applyCurrentColors(polygonId: string): void {
    const rec = this.records.get(polygonId);
    if (!rec) return;

    const fillAlpha = rec.visible ? rec.fillColor.alpha : 0.0;
    const borderAlpha = rec.visible ? rec.borderColor.alpha : 0.0;

    const fillColor = new Cesium.Color(rec.fillColor.red, rec.fillColor.green, rec.fillColor.blue, fillAlpha);
    const borderColor = new Cesium.Color(rec.borderColor.red, rec.borderColor.green, rec.borderColor.blue, borderAlpha);

    let needRetry = false;

    try {
      if (this.fillPrimitive) {
        if ((this.fillPrimitive as any).ready) {
          const attrs: any = (this.fillPrimitive as any).getGeometryInstanceAttributes(rec.instanceIds.fill);
          if (attrs && attrs.color) {
            attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(fillColor);
          }
        } else {
          needRetry = true;
        }
      }
    } catch {
      // 忽略异常
    }

    try {
      if (this.borderPrimitive) {
        if ((this.borderPrimitive as any).ready) {
          const attrs: any = (this.borderPrimitive as any).getGeometryInstanceAttributes(rec.instanceIds.border);
          if (attrs && attrs.color) {
            attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(borderColor);
          }
        } else {
          needRetry = true;
        }
      }
    } catch {
      // 忽略异常
    }

    if (needRetry) {
      this.scheduleApplyColors(polygonId);
    }

    try {
      this.viewer.scene.requestRender?.();
    } catch {
      // 忽略异常
    }
  }
}
