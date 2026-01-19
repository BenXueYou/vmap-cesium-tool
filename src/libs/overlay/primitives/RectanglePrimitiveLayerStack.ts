import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

export interface RectanglePrimitiveLayerCollections {
  fillCollection: Cesium.PrimitiveCollection;
  ringCollection: Cesium.PrimitiveCollection;
}

/**
 * Maintains a stable, ordered layer stack for Rectangle primitive rendering.
 *
 * Rendering order:
 * - all fill layers (bottom -> top)
 * - all ring layers (bottom -> top)
 *
 * This ensures rings remain visible even when multiple translucent fills overlap.
 */
export class RectanglePrimitiveLayerStack {
  private viewer: Viewer;

  private fillsRoot: Cesium.PrimitiveCollection;
  private ringsRoot: Cesium.PrimitiveCollection;

  private layers: Map<string, RectanglePrimitiveLayerCollections> = new Map();

  constructor(viewer: Viewer) {
    this.viewer = viewer;

    this.fillsRoot = new Cesium.PrimitiveCollection();
    this.ringsRoot = new Cesium.PrimitiveCollection();

    // Add fills first, rings second so rings always render above fills.
    this.viewer.scene.primitives.add(this.fillsRoot);
    this.viewer.scene.primitives.add(this.ringsRoot);
  }

  public getLayerCollections(layerKey: string): RectanglePrimitiveLayerCollections {
    const key = String(layerKey);
    const existing = this.layers.get(key);
    if (existing) return existing;

    const fillCollection = new Cesium.PrimitiveCollection();
    const ringCollection = new Cesium.PrimitiveCollection();

    // Layer ordering is the insertion order of these sub-collections.
    this.fillsRoot.add(fillCollection);
    this.ringsRoot.add(ringCollection);

    const created = { fillCollection, ringCollection };
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
      this.viewer.scene.primitives.remove(this.ringsRoot);
    } catch {
      // ignore
    }

    this.layers.clear();
  }
}
