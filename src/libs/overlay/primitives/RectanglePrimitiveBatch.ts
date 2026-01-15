import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';

export interface RectanglePrimitiveParts {
  outer: Entity; // ring entity proxy (pick id)
  inner: Entity; // fill entity proxy (pick id)
}

interface RectanglePrimitiveRecord {
  rectangleId: string;
  parts: RectanglePrimitiveParts;
  outerPositions: Cesium.Cartesian3[];
  innerPositions: Cesium.Cartesian3[];
  ringColor: Cesium.Color;
  fillColor: Cesium.Color;
  visible: boolean;
}

export class RectanglePrimitiveBatch {
  private viewer: Viewer;
  private collection: Cesium.PrimitiveCollection;

  private ringPrimitive: Cesium.GroundPrimitive | null = null;
  private fillPrimitive: Cesium.GroundPrimitive | null = null;

  private records: Map<string, RectanglePrimitiveRecord> = new Map();
  private rebuildScheduled = false;
  private colorApplyScheduled = false;
  private pendingColorApplyIds: Set<string> = new Set();

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.collection = new Cesium.PrimitiveCollection();
    this.viewer.scene.primitives.add(this.collection);
  }

  public destroy(): void {
    try {
      if (this.ringPrimitive) this.collection.remove(this.ringPrimitive);
      if (this.fillPrimitive) this.collection.remove(this.fillPrimitive);
      this.ringPrimitive = null;
      this.fillPrimitive = null;
    } catch {
      // ignore
    }

    try {
      this.viewer.scene.primitives.remove(this.collection);
    } catch {
      // ignore
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
    this.records.set(args.rectangleId, {
      rectangleId: args.rectangleId,
      parts: args.parts,
      outerPositions: args.outerPositions,
      innerPositions: args.innerPositions,
      ringColor: args.ringColor,
      fillColor: args.fillColor,
      visible: args.visible,
    });

    this.scheduleRebuild();
  }

  public remove(rectangleId: string): void {
    if (!this.records.has(rectangleId)) return;
    this.records.delete(rectangleId);
    this.pendingColorApplyIds.delete(rectangleId);
    this.scheduleRebuild();
  }

  public setVisible(rectangleId: string, visible: boolean): void {
    const rec = this.records.get(rectangleId);
    if (!rec) return;
    rec.visible = visible;
    this.applyCurrentColors(rectangleId);
  }

  public setColors(rectangleId: string, ringColor: Cesium.Color, fillColor: Cesium.Color): void {
    const rec = this.records.get(rectangleId);
    if (!rec) return;
    rec.ringColor = ringColor;
    rec.fillColor = fillColor;
    this.applyCurrentColors(rectangleId);
  }

  private scheduleApplyColors(rectangleId: string): void {
    this.pendingColorApplyIds.add(rectangleId);
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
      try { this.collection.remove(this.ringPrimitive); } catch {}
      this.ringPrimitive = null;
    }
    if (this.fillPrimitive) {
      try { this.collection.remove(this.fillPrimitive); } catch {}
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
          id: rec.parts.outer,
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
          id: rec.parts.inner,
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(fillColor),
          },
        })
      );
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
      this.collection.add(this.ringPrimitive);
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
      this.collection.add(this.fillPrimitive);
    }

    for (const rec of this.records.values()) {
      this.applyCurrentColors(rec.rectangleId);
    }

    try {
      this.viewer.scene.requestRender?.();
    } catch {
      // ignore
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
      this.scheduleApplyColors(rectangleId);
    }

    try {
      this.viewer.scene.requestRender?.();
    } catch {
      // ignore
    }
  }
}
