import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

export interface CirclePrimitiveLayerCollections {
  fillCollection: Cesium.PrimitiveCollection;
  ringCollection: Cesium.PrimitiveCollection;
}

export class CirclePrimitiveLayerStack {
  private viewer: Viewer;
  private fillsRoot: Cesium.PrimitiveCollection;
  private ringsRoot: Cesium.PrimitiveCollection;
  private layers: Map<string, CirclePrimitiveLayerCollections> = new Map();

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.fillsRoot = new Cesium.PrimitiveCollection();
    this.ringsRoot = new Cesium.PrimitiveCollection();
    this.viewer.scene.primitives.add(this.fillsRoot);
    this.viewer.scene.primitives.add(this.ringsRoot);
  }

  public getLayerCollections(layerKey: string): CirclePrimitiveLayerCollections {
    const key = String(layerKey);
    const existing = this.layers.get(key);
    if (existing) return existing;

    const fillCollection = new Cesium.PrimitiveCollection();
    const ringCollection = new Cesium.PrimitiveCollection();
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
