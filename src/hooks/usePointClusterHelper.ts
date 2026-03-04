import { ref, onBeforeUnmount, type Ref } from 'vue';
import * as Cesium from 'cesium';
import CesiumPointClusterLayer, {
  type ClusterPoint,
  type PointClusterLayerOptions,
} from '../libs/CesiumPointClusterLayer';

/**
 * 点聚类图层相关的辅助逻辑（Vue3 composition API）
 */
export function usePointClusterHelper(viewer: Ref<Cesium.Viewer | undefined>) {
  const clusterLayer = ref<CesiumPointClusterLayer | null>(null);
  const visible = ref(true);

  const initCluster = (options?: PointClusterLayerOptions) => {
    if (!viewer.value) return;
    if (!clusterLayer.value) {
      clusterLayer.value = new CesiumPointClusterLayer(viewer.value, options ?? {});
      clusterLayer.value.setVisible(visible.value);
    }
  };

  const updateClusterData = (points: ClusterPoint[]) => {
    if (!clusterLayer.value) return;
    clusterLayer.value.setData(points);
  };

  const setClusterVisible = (v: boolean) => {
    visible.value = v;
    if (clusterLayer.value) {
      clusterLayer.value.setVisible(v);
    }
  };

  const destroyCluster = () => {
    if (clusterLayer.value) {
      clusterLayer.value.destroy();
      clusterLayer.value = null;
    }
  };

  onBeforeUnmount(() => {
    destroyCluster();
  });

  return {
    clusterLayer,
    visible,
    initCluster,
    updateClusterData,
    setClusterVisible,
    destroyCluster,
  };
}
