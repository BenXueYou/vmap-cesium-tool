import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';

export interface CirclePrimitiveParts {
  outer: Entity; // ring entity proxy (pick id)
  inner: Entity; // fill entity proxy (pick id)
}

interface CirclePrimitiveRecord {
  circleId: string;
  parts: CirclePrimitiveParts;
  ringPositions: Cesium.Cartesian3[];
  fillPositions: Cesium.Cartesian3[];
  ringColor: Cesium.Color;
  fillColor: Cesium.Color;
  visible: boolean;
}

export class CirclePrimitiveBatch {
  private viewer: Viewer;
  private ringCollection: Cesium.PrimitiveCollection;
  private fillCollection: Cesium.PrimitiveCollection;
  private ownsCollections: boolean;
  private ownedRootCollection: Cesium.PrimitiveCollection | null = null;

  private ringPrimitive: Cesium.GroundPrimitive | null = null;
  private fillPrimitive: Cesium.GroundPrimitive | null = null;

  private records: Map<string, CirclePrimitiveRecord> = new Map();

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
      // When mounted under external collections, we do not own them.
      this.ringCollection = (ringCollection ?? fillCollection) as Cesium.PrimitiveCollection;
      this.fillCollection = (fillCollection ?? ringCollection) as Cesium.PrimitiveCollection;
      this.ownsCollections = false;
    } else {
      // Backwards-compatible: one owned collection attached to the scene.
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
      // ignore
    }

    if (this.ownsCollections && this.ownedRootCollection) {
      try {
        this.viewer.scene.primitives.remove(this.ownedRootCollection);
      } catch {
        // ignore
      }
      this.ownedRootCollection = null;
    }

    this.records.clear();
  }

  public has(circleId: string): boolean {
    return this.records.has(circleId);
  }

  public upsertGeometry(args: {
    circleId: string;
    parts: CirclePrimitiveParts;
    ringPositions: Cesium.Cartesian3[];
    fillPositions: Cesium.Cartesian3[];
    ringColor: Cesium.Color;
    fillColor: Cesium.Color;
    visible: boolean;
  }): void {
    this.records.set(args.circleId, {
      circleId: args.circleId,
      parts: args.parts,
      ringPositions: args.ringPositions,
      fillPositions: args.fillPositions,
      ringColor: args.ringColor,
      fillColor: args.fillColor,
      visible: args.visible,
    });

    this.scheduleRebuild();
  }

  public remove(circleId: string): void {
    if (!this.records.has(circleId)) return;
    this.records.delete(circleId);
    this.pendingColorApplyIds.delete(circleId);
    this.scheduleRebuild();
  }

  public setVisible(circleId: string, visible: boolean): void {
    const rec = this.records.get(circleId);
    if (!rec) return;
    rec.visible = visible;
    this.applyCurrentColors(circleId);
  }

  public setColors(circleId: string, ringColor: Cesium.Color, fillColor: Cesium.Color): void {
    const rec = this.records.get(circleId);
    if (!rec) return;
    rec.ringColor = ringColor;
    rec.fillColor = fillColor;
    this.applyCurrentColors(circleId);
  }

  private scheduleApplyColors(circleId: string): void {
    this.pendingColorApplyIds.add(circleId);
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
    // Drop old primitives (safe for static-ish scenario)
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
        polygonHierarchy: new Cesium.PolygonHierarchy(rec.ringPositions, [new Cesium.PolygonHierarchy(rec.fillPositions)]),
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      });

      ringInstances.push(
        new Cesium.GeometryInstance({
          geometry: ringGeom,
          id: rec.parts.outer,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(ringColor),
          },
        })
      );

      const fillGeom = new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(rec.fillPositions),
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      });

      fillInstances.push(
        new Cesium.GeometryInstance({
          geometry: fillGeom,
          id: rec.parts.inner,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(fillColor),
          },
        })
      );
    }

    // Add fill first, then ring so ring stays visible when using a single shared collection.
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

    // After rebuild, ensure current colors are applied (covers the case where user toggled highlight while primitive was building)
    for (const rec of this.records.values()) {
      this.applyCurrentColors(rec.circleId);
    }

    try {
      this.viewer.scene.requestRender?.();
    } catch {
      // ignore
    }
  }

  private applyCurrentColors(circleId: string): void {
    const rec = this.records.get(circleId);
    if (!rec) return;

    const ringAlpha = rec.visible ? rec.ringColor.alpha : 0.0;
    const fillAlpha = rec.visible ? rec.fillColor.alpha : 0.0;

    const ringColor = new Cesium.Color(rec.ringColor.red, rec.ringColor.green, rec.ringColor.blue, ringAlpha);
    const fillColor = new Cesium.Color(rec.fillColor.red, rec.fillColor.green, rec.fillColor.blue, fillAlpha);

    let needRetry = false;

    // If primitives are not ready yet (async pipeline), schedule retry so highlight/visible eventually takes effect.
    try {
      if (this.ringPrimitive) {
        if ((this.ringPrimitive as any).ready) {
          const attrs: any = (this.ringPrimitive as any).getGeometryInstanceAttributes(rec.parts.outer);
          if (attrs && attrs.color) {
            attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(ringColor);
          }
        } else {
          needRetry = true;
        }
      }
    } catch {
      // ignore
    }

    try {
      if (this.fillPrimitive) {
        if ((this.fillPrimitive as any).ready) {
          const attrs: any = (this.fillPrimitive as any).getGeometryInstanceAttributes(rec.parts.inner);
          if (attrs && attrs.color) {
            attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(fillColor);
          }
        } else {
          needRetry = true;
        }
      }
    } catch {
      // ignore
    }

    if (needRetry) {
      this.scheduleApplyColors(circleId);
    }

    try {
      this.viewer.scene.requestRender?.();
    } catch {
      // ignore
    }
  }
}
