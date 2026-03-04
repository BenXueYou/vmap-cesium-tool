import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';

export interface CirclePrimitiveLayerCollections {
  fillCollection: Cesium.PrimitiveCollection;
  ringCollection: Cesium.PrimitiveCollection;
}

/**
 * 为 Circle（圆）Primitive 渲染维护一个稳定的有序图层栈。
 *
 * 渲染顺序：
 * - 所有填充图层（从下到上）
 * - 所有外环图层（从下到上）
 *
 * 这样可以确保在存在多个半透明填充重叠时，外环边界仍然清晰可见。
 */
export class CirclePrimitiveLayerStack {
  private viewer: Viewer;

  private fillsRoot: Cesium.PrimitiveCollection;
  private ringsRoot: Cesium.PrimitiveCollection;

  private layers: Map<string, CirclePrimitiveLayerCollections> = new Map();

  constructor(viewer: Viewer) {
    this.viewer = viewer;

    this.fillsRoot = new Cesium.PrimitiveCollection();
    this.ringsRoot = new Cesium.PrimitiveCollection();

    // 先添加填充，再添加外环，以保证外环始终渲染在填充之上。
    this.viewer.scene.primitives.add(this.fillsRoot);
    this.viewer.scene.primitives.add(this.ringsRoot);
  }

  public getLayerCollections(layerKey: string): CirclePrimitiveLayerCollections {
    const key = String(layerKey);
    const existing = this.layers.get(key);
    if (existing) return existing;

    const fillCollection = new Cesium.PrimitiveCollection();
    const ringCollection = new Cesium.PrimitiveCollection();

    // 图层顺序即这些子集合被插入的顺序。
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
      // 忽略异常
    }
    try {
      this.viewer.scene.primitives.remove(this.ringsRoot);
    } catch {
      // 忽略异常
    }

    this.layers.clear();
  }
}
