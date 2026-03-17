import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';

export interface RectanglePrimitiveParts {
  outer: Entity; // 外环代理实体（用于拾取标识）
  inner: Entity; // 填充代理实体（用于拾取标识）
}

interface RectanglePrimitiveRecord {
  rectangleId: string;
  parts: RectanglePrimitiveParts;
  instanceIds: { outer: string; inner: string };
  outerPositions: Cesium.Cartesian3[];
  innerPositions: Cesium.Cartesian3[];
  ringColor: Cesium.Color;
  fillColor: Cesium.Color;
  visible: boolean;
}

export class RectanglePrimitiveBatch {
  private viewer: Viewer;
  private ringCollection: Cesium.PrimitiveCollection;
  private fillCollection: Cesium.PrimitiveCollection;
  private ownsCollections: boolean;
  private ownedRootCollection: Cesium.PrimitiveCollection | null = null;

  private ringPrimitive: Cesium.GroundPrimitive | null = null;
  private fillPrimitive: Cesium.GroundPrimitive | null = null;

  private records: Map<string, RectanglePrimitiveRecord> = new Map();
  private rebuildScheduled = false;
  private colorApplyScheduled = false;
  private pendingColorApplyIds: Set<string> = new Set();

  constructor(
    viewer: Viewer,
    options?: {
      ringCollection?: Cesium.PrimitiveCollection;
      fillCollection?: Cesium.PrimitiveCollection;
    }
  ) {
    this.viewer = viewer;

    const ringCollection = options?.ringCollection;
    const fillCollection = options?.fillCollection;

    if (ringCollection || fillCollection) {
      // 当挂载到外部集合下时，这些集合不由本类负责销毁。
      this.ringCollection = (ringCollection ?? fillCollection) as Cesium.PrimitiveCollection;
      this.fillCollection = (fillCollection ?? ringCollection) as Cesium.PrimitiveCollection;
      this.ownsCollections = false;
    } else {
      // 兼容旧用法：创建并持有一个根集合，直接挂到场景上。
      const root = new Cesium.PrimitiveCollection();
      this.ownedRootCollection = root;
      this.ringCollection = root;
      this.fillCollection = root;
      this.ownsCollections = true;
      this.viewer.scene.primitives.add(root);
    }
  }

  public destroy(): void {
    try {
      if (this.ringPrimitive) this.ringCollection.remove(this.ringPrimitive);
      if (this.fillPrimitive) this.fillCollection.remove(this.fillPrimitive);
      this.ringPrimitive = null;
      this.fillPrimitive = null;
    } catch {
      // 忽略异常
    }

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
    rectangleId: string;
    parts: RectanglePrimitiveParts;
    outerPositions: Cesium.Cartesian3[];
    innerPositions: Cesium.Cartesian3[];
    ringColor: Cesium.Color;
    fillColor: Cesium.Color;
    visible: boolean;
  }): void {
    const rectangleId = String(args.rectangleId);
    this.records.set(rectangleId, {
      rectangleId,
      parts: args.parts,
      instanceIds: {
        outer: `${rectangleId}__outer`,
        inner: `${rectangleId}__fill`,
      },
      outerPositions: args.outerPositions,
      innerPositions: args.innerPositions,
      ringColor: args.ringColor,
      fillColor: args.fillColor,
      visible: args.visible,
    });

    this.scheduleRebuild();
  }

  public remove(rectangleId: string): void {
    const key = String(rectangleId);
    if (!this.records.has(key)) return;
    this.records.delete(key);
    this.pendingColorApplyIds.delete(key);
    this.scheduleRebuild();
  }

  public setVisible(rectangleId: string, visible: boolean): void {
    const rec = this.records.get(String(rectangleId));
    if (!rec) return;
    rec.visible = visible;
    this.applyCurrentColors(String(rectangleId));
  }

  public setColors(rectangleId: string, ringColor: Cesium.Color, fillColor: Cesium.Color): void {
    const rec = this.records.get(String(rectangleId));
    if (!rec) return;
    rec.ringColor = ringColor;
    rec.fillColor = fillColor;
    this.applyCurrentColors(String(rectangleId));
  }

  private scheduleApplyColors(rectangleId: string): void {
    this.pendingColorApplyIds.add(String(rectangleId));
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
    if (this.ringPrimitive) {
      try { this.ringCollection.remove(this.ringPrimitive); } catch {}
      this.ringPrimitive = null;
    }
    if (this.fillPrimitive) {
      try { this.fillCollection.remove(this.fillPrimitive); } catch {}
      this.fillPrimitive = null;
    }

    const ringInstances: Cesium.GeometryInstance[] = [];
    const fillInstances: Cesium.GeometryInstance[] = [];

    for (const rec of this.records.values()) {
      const ringAlpha = rec.visible ? rec.ringColor.alpha : 0.0;
      const fillAlpha = rec.visible ? rec.fillColor.alpha : 0.0;

      const ringColor = new Cesium.Color(rec.ringColor.red, rec.ringColor.green, rec.ringColor.blue, ringAlpha);
      const fillColor = new Cesium.Color(rec.fillColor.red, rec.fillColor.green, rec.fillColor.blue, fillAlpha);

      const ringGeom = new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(rec.outerPositions, [new Cesium.PolygonHierarchy(rec.innerPositions)]),
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      });

      ringInstances.push(
        new Cesium.GeometryInstance({
          geometry: ringGeom,
          id: rec.instanceIds.outer,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(ringColor),
          },
        })
      );

      const fillGeom = new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(rec.innerPositions),
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      });

      fillInstances.push(
        new Cesium.GeometryInstance({
          geometry: fillGeom,
          id: rec.instanceIds.inner,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(fillColor),
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

    // 先加填充、后加外环：当“填充/外环”共用同一个集合时，保证外环始终渲染在填充之上。
    if (ringInstances.length > 0) {
      this.ringPrimitive = new Cesium.GroundPrimitive({
        geometryInstances: ringInstances,
        appearance: new Cesium.PerInstanceColorAppearance({
          translucent: true,
          flat: true,
        }),
        asynchronous: true,
      });
      this.ringCollection.add(this.ringPrimitive);
    }

    for (const rec of this.records.values()) {
      this.applyCurrentColors(rec.rectangleId);
    }

    try {
      this.viewer.scene.requestRender?.();
    } catch {
      // 忽略异常
    }
  }

  private applyCurrentColors(rectangleId: string): void {
    const rec = this.records.get(rectangleId);
    if (!rec) return;

    const ringAlpha = rec.visible ? rec.ringColor.alpha : 0.0;
    const fillAlpha = rec.visible ? rec.fillColor.alpha : 0.0;

    const ringColor = new Cesium.Color(rec.ringColor.red, rec.ringColor.green, rec.ringColor.blue, ringAlpha);
    const fillColor = new Cesium.Color(rec.fillColor.red, rec.fillColor.green, rec.fillColor.blue, fillAlpha);

    let needRetry = false;

    try {
      if (this.ringPrimitive) {
        if ((this.ringPrimitive as any).ready) {
          const attrs: any = (this.ringPrimitive as any).getGeometryInstanceAttributes(rec.instanceIds.outer);
          if (attrs && attrs.color) {
            attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(ringColor);
          }
        } else {
          needRetry = true;
        }
      }
    } catch {
      // 忽略异常
    }

    try {
      if (this.fillPrimitive) {
        if ((this.fillPrimitive as any).ready) {
          const attrs: any = (this.fillPrimitive as any).getGeometryInstanceAttributes(rec.instanceIds.inner);
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

    if (needRetry) {
      this.scheduleApplyColors(rectangleId);
    }

    try {
      this.viewer.scene.requestRender?.();
    } catch {
      // 忽略异常
    }
  }
}
