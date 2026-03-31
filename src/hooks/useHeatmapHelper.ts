import { ref, shallowRef, markRaw, onBeforeUnmount, type Ref } from "vue";
import * as Cesium from "cesium";
import CesiumHeatmapLayer, {
  type HeatPoint,
  type HeatmapOptions,
  type HeatmapGradient,
  type HeatmapAutoUpdateOptions,
} from "../libs/CesiumHeatmapLayer";

/**
 * 热力图相关的辅助逻辑
 */
export function useHeatmapHelper(viewer: Ref<Cesium.Viewer | undefined>) {
  const heatmapLayer = shallowRef<CesiumHeatmapLayer | null>(null);
  const visible = ref(true);

  const initHeatmap = (options?: HeatmapOptions) => {
    if (!viewer.value) return;
    if (!heatmapLayer.value) {
      heatmapLayer.value = markRaw(new CesiumHeatmapLayer(viewer.value, options ?? {}));
      heatmapLayer.value.setVisible(visible.value);
    }
  };

  const updateHeatmapData = (points: HeatPoint[]) => {
    if (!heatmapLayer.value) return;
    heatmapLayer.value.setData(points);
  };

  const setHeatmapVisible = (v: boolean) => {
    visible.value = v;
    if (heatmapLayer.value) {
      heatmapLayer.value.setVisible(v);
    }
  };

  const setHeatmapOpacity = (alpha: number) => {
    if (!heatmapLayer.value) return;
    heatmapLayer.value.setOpacity(alpha);
  };

  const setHeatmapGradient = (gradient: HeatmapGradient) => {
    if (!heatmapLayer.value) return;
    heatmapLayer.value.setGradient(gradient);
  };

  const setHeatmapAutoUpdate = (options?: HeatmapAutoUpdateOptions) => {
    if (!heatmapLayer.value) return;
    heatmapLayer.value.setAutoUpdate(options ?? { enabled: true });
  };

  const stopHeatmapAutoUpdate = () => {
    if (!heatmapLayer.value) return;
    heatmapLayer.value.stopAutoUpdate();
  };

  const destroyHeatmap = () => {
    if (heatmapLayer.value) {
      heatmapLayer.value.destroy();
      heatmapLayer.value = null;
    }
  };

  onBeforeUnmount(() => {
    destroyHeatmap();
  });

  return {
    heatmapLayer,
    visible,
    initHeatmap,
    updateHeatmapData,
    setHeatmapVisible,
    setHeatmapOpacity,
    setHeatmapGradient,
    setHeatmapAutoUpdate,
    stopHeatmapAutoUpdate,
    destroyHeatmap,
  };
}
