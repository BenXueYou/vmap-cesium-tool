import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

export interface PolygonPrimitiveLayerCollections {
  fillCollection: Cesium.PrimitiveCollection;
  borderCollection: Cesium.PrimitiveCollection;
}

/**
 * 为 Polygon（多边形）Primitive 渲染维护一个稳定的有序图层栈。
 *
 * 渲染顺序：
 * - 所有填充图层（从下到上）
 * - 所有边框图层（从下到上）
 *
 * 这样可以确保在存在多个半透明填充重叠时，边框仍然清晰可见。
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

    // 先添加填充，再添加边框，以保证边框始终渲染在填充之上。
    this.viewer.scene.primitives.add(this.fillsRoot);
    this.viewer.scene.primitives.add(this.bordersRoot);
  }

  public getLayerCollections(layerKey: string): PolygonPrimitiveLayerCollections {
    const key = String(layerKey);
    const existing = this.layers.get(key);
    if (existing) return existing;

    const fillCollection = new Cesium.PrimitiveCollection();
    const borderCollection = new Cesium.PrimitiveCollection();

    // 图层顺序即这些子集合被插入的顺序。
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
      // 忽略异常
    }
    try {
      this.viewer.scene.primitives.remove(this.bordersRoot);
    } catch {
      // 忽略异常
    }

    this.layers.clear();
  }
}
