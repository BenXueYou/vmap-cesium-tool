import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

export interface PolygonPrimitiveLayerCollections {
  fillCollection: Cesium.PrimitiveCollection;
  borderCollection: Cesium.PrimitiveCollection;
}

export class PolygonPrimitiveLayerStack {
  private readonly fillsRoot: Cesium.PrimitiveCollection;
  private readonly bordersRoot: Cesium.PrimitiveCollection;
  private readonly layers = new Map<string, PolygonPrimitiveLayerCollections>();

  constructor(private readonly viewer: Viewer) {
    this.fillsRoot = new Cesium.PrimitiveCollection();
    this.bordersRoot = new Cesium.PrimitiveCollection();
    this.viewer.scene.primitives.add(this.fillsRoot);
    this.viewer.scene.primitives.add(this.bordersRoot);
  }

  public getLayerCollections(layerKey: string): PolygonPrimitiveLayerCollections {
    const key = String(layerKey);
    const existing = this.layers.get(key);
    if (existing) {
      return existing;
    }

    const fillCollection = new Cesium.PrimitiveCollection();
    const borderCollection = new Cesium.PrimitiveCollection();
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
