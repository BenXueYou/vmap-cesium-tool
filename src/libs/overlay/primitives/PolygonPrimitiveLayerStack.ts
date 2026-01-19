import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

export interface PolygonPrimitiveLayerCollections {
  fillCollection: Cesium.PrimitiveCollection;
  borderCollection: Cesium.PrimitiveCollection;
}

/**
 * Maintains a stable, ordered layer stack for Polygon primitive rendering.
 *
 * Rendering order:
 * - all fill layers (bottom -> top)
 * - all border layers (bottom -> top)
 *
 * This ensures borders remain visible even when multiple translucent fills overlap.
 */
export class PolygonPrimitiveLayerStack {
  private viewer: Viewer;

  private fillsRoot: Cesium.PrimitiveCollection;
  private bordersRoot: Cesium.PrimitiveCollection;

  private layers: Map<string, PolygonPrimitiveLayerCollections> = new Map();

  constructor(viewer: Viewer) {
    this.viewer = viewer;

    this.fillsRoot = new Cesium.PrimitiveCollection();
    this.bordersRoot = new Cesium.PrimitiveCollection();

    // Add fills first, borders second so borders always render above fills.
    this.viewer.scene.primitives.add(this.fillsRoot);
    this.viewer.scene.primitives.add(this.bordersRoot);
  }

  public getLayerCollections(layerKey: string): PolygonPrimitiveLayerCollections {
    const key = String(layerKey);
    const existing = this.layers.get(key);
    if (existing) return existing;

    const fillCollection = new Cesium.PrimitiveCollection();
    const borderCollection = new Cesium.PrimitiveCollection();

    // Layer ordering is the insertion order of these sub-collections.
    this.fillsRoot.add(fillCollection);
    this.bordersRoot.add(borderCollection);

    const created = { fillCollection, borderCollection };
    this.layers.set(key, created);
    return created;
  }

  public destroy(): void {
    try {
      this.viewer.scene.primitives.remove(this.fillsRoot);
    } catch {
      // ignore
    }
    try {
      this.viewer.scene.primitives.remove(this.bordersRoot);
    } catch {
      // ignore
    }

    this.layers.clear();
  }
}
