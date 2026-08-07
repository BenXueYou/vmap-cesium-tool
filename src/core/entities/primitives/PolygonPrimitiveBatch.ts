import * as Cesium from 'cesium';
import type { Viewer, Entity } from 'cesium';

export interface PolygonPrimitiveParts {
  fill: Entity;
  border: Entity;
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
  private readonly fillCollection: Cesium.PrimitiveCollection;
  private readonly borderCollection: Cesium.PrimitiveCollection;
  private readonly ownsCollections: boolean;
  private ownedRootCollection: Cesium.PrimitiveCollection | null = null;
  private destroyed = false;

  private fillPrimitive: Cesium.GroundPrimitive | null = null;
  private borderPrimitive: Cesium.GroundPolylinePrimitive | null = null;

  private readonly records = new Map<string, PolygonPrimitiveRecord>();
  private rebuildScheduled = false;
  private colorApplyScheduled = false;
  private readonly pendingColorApplyIds = new Set<string>();

  constructor(
    private readonly viewer: Viewer,
    options?: {
      fillCollection?: Cesium.PrimitiveCollection;
      borderCollection?: Cesium.PrimitiveCollection;
    },
  ) {
    const fillCollection = options?.fillCollection;
    const borderCollection = options?.borderCollection;

    if (fillCollection || borderCollection) {
      this.fillCollection = (fillCollection ?? borderCollection) as Cesium.PrimitiveCollection;
      this.borderCollection = (borderCollection ?? fillCollection) as Cesium.PrimitiveCollection;
      this.ownsCollections = false;
    } else {
      const root = new Cesium.PrimitiveCollection();
      this.ownedRootCollection = root;
      this.fillCollection = root;
      this.borderCollection = root;
      this.ownsCollections = true;
      this.getScene()?.primitives.add(root);
    }
  }

  private getScene(): Cesium.Scene | null {
    if (this.destroyed) return null;
    try {
      return this.viewer.scene;
    } catch {
      return null;
    }
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
    if (this.destroyed) return;
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
    if (this.destroyed) return;
    if (!this.records.has(polygonId)) return;
    this.records.delete(polygonId);
    this.pendingColorApplyIds.delete(polygonId);
    this.scheduleRebuild();
  }

  public setVisible(polygonId: string, visible: boolean): void {
    if (this.destroyed) return;
    const record = this.records.get(polygonId);
    if (!record) return;
    record.visible = visible;
    this.applyCurrentColors(polygonId);
  }

  public setColors(polygonId: string, borderColor: Cesium.Color, fillColor: Cesium.Color): void {
    if (this.destroyed) return;
    const record = this.records.get(polygonId);
    if (!record) return;
    record.borderColor = borderColor;
    record.fillColor = fillColor;
    this.applyCurrentColors(polygonId);
  }

  public setBorderWidth(polygonId: string, borderWidth: number): void {
    if (this.destroyed) return;
    const record = this.records.get(polygonId);
    if (!record) return;
    record.borderWidth = Math.max(1, Number(borderWidth) || 1);
    this.scheduleRebuild();
  }

  public destroy(): void {
    this.destroyed = true;
    try {
      if (this.fillPrimitive) this.fillCollection.remove(this.fillPrimitive);
      if (this.borderPrimitive) this.borderCollection.remove(this.borderPrimitive);
    } catch {
      // ignore
    }

    this.fillPrimitive = null;
    this.borderPrimitive = null;

    if (this.ownsCollections && this.ownedRootCollection) {
      try {
        this.getScene()?.primitives.remove(this.ownedRootCollection);
      } catch {
        // ignore
      }
      this.ownedRootCollection = null;
    }

    this.records.clear();
  }

  private scheduleApplyColors(polygonId: string): void {
    if (this.destroyed) return;
    this.pendingColorApplyIds.add(polygonId);
    if (this.colorApplyScheduled) return;
    this.colorApplyScheduled = true;

    const raf = (globalThis as any).requestAnimationFrame as ((cb: FrameRequestCallback) => number) | undefined;
    const tick = () => {
      if (this.destroyed) return;
      this.colorApplyScheduled = false;
      const ids = Array.from(this.pendingColorApplyIds);
      this.pendingColorApplyIds.clear();
      ids.forEach((id) => this.applyCurrentColors(id));
    };

    if (typeof raf === 'function') {
      raf(tick);
      return;
    }
    setTimeout(tick, 0);
  }

  private scheduleRebuild(): void {
    if (this.destroyed) return;
    if (this.rebuildScheduled) return;
    this.rebuildScheduled = true;

    const raf = (globalThis as any).requestAnimationFrame as ((cb: FrameRequestCallback) => number) | undefined;
    const tick = () => {
      if (this.destroyed) return;
      this.rebuildScheduled = false;
      this.rebuild();
    };

    if (typeof raf === 'function') {
      raf(tick);
      return;
    }
    setTimeout(tick, 0);
  }

  private assertCloneableInstanceId(id: unknown, owner: string): string | number {
    if (typeof id === 'string' || typeof id === 'number') return id;
    throw new Error(`[PolygonPrimitiveBatch] GeometryInstance.id must be cloneable. owner=${owner}`);
  }

  private rebuild(): void {
    if (this.destroyed) return;
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

    for (const record of this.records.values()) {
      const fillColor = new Cesium.Color(
        record.fillColor.red,
        record.fillColor.green,
        record.fillColor.blue,
        record.visible ? record.fillColor.alpha : 0,
      );
      const borderColor = new Cesium.Color(
        record.borderColor.red,
        record.borderColor.green,
        record.borderColor.blue,
        record.visible ? record.borderColor.alpha : 0,
      );

      let fillId: string | number;
      let borderId: string | number;
      try {
        fillId = this.assertCloneableInstanceId(record.instanceIds.fill, `${record.polygonId}:fill`);
        borderId = this.assertCloneableInstanceId(record.instanceIds.border, `${record.polygonId}:border`);
      } catch (error) {
        console.error(error);
        continue;
      }

      fillInstances.push(new Cesium.GeometryInstance({
        geometry: new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(record.fillPositions),
          vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        }),
        id: fillId,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(fillColor),
        },
      }));

      borderInstances.push(new Cesium.GeometryInstance({
        geometry: new Cesium.GroundPolylineGeometry({
          positions: record.borderPositions,
          width: record.borderWidth,
        }),
        id: borderId,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(borderColor),
        },
      }));
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

    this.records.forEach((record) => this.applyCurrentColors(record.polygonId));
    this.getScene()?.requestRender?.();
  }

  private applyCurrentColors(polygonId: string): void {
    if (this.destroyed) return;
    const record = this.records.get(polygonId);
    if (!record) return;

    const fillColor = new Cesium.Color(
      record.fillColor.red,
      record.fillColor.green,
      record.fillColor.blue,
      record.visible ? record.fillColor.alpha : 0,
    );
    const borderColor = new Cesium.Color(
      record.borderColor.red,
      record.borderColor.green,
      record.borderColor.blue,
      record.visible ? record.borderColor.alpha : 0,
    );

    let needRetry = false;

    try {
      if (this.fillPrimitive) {
        if ((this.fillPrimitive as any).ready) {
          const attrs: any = (this.fillPrimitive as any).getGeometryInstanceAttributes(record.instanceIds.fill);
          if (attrs?.color) {
            attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(fillColor);
          }
        } else {
          needRetry = true;
        }
      }
    } catch {
      // ignore
    }

    try {
      if (this.borderPrimitive) {
        if ((this.borderPrimitive as any).ready) {
          const attrs: any = (this.borderPrimitive as any).getGeometryInstanceAttributes(record.instanceIds.border);
          if (attrs?.color) {
            attrs.color = Cesium.ColorGeometryInstanceAttribute.toValue(borderColor);
          }
        } else {
          needRetry = true;
        }
      }
    } catch {
      // ignore
    }

    if (needRetry) {
      this.scheduleApplyColors(polygonId);
    }

    this.getScene()?.requestRender?.();
  }
}
