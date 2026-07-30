import { onBeforeUnmount, reactive, watch, type Ref } from "vue";
import * as Cesium from "cesium";
import type { MapPlugin, OverlayService } from "../../src/index";

interface BenchmarkSnapshot {
  scenarioId: string | null;
  scenarioLabel: string | null;
  overlayCount: number;
  entityCount: number;
  primitiveCount: number;
  fpsAverage: number | null;
  fpsSamples: number;
  hoverDecisionP95Ms: number | null;
  hoverSamples: number;
  pickResolutionP95Ms: number | null;
  pickSamples: number;
  lastResetAt: string | null;
  acceptanceStatus: "not-run" | "pending" | "pass" | "fail";
  acceptanceSummary: string;
}

interface BenchmarkScenarioDescriptor {
  id: "entity-12000" | "primitive-12000" | "mixed-12000";
  label: string;
  overlayCount: number;
  entityCount: number;
  primitiveCount: number;
}

interface BenchmarkOptions {
  onLog?: (scope: string, action: string, detail?: unknown) => void;
  onMessage?: (message: string, timeout?: number) => void;
  onScenarioVisibilityChange?: (active: boolean) => void;
}

const BENCHMARK_CAMERA = {
  longitude: 121.4768,
  latitude: 31.2276,
  height: 22000,
};

const GRID_COLS = 120;
const GRID_ROWS = 100;
const GRID_LON_STEP = 0.0016;
const GRID_LAT_STEP = 0.00115;
const CHUNK_SIZE = 300;
const MAX_SAMPLES = 400;
const MIN_ACCEPTANCE_SAMPLES = 30;

function computeP95(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return sorted[index] ?? null;
}

function computeAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function formatMetric(value: number | null, digits = 1): string {
  return value === null ? "-" : value.toFixed(digits);
}

function createGridPosition(index: number): [number, number] {
  const column = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  const lonOffset = (column - GRID_COLS / 2) * GRID_LON_STEP;
  const latOffset = (row - GRID_ROWS / 2) * GRID_LAT_STEP;

  return [
    BENCHMARK_CAMERA.longitude + lonOffset,
    BENCHMARK_CAMERA.latitude + latOffset,
  ];
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export function useOverlaySelectionBenchmark(
  mapPlugin: Ref<MapPlugin | null>,
  viewer: Ref<Cesium.Viewer | null>,
  options: BenchmarkOptions = {},
) {
  const snapshot = reactive<BenchmarkSnapshot>({
    scenarioId: null,
    scenarioLabel: null,
    overlayCount: 0,
    entityCount: 0,
    primitiveCount: 0,
    fpsAverage: null,
    fpsSamples: 0,
    hoverDecisionP95Ms: null,
    hoverSamples: 0,
    pickResolutionP95Ms: null,
    pickSamples: 0,
    lastResetAt: null,
    acceptanceStatus: "not-run",
    acceptanceSummary: "尚未生成 12,000 overlay 基准场景",
  });

  const managedOverlayIds = new Set<string>();
  const fpsSamples: number[] = [];
  const hoverSamples: number[] = [];
  const pickSamples: number[] = [];
  let instrumentedService: (OverlayService & Record<string, any>) | null = null;
  let originalPickOverlayEntity: ((...args: any[]) => any) | null = null;
  let originalUpdateHoverAtPosition: ((...args: any[]) => any) | null = null;
  let fpsRafId: number | null = null;
  let lastFrameAt: number | null = null;

  const pushLog = (action: string, detail?: unknown) => {
    options.onLog?.("overlay-selection-benchmark", action, detail);
  };

  const showMessage = (message: string, timeout = 1800) => {
    options.onMessage?.(message, timeout);
  };

  const ensureService = (): (OverlayService & Record<string, any>) | null => {
    if (!mapPlugin.value) {
      return null;
    }

    return mapPlugin.value.getOverlayService() as OverlayService & Record<string, any>;
  };

  const updateAcceptanceStatus = () => {
    snapshot.fpsAverage = computeAverage(fpsSamples);
    snapshot.fpsSamples = fpsSamples.length;
    snapshot.hoverDecisionP95Ms = computeP95(hoverSamples);
    snapshot.hoverSamples = hoverSamples.length;
    snapshot.pickResolutionP95Ms = computeP95(pickSamples);
    snapshot.pickSamples = pickSamples.length;

    if (!snapshot.scenarioId) {
      snapshot.acceptanceStatus = "not-run";
      snapshot.acceptanceSummary = "尚未生成 12,000 overlay 基准场景";
      return;
    }

    if (
      snapshot.fpsSamples < MIN_ACCEPTANCE_SAMPLES ||
      snapshot.hoverSamples < MIN_ACCEPTANCE_SAMPLES ||
      snapshot.pickSamples < MIN_ACCEPTANCE_SAMPLES
    ) {
      snapshot.acceptanceStatus = "pending";
      snapshot.acceptanceSummary =
        "样本量不足，请在场景稳定后移动鼠标采集更多 hover / pick 数据";
      return;
    }

    const fpsPassed = (snapshot.fpsAverage ?? 0) >= 30;
    const hoverPassed = (snapshot.hoverDecisionP95Ms ?? Number.POSITIVE_INFINITY) <= 100;
    const pickPassed = (snapshot.pickResolutionP95Ms ?? Number.POSITIVE_INFINITY) <= 16;

    snapshot.acceptanceStatus = fpsPassed && hoverPassed && pickPassed ? "pass" : "fail";
    snapshot.acceptanceSummary = [
      `FPS avg ${formatMetric(snapshot.fpsAverage)}`,
      `hover P95 ${formatMetric(snapshot.hoverDecisionP95Ms)}ms`,
      `pick P95 ${formatMetric(snapshot.pickResolutionP95Ms)}ms`,
    ].join(" | ");
  };

  const pushDuration = (buffer: number[], durationMs: number) => {
    buffer.push(durationMs);
    if (buffer.length > MAX_SAMPLES) {
      buffer.splice(0, buffer.length - MAX_SAMPLES);
    }
    updateAcceptanceStatus();
  };

  const resetMetrics = () => {
    fpsSamples.length = 0;
    hoverSamples.length = 0;
    pickSamples.length = 0;
    lastFrameAt = null;
    snapshot.lastResetAt = new Date().toISOString();
    updateAcceptanceStatus();
    pushLog("metrics:reset", { scenarioId: snapshot.scenarioId });
  };

  const stepFpsSampling = (timestamp: number) => {
    if (lastFrameAt !== null) {
      const deltaMs = timestamp - lastFrameAt;
      if (deltaMs > 0 && deltaMs < 1000) {
        pushDuration(fpsSamples, 1000 / deltaMs);
      }
    }

    lastFrameAt = timestamp;
    fpsRafId = requestAnimationFrame(stepFpsSampling);
  };

  const ensureFpsSampling = () => {
    if (fpsRafId !== null) {
      return;
    }

    fpsRafId = requestAnimationFrame(stepFpsSampling);
  };

  const stopFpsSampling = () => {
    if (fpsRafId !== null) {
      cancelAnimationFrame(fpsRafId);
      fpsRafId = null;
    }
    lastFrameAt = null;
  };

  const focusBenchmarkRegion = () => {
    if (!viewer.value) {
      return;
    }

    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        BENCHMARK_CAMERA.longitude,
        BENCHMARK_CAMERA.latitude,
        BENCHMARK_CAMERA.height,
      ),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-58),
        roll: 0,
      },
    });
  };

  const restoreInstrumentation = () => {
    if (!instrumentedService) {
      return;
    }

    const rawService = instrumentedService as any;

    if (originalPickOverlayEntity) {
      rawService.pickOverlayEntity = originalPickOverlayEntity;
    }
    if (originalUpdateHoverAtPosition) {
      rawService.updateHoverAtPosition = originalUpdateHoverAtPosition;
    }

    instrumentedService = null;
    originalPickOverlayEntity = null;
    originalUpdateHoverAtPosition = null;
  };

  const bindInstrumentation = (service: (OverlayService & Record<string, any>) | null) => {
    if (!service || instrumentedService === service) {
      return;
    }

    restoreInstrumentation();

    const rawService = service as any;

    originalPickOverlayEntity = rawService.pickOverlayEntity?.bind(service) ?? null;
    originalUpdateHoverAtPosition = rawService.updateHoverAtPosition?.bind(service) ?? null;

    if (originalPickOverlayEntity) {
      rawService.pickOverlayEntity = (...args: any[]) => {
        const start = performance.now();
        try {
          return originalPickOverlayEntity?.(...args);
        } finally {
          if (snapshot.scenarioId) {
            pushDuration(pickSamples, performance.now() - start);
          }
        }
      };
    }

    if (originalUpdateHoverAtPosition) {
      rawService.updateHoverAtPosition = (...args: any[]) => {
        const start = performance.now();
        try {
          return originalUpdateHoverAtPosition?.(...args);
        } finally {
          if (snapshot.scenarioId) {
            pushDuration(hoverSamples, performance.now() - start);
          }
        }
      };
    }

    instrumentedService = service;
  };

  const clearScenario = () => {
    const service = ensureService();
    if (service) {
      Array.from(managedOverlayIds).forEach((overlayId) => {
        service.removeOverlay(overlayId);
      });
    }

    managedOverlayIds.clear();
    snapshot.scenarioId = null;
    snapshot.scenarioLabel = null;
    snapshot.overlayCount = 0;
    snapshot.entityCount = 0;
    snapshot.primitiveCount = 0;
    updateAcceptanceStatus();
    options.onScenarioVisibilityChange?.(false);
    pushLog("scenario:clear");
  };

  const addManagedOverlay = (overlayId: string) => {
    managedOverlayIds.add(overlayId);
  };

  const finalizeScenario = (descriptor: BenchmarkScenarioDescriptor) => {
    snapshot.scenarioId = descriptor.id;
    snapshot.scenarioLabel = descriptor.label;
    snapshot.overlayCount = descriptor.overlayCount;
    snapshot.entityCount = descriptor.entityCount;
    snapshot.primitiveCount = descriptor.primitiveCount;
    options.onScenarioVisibilityChange?.(true);
    focusBenchmarkRegion();
    resetMetrics();
    showMessage(`${descriptor.label} 已生成，请移动鼠标开始采集性能样本`, 2400);
    pushLog("scenario:ready", descriptor);
  };

  const buildEntityScenario = async () => {
    const service = ensureService();
    if (!service) {
      return;
    }

    bindInstrumentation(service);
    clearScenario();

    const total = GRID_COLS * GRID_ROWS;
    for (let start = 0; start < total; start += CHUNK_SIZE) {
      const end = Math.min(total, start + CHUNK_SIZE);
      for (let index = start; index < end; index += 1) {
        const [longitude, latitude] = createGridPosition(index);
        const id = `selection-bench-entity-${index}`;
        service.addMarker({
          id,
          position: [longitude, latitude],
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString("#38bdf8"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          hoverHighlight: true,
          selectionHighlight: true,
          selectable: true,
          pickPriority: index % 5,
        });
        addManagedOverlay(id);
      }
      await nextFrame();
    }

    finalizeScenario({
      id: "entity-12000",
      label: "12,000 Entity markers",
      overlayCount: total,
      entityCount: total,
      primitiveCount: 0,
    });
  };

  const buildPrimitiveScenario = async () => {
    const service = ensureService();
    if (!service) {
      return;
    }

    bindInstrumentation(service);
    clearScenario();

    const total = GRID_COLS * GRID_ROWS;
    for (let start = 0; start < total; start += CHUNK_SIZE) {
      const end = Math.min(total, start + CHUNK_SIZE);
      for (let index = start; index < end; index += 1) {
        const [longitude, latitude] = createGridPosition(index);
        const id = `selection-bench-primitive-${index}`;
        const hue = index % 4;
        const fillColor = [
          Cesium.Color.fromCssColorString("#60a5fa"),
          Cesium.Color.fromCssColorString("#f97316"),
          Cesium.Color.fromCssColorString("#22c55e"),
          Cesium.Color.fromCssColorString("#a78bfa"),
        ][hue].withAlpha(0.26);

        service.addCircle({
          id,
          position: [longitude, latitude],
          radius: 42,
          material: fillColor,
          outline: true,
          outlineColor: fillColor.withAlpha(0.95),
          outlineWidth: 6,
          clampToGround: true,
          renderMode: "primitive",
          hoverHighlight: true,
          selectionHighlight: true,
          selectable: true,
          layerKey: "selection-bench-primitive",
          pickPriority: index % 3,
        });
        addManagedOverlay(id);
      }
      await nextFrame();
    }

    finalizeScenario({
      id: "primitive-12000",
      label: "12,000 primitive circles",
      overlayCount: total,
      entityCount: 0,
      primitiveCount: total,
    });
  };

  const buildMixedScenario = async () => {
    const service = ensureService();
    if (!service) {
      return;
    }

    bindInstrumentation(service);
    clearScenario();

    const total = GRID_COLS * GRID_ROWS;
    const entityTotal = total / 2;
    const primitiveTotal = total / 2;

    for (let start = 0; start < total; start += CHUNK_SIZE) {
      const end = Math.min(total, start + CHUNK_SIZE);
      for (let index = start; index < end; index += 1) {
        const [longitude, latitude] = createGridPosition(index);
        if (index % 2 === 0) {
          const id = `selection-bench-mixed-entity-${index}`;
          service.addMarker({
            id,
            position: [longitude, latitude],
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString("#f59e0b"),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
            hoverHighlight: true,
            selectionHighlight: true,
            selectable: true,
            pickPriority: 10,
          });
          addManagedOverlay(id);
        } else {
          const id = `selection-bench-mixed-primitive-${index}`;
          const fillColor = Cesium.Color.fromCssColorString("#22c55e").withAlpha(0.24);
          service.addCircle({
            id,
            position: [longitude, latitude],
            radius: 44,
            material: fillColor,
            outline: true,
            outlineColor: fillColor.withAlpha(0.95),
            outlineWidth: 6,
            clampToGround: true,
            renderMode: "primitive",
            hoverHighlight: true,
            selectionHighlight: true,
            selectable: true,
            layerKey: "selection-bench-mixed",
            pickPriority: 5,
          });
          addManagedOverlay(id);
        }
      }
      await nextFrame();
    }

    finalizeScenario({
      id: "mixed-12000",
      label: "6,000 entity + 6,000 primitive mixed",
      overlayCount: total,
      entityCount: entityTotal,
      primitiveCount: primitiveTotal,
    });
  };

  watch(
    mapPlugin,
    (nextMapPlugin, previousMapPlugin) => {
      const service = nextMapPlugin?.getOverlayService() as (OverlayService & Record<string, any>) | null;
      if (nextMapPlugin !== previousMapPlugin && snapshot.scenarioId) {
        managedOverlayIds.clear();
        snapshot.scenarioId = null;
        snapshot.scenarioLabel = null;
        snapshot.overlayCount = 0;
        snapshot.entityCount = 0;
        snapshot.primitiveCount = 0;
        options.onScenarioVisibilityChange?.(false);
        updateAcceptanceStatus();
      }
      bindInstrumentation(service);
      if (!nextMapPlugin) {
        restoreInstrumentation();
      }
    },
    { immediate: true },
  );

  ensureFpsSampling();
  updateAcceptanceStatus();

  onBeforeUnmount(() => {
    stopFpsSampling();
    restoreInstrumentation();
  });

  return {
    snapshot,
    resetMetrics,
    clearScenario,
    buildEntityScenario,
    buildPrimitiveScenario,
    buildMixedScenario,
  };
}
