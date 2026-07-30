<template>
  <div class="app-shell">
    <div id="cesiumContainer" class="map-host"></div>

    <aside class="workbench">
      <div class="panel-header">
        <div>
          <div class="eyebrow">Playground</div>
          <h1 class="panel-title">API 调试台</h1>
        </div>

        <label class="compact-field">
          <span>语言</span>
          <select :value="locale" @change="onLocaleSelect">
            <option value="zh-CN">中文</option>
            <option value="en-US">English</option>
          </select>
        </label>
      </div>

      <div class="tab-row">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-button"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="status-strip">
        <span>Toolbar {{ toolbarReady ? "Ready" : "Missing" }}</span>
        <span>Overlay {{ overlayReady ? "Ready" : "Missing" }}</span>
        <span>{{ overlayCount }} overlays</span>
      </div>

      <template v-if="activeTab === 'toolbar'">
        <section class="section-block">
          <div class="section-title">初始化配置</div>

          <div class="field-grid">
            <label>
              <span>地图厂商</span>
              <select v-model="toolbarForm.mapProvider">
                <option value="tdt">天地图</option>
                <option value="tencent">腾讯地图</option>
                <option value="gaode">高德地图</option>
                <option value="baidu">百度地图</option>
              </select>
            </label>

            <label>
              <span>位置</span>
              <select v-model="toolbarForm.position">
                <option value="top-left">top-left</option>
                <option value="top-right">top-right</option>
                <option value="bottom-left">bottom-left</option>
                <option value="bottom-right">bottom-right</option>
              </select>
            </label>

            <label>
              <span>方向</span>
              <select v-model="toolbarForm.direction">
                <option value="column">column</option>
                <option value="row">row</option>
              </select>
            </label>

            <label>
              <span>按钮尺寸</span>
              <input v-model.number="toolbarForm.buttonSize" type="number" min="24" max="64" step="1" />
            </label>

            <label>
              <span>按钮间距</span>
              <input v-model.number="toolbarForm.buttonSpacing" type="number" min="0" max="24" step="1" />
            </label>

            <label>
              <span>zIndex</span>
              <input v-model.number="toolbarForm.zIndex" type="number" min="1" max="9999" step="1" />
            </label>

            <label>
              <span>搜索宽度</span>
              <input v-model.number="toolbarForm.searchWidth" type="number" min="160" max="420" step="10" />
            </label>

            <label>
              <span>工具栏背景</span>
              <input v-model="toolbarForm.backgroundColor" type="text" />
            </label>

            <label>
              <span>按钮背景</span>
              <input v-model="toolbarForm.buttonBackgroundColor" type="text" />
            </label>

            <label>
              <span>按钮边框</span>
              <input v-model="toolbarForm.buttonBorderColor" type="text" />
            </label>

            <label>
              <span>搜索面板背景</span>
              <input v-model="toolbarForm.searchPanelBackground" type="text" />
            </label>
          </div>

          <div class="toggle-grid">
            <label class="toggle-item">
              <input v-model="toolbarForm.defaultPlaceNameChecked" type="checkbox" />
              <span>默认显示注记</span>
            </label>

            <label class="toggle-item">
              <input v-model="toolbarForm.defaultNoFlyZoneChecked" type="checkbox" />
              <span>默认显示禁飞区</span>
            </label>
          </div>
        </section>

        <section class="section-block">
          <div class="section-title">按钮装配</div>

          <div class="toggle-grid">
            <label v-for="button in toolbarButtonConfigs" :key="button.id" class="toggle-item">
              <input v-model="toolbarButtonState[button.id]" type="checkbox" />
              <span>{{ button.id }}</span>
            </label>
          </div>

          <div class="action-row">
            <button class="primary" @click="rebuildToolbarPlayground">重建并应用</button>
            <button @click="applyToolbarRuntimeStyle">仅更新样式</button>
            <button @click="closeToolbarMenus">关闭菜单</button>
          </div>
        </section>

        <section class="section-block">
          <div class="section-title">运行时按钮 API</div>

          <div class="field-grid">
            <label>
              <span>目标按钮</span>
              <select v-model="selectedToolbarButtonId">
                <option v-for="buttonId in toolbarButtonOptions" :key="buttonId" :value="buttonId">
                  {{ buttonId }}
                </option>
              </select>
            </label>

            <label>
              <span>运行时标题</span>
              <input v-model="toolbarRuntimePatch.title" type="text" placeholder="可选" />
            </label>

            <label>
              <span>运行时背景</span>
              <input v-model="toolbarRuntimePatch.backgroundColor" type="text" placeholder="可选" />
            </label>

            <label>
              <span>运行时文字色</span>
              <input v-model="toolbarRuntimePatch.color" type="text" placeholder="可选" />
            </label>
          </div>

          <div class="action-row">
            <button @click="showToolbarButton">show</button>
            <button @click="hideToolbarButton">hide</button>
            <button @click="enableToolbarButton">enable</button>
            <button @click="disableToolbarButton">disable</button>
            <button @click="patchToolbarButton">updateButton</button>
          </div>
        </section>

        <section class="section-block">
          <div class="section-title">自定义按钮 API</div>

          <div class="field-grid">
            <label>
              <span>id</span>
              <input v-model="customToolbarButton.id" type="text" />
            </label>

            <label>
              <span>标题</span>
              <input v-model="customToolbarButton.title" type="text" />
            </label>

            <label>
              <span>图标文本</span>
              <input v-model="customToolbarButton.icon" type="text" />
            </label>

            <label>
              <span>背景</span>
              <input v-model="customToolbarButton.backgroundColor" type="text" />
            </label>
          </div>

          <div class="action-row">
            <button class="primary" @click="mountCustomToolbarButton">addCustomButton</button>
            <button @click="removeCustomToolbarButton">removeButton</button>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="section-block">
          <div class="section-title">Overlay 初始化与运行配置</div>

          <div class="field-grid">
            <label>
              <span>点击节流(ms)</span>
              <input v-model.number="overlayForm.clickPickMinIntervalMs" type="number" min="0" max="1000" step="10" />
            </label>

            <label>
              <span>pickWidth</span>
              <input v-model.number="overlayForm.pickWidth" type="number" min="1" max="9" step="1" />
            </label>

            <label>
              <span>pickHeight</span>
              <input v-model.number="overlayForm.pickHeight" type="number" min="1" max="9" step="1" />
            </label>

            <label>
              <span>drillLimit</span>
              <input v-model.number="overlayForm.drillLimit" type="number" min="1" max="32" step="1" />
            </label>

            <label>
              <span>高亮原因</span>
              <select v-model="overlayForm.highlightReason">
                <option value="click">click</option>
                <option value="hover">hover</option>
              </select>
            </label>
          </div>

          <div class="toggle-grid">
            <label class="toggle-item">
              <input v-model="overlayForm.hoverEnabled" type="checkbox" />
              <span>启用 hover handler</span>
            </label>
          </div>

          <div class="action-row">
            <button class="primary" @click="rebuildOverlayPlayground">重建并应用</button>
            <button @click="applyOverlayHoverMode">setHoverEnabled</button>
            <button @click="syncOverlayInventory">刷新列表</button>
          </div>
        </section>

        <section class="section-block">
          <div class="section-title">创建覆盖物</div>

          <div class="field-grid">
            <label>
              <span>Marker 文本</span>
              <input v-model="overlayForm.markerLabel" type="text" />
            </label>

            <label>
              <span>Circle 半径(m)</span>
              <input v-model.number="overlayForm.circleRadius" type="number" min="10" max="10000" step="10" />
            </label>

            <label>
              <span>Rectangle 宽度(度)</span>
              <input v-model.number="overlayForm.rectangleWidth" type="number" min="0.001" max="0.2" step="0.001" />
            </label>

            <label>
              <span>Rectangle 高度(度)</span>
              <input v-model.number="overlayForm.rectangleHeight" type="number" min="0.001" max="0.2" step="0.001" />
            </label>

            <label>
              <span>InfoWindow 标题</span>
              <input v-model="overlayForm.infoTitle" type="text" />
            </label>

            <label>
              <span>InfoWindow 内容</span>
              <input v-model="overlayForm.infoBody" type="text" />
            </label>
          </div>

          <div class="action-row wrap">
            <button class="primary" @click="addMarkerOverlay">addMarker</button>
            <button @click="addCircleOverlay">addCircle</button>
            <button @click="addRectangleOverlay">addRectangle</button>
            <button @click="addPolylineOverlay">addPolyline</button>
            <button @click="addPolygonOverlay">addPolygon</button>
            <button @click="addInfoWindowOverlay">addInfoWindow</button>
            <button @click="addRingOverlay">addRing</button>
          </div>
        </section>

        <section class="section-block">
          <div class="section-title">覆盖物运行时 API</div>

          <div class="field-grid">
            <label class="span-2">
              <span>目标覆盖物</span>
              <select v-model="selectedOverlayId">
                <option value="">请选择</option>
                <option v-for="item in overlayItems" :key="item.id" :value="item.id">
                  {{ item.id }} | {{ item.kind }} | {{ item.visible ? "visible" : "hidden" }}
                </option>
              </select>
            </label>
          </div>

          <div class="action-row wrap">
            <button @click="toggleSelectedOverlayVisibility">setOverlayVisible</button>
            <button @click="highlightSelectedOverlay">setOverlayHighlight</button>
            <button @click="clearSelectedOverlayHighlight">clearHighlight</button>
            <button @click="toggleSelectedOverlayHighlight">toggleHighlight</button>
            <button @click="startSelectedOverlayEdit">startOverlayEdit</button>
            <button @click="stopOverlayEdit">stopOverlayEdit</button>
            <button @click="removeSelectedOverlay">removeOverlay</button>
            <button @click="removeAllOverlays">removeAllOverlays</button>
          </div>
        </section>

        <details class="section-block validation-block">
          <summary class="section-title collapsible-title">Overlay Selection 验证</summary>

          <div class="action-row wrap validation-actions">
            <button class="primary" @click="addOverlaySelectionBaseObjects">添加基础验证对象</button>
            <button @click="addOverlaySelectionOverlapObjects">添加重叠验证对象</button>
            <button @click="clearOverlaySelectionObjects">清空对象</button>
            <button @click="clearOverlaySelectionState">清空选中</button>
            <button @click="selectOverlaySelectionBaseMarker">程序化选中基础 Marker</button>
          </div>

          <div class="validation-state">
            <div class="validation-state-item">
              <span>Current</span>
              <strong>{{ selectionValidationSnapshot.current ?? "-" }}</strong>
            </div>
            <div class="validation-state-item">
              <span>Previous</span>
              <strong>{{ selectionValidationSnapshot.previous ?? "-" }}</strong>
            </div>
            <div class="validation-state-item">
              <span>Reason</span>
              <strong>{{ selectionValidationSnapshot.reason ?? "-" }}</strong>
            </div>
            <div class="validation-state-item">
              <span>Last Click Callback</span>
              <strong>{{ selectionValidationSnapshot.lastClickCallback ?? "-" }}</strong>
            </div>
          </div>
        </details>

        <details class="section-block validation-block">
          <summary class="section-title collapsible-title">12,000 Overlay Benchmark</summary>

          <div class="action-row wrap validation-actions">
            <button class="primary" @click="buildOverlaySelectionEntityBenchmark">生成 12,000 Entity</button>
            <button @click="buildOverlaySelectionPrimitiveBenchmark">生成 12,000 Primitive</button>
            <button @click="buildOverlaySelectionMixedBenchmark">生成 6,000 / 6,000 Mixed</button>
            <button @click="clearOverlaySelectionBenchmarkScenario">清空基准场景</button>
            <button @click="resetOverlaySelectionBenchmarkMetrics">重置指标</button>
          </div>

          <div class="validation-state">
            <div class="validation-state-item">
              <span>Scenario</span>
              <strong>{{ selectionBenchmarkSnapshot.scenarioLabel ?? "-" }}</strong>
            </div>
            <div class="validation-state-item">
              <span>Overlay Count</span>
              <strong>{{ selectionBenchmarkSnapshot.overlayCount }}</strong>
            </div>
            <div class="validation-state-item">
              <span>Entity / Primitive</span>
              <strong>
                {{ selectionBenchmarkSnapshot.entityCount }} / {{ selectionBenchmarkSnapshot.primitiveCount }}
              </strong>
            </div>
            <div class="validation-state-item">
              <span>Acceptance</span>
              <strong>{{ selectionBenchmarkSnapshot.acceptanceStatus }}</strong>
            </div>
            <div class="validation-state-item">
              <span>FPS Avg</span>
              <strong>
                {{ selectionBenchmarkSnapshot.fpsAverage === null ? "-" : `${selectionBenchmarkSnapshot.fpsAverage.toFixed(1)} fps` }}
              </strong>
            </div>
            <div class="validation-state-item">
              <span>Hover P95</span>
              <strong>
                {{
                  selectionBenchmarkSnapshot.hoverDecisionP95Ms === null
                    ? "-"
                    : `${selectionBenchmarkSnapshot.hoverDecisionP95Ms.toFixed(1)} ms`
                }}
              </strong>
            </div>
            <div class="validation-state-item">
              <span>Pick P95</span>
              <strong>
                {{
                  selectionBenchmarkSnapshot.pickResolutionP95Ms === null
                    ? "-"
                    : `${selectionBenchmarkSnapshot.pickResolutionP95Ms.toFixed(1)} ms`
                }}
              </strong>
            </div>
            <div class="validation-state-item">
              <span>Summary</span>
              <strong>{{ selectionBenchmarkSnapshot.acceptanceSummary }}</strong>
            </div>
          </div>

          <p class="validation-note">
            生成场景后保持镜头不动并移动鼠标，面板会持续采集 FPS、hover 决议耗时和 pick+resolution 主线程耗时。
            为避免左侧列表渲染 12,000 行，inventory 面板不会自动同步这类基准对象。
          </p>
        </details>

        <section class="section-block inventory-block">
          <div class="section-title">当前覆盖物</div>

          <div class="inventory-list">
            <button
              v-for="item in overlayItems"
              :key="item.id"
              class="inventory-item"
              :class="{ active: selectedOverlayId === item.id }"
              @click="selectedOverlayId = item.id"
            >
              <span>{{ item.kind }}</span>
              <span>{{ item.visible ? "visible" : "hidden" }}</span>
            </button>
          </div>
        </section>
      </template>
    </aside>

    <aside class="console-panel">
      <div class="console-header">
        <div>
          <div class="eyebrow">Events</div>
          <div class="console-title">结果面板</div>
        </div>

        <div class="action-row compact">
          <button @click="syncOverlayInventory">刷新</button>
          <button @click="clearLogs">清空</button>
        </div>
      </div>

      <div class="console-list">
        <article v-for="entry in logs" :key="entry.id" class="console-entry">
          <div class="console-meta">
            <span>{{ entry.time }}</span>
            <span>{{ entry.scope }}</span>
            <span>{{ entry.action }}</span>
          </div>
          <pre>{{ entry.detail }}</pre>
        </article>

        <div v-if="logs.length === 0" class="console-empty">还没有事件，先点点左边那些 API。</div>
      </div>
    </aside>

    <div v-if="message" class="message-bar">{{ message }}</div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import * as Cesium from "cesium";
import type { CustomButtonConfig, MapPluginOptions, SearchResult, ToolbarCallbacks, ToolbarConfig } from "../src/index";
import { i18n } from "../src/i18n";
import { getViteTdToken } from "../src/utils/common";
import { useOverlaySelectionBenchmark } from "./hooks/useOverlaySelectionBenchmark";
import { useOverlaySelectionValidation } from "./hooks/useOverlaySelectionValidation";
import { useMapInit } from "./useMapInit";
import { chinaMapExtent, getTdMapSearchUrl } from "./useMap";
import { toolbarButtonConfigs, toolbarLayersMenu, toolbarSearchMenu } from "./z.const";

type Locale = "zh-CN" | "en-US";
type TabId = "toolbar" | "overlay";
type HighlightReason = "click" | "hover";
type PlaygroundMapProvider = "tdt" | "tencent" | "gaode" | "baidu";

interface OverlayInventoryItem {
  id: string;
  kind: string;
  visible: boolean;
}

interface ConsoleEntry {
  id: number;
  time: string;
  scope: string;
  action: string;
  detail: string;
}

const tabs = [
  { id: "toolbar", label: "Toolbar API" },
  { id: "overlay", label: "Overlay API" },
] as const;

const { initMap, rebuildMap, destroyMap, viewer, mapPlugin, toolbarService } = useMapInit("cesiumContainer");

const activeTab = ref<TabId>("toolbar");
const locale = ref<Locale>(i18n.getLocale() as Locale);
const message = ref("");
const logs = ref<ConsoleEntry[]>([]);
const overlayItems = ref<OverlayInventoryItem[]>([]);
const selectedOverlayId = ref("");
const selectedToolbarButtonId = ref(toolbarButtonConfigs[0]?.id ?? "search");
const mountedCustomButtonId = ref("");
let unsubscribeI18n: (() => void) | null = null;
let logSeed = 0;

const toolbarForm = reactive({
  mapProvider: "tdt" as PlaygroundMapProvider,
  position: "bottom-right" as ToolbarConfig["position"],
  direction: "column" as ToolbarConfig["direction"],
  buttonSize: 36,
  buttonSpacing: 8,
  zIndex: 1100,
  backgroundColor: "transparent",
  borderColor: "transparent",
  buttonBackgroundColor: "rgba(0, 0, 0, 0.52)",
  buttonBorderColor: "rgba(9, 109, 236, 0.85)",
  searchPanelBackground: "rgba(7, 35, 73, 0.92)",
  searchWidth: 210,
  defaultPlaceNameChecked: true,
  defaultNoFlyZoneChecked: true,
});

const toolbarButtonState = reactive<Record<string, boolean>>(
  Object.fromEntries(toolbarButtonConfigs.map((button) => [button.id, true])),
);

const toolbarRuntimePatch = reactive({
  title: "",
  backgroundColor: "",
  color: "",
});

const customToolbarButton = reactive({
  id: "custom-api",
  title: "API",
  icon: "API",
  backgroundColor: "rgba(15, 23, 42, 0.78)",
});

const overlayForm = reactive({
  hoverEnabled: true,
  clickPickMinIntervalMs: 120,
  pickWidth: 3,
  pickHeight: 3,
  drillLimit: 16,
  highlightReason: "click" as HighlightReason,
  markerLabel: "API Marker",
  circleRadius: 900,
  rectangleWidth: 0.018,
  rectangleHeight: 0.012,
  infoTitle: "API Debug",
  infoBody: "Overlay service call result",
});

const toolbarReady = computed(() => !!toolbarService.value && !!viewer.value);
const overlayReady = computed(() => !!mapPlugin.value && !!viewer.value);
const overlayCount = computed(() => overlayItems.value.length);
const toolbarButtonOptions = computed(() => {
  const ids = toolbarButtonConfigs.map((button) => button.id);
  if (mountedCustomButtonId.value) {
    ids.push(mountedCustomButtonId.value);
  }
  return ids;
});

function stringifyDetail(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(
      value,
      (_key, currentValue) => {
        if (currentValue instanceof Cesium.Color) {
          return currentValue.toCssColorString();
        }
        return currentValue;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

function pushLog(scope: string, action: string, detail?: unknown) {
  logSeed += 1;
  logs.value.unshift({
    id: logSeed,
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    scope,
    action,
    detail: stringifyDetail(detail ?? ""),
  });
  logs.value = logs.value.slice(0, 120);
}

function clearLogs() {
  logs.value = [];
}

function showMessage(text: string, timeout = 1800) {
  message.value = text;
  window.setTimeout(() => {
    if (message.value === text) {
      message.value = "";
    }
  }, timeout);
}

const {
  snapshot: selectionValidationSnapshot,
  addBaseObjects: addOverlaySelectionBaseObjects,
  addOverlapObjects: addOverlaySelectionOverlapObjects,
  clearObjects: clearOverlaySelectionObjects,
  clearSelected: clearOverlaySelectionState,
  selectBaseMarker: selectOverlaySelectionBaseMarker,
} = useOverlaySelectionValidation(mapPlugin, viewer, {
  onLog: pushLog,
  onMessage: showMessage,
});

const {
  snapshot: selectionBenchmarkSnapshot,
  resetMetrics: resetOverlaySelectionBenchmarkMetrics,
  clearScenario: clearOverlaySelectionBenchmarkScenario,
  buildEntityScenario: buildOverlaySelectionEntityBenchmark,
  buildPrimitiveScenario: buildOverlaySelectionPrimitiveBenchmark,
  buildMixedScenario: buildOverlaySelectionMixedBenchmark,
} = useOverlaySelectionBenchmark(mapPlugin, viewer, {
  onLog: pushLog,
  onMessage: showMessage,
  onScenarioVisibilityChange: (active) => {
    if (active) {
      overlayItems.value = [];
      selectedOverlayId.value = "";
    }
  },
});

function getViewerCenter() {
  const currentViewer = viewer.value;
  if (!currentViewer) {
    return null;
  }

  const position = currentViewer.camera.positionCartographic;
  return {
    lon: Cesium.Math.toDegrees(position.longitude),
    lat: Cesium.Math.toDegrees(position.latitude),
  };
}

function getOverlayService() {
  if (!mapPlugin.value) {
    return null;
  }
  return mapPlugin.value.getOverlayService();
}

function rememberOverlay(id: string, kind: string) {
  const existing = overlayItems.value.filter((item) => item.id !== id);
  overlayItems.value = [{ id, kind, visible: true }, ...existing];
  selectedOverlayId.value = id;
}

function syncOverlayInventory() {
  const service = getOverlayService();
  if (!service) {
    overlayItems.value = [];
    selectedOverlayId.value = "";
    return;
  }

  const existingMap = new Map(overlayItems.value.map((item) => [item.id, item]));
  overlayItems.value = service.getAllOverlayIds().map((id) => {
    const existing = existingMap.get(id);
    return existing ?? { id, kind: "unknown", visible: true };
  });

  if (selectedOverlayId.value && !overlayItems.value.some((item) => item.id === selectedOverlayId.value)) {
    selectedOverlayId.value = overlayItems.value[0]?.id || "";
  }
}

async function runTdSearch(query: string): Promise<SearchResult[]> {
  const url = getTdMapSearchUrl(query, chinaMapExtent);
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const pois = data?.data?.pois || data?.pois || [];
  return pois.map((location: any) => {
    const [longitude = "0", latitude = "0"] = String(location?.lonlat ?? "").split(",");
    return {
      name: location?.name || query,
      address: location?.address || "",
      longitude: Number(longitude || 0),
      latitude: Number(latitude || 0),
      height: 100,
    };
  });
}

function createToolbarCallbacks(): ToolbarCallbacks {
  return {
    onSearch: async (query: string) => {
      pushLog("toolbar", "onSearch", { query });
      try {
        const results = await runTdSearch(query);
        pushLog("toolbar", "onSearch:result", { count: results.length, first: results[0] ?? null });
        return results;
      } catch (error) {
        pushLog("toolbar", "onSearch:error", String(error));
        return [];
      }
    },
    onSelect: (result) => {
      pushLog("toolbar", "onSelect", result);
      viewer.value?.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude, result.height || 1000),
        duration: 1.2,
      });
    },
    onMeasurementStart: () => {
      pushLog("toolbar", "onMeasurementStart");
    },
    onMeasurementComplete: (result) => {
      pushLog("toolbar", "onMeasurementComplete", result);
    },
    onClear: () => {
      pushLog("toolbar", "onClear");
    },
    onZoomIn: (beforeHeight, afterHeight) => {
      pushLog("toolbar", "onZoomIn", { beforeHeight, afterHeight });
    },
    onZoomOut: (beforeHeight, afterHeight) => {
      pushLog("toolbar", "onZoomOut", { beforeHeight, afterHeight });
    },
    onFullscreenChange: (isFullscreen) => {
      pushLog("toolbar", "onFullscreenChange", { isFullscreen });
    },
    onResetLocation: () => {
      pushLog("toolbar", "onResetLocation");
    },
  };
}

function cloneToolbarButtons(): CustomButtonConfig[] {
  return toolbarButtonConfigs
    .filter((button) => toolbarButtonState[button.id])
    .map((button) => ({
      ...button,
      backgroundColor: toolbarForm.buttonBackgroundColor,
      borderColor: toolbarForm.buttonBorderColor,
    }));
}

function buildMapOverrides(): Partial<MapPluginOptions> {
  const provider = toolbarForm.mapProvider;
  const mapType = provider === "tdt" ? "img" : "satellite";

  return {
    baseMap: {
      provider,
      type: mapType,
      showLabel: toolbarForm.defaultPlaceNameChecked,
      ...(provider === "gaode" ? { sk: "85f329e4b2f551232cd24862c753055f" } : {}),
    },
    mapAuth: {
      tdt: { token: getViteTdToken() },
      tencent: { key: "3Y3BZ-WXTLA-BV6KT-COBRB-4GXKO-7MFQC" },
      gaode: { key: "083cf2fc37d04fc1d4f45b4ea2a5d1e8" },
      baidu: { ak: "8c4RjhGrynydOwm1NSTBW8gt1DTE1riA" },
    },
    noFlyZone: {
      visible: toolbarForm.defaultNoFlyZoneChecked,
      autoLoad: toolbarForm.defaultNoFlyZoneChecked,
      extrudedHeight: 10,
    },
    services: {
      overlay: {
        enabled: true,
        picking: {
          hover: overlayForm.hoverEnabled,
          selection: true,
          pickWidth: overlayForm.pickWidth,
          pickHeight: overlayForm.pickHeight,
          drillLimit: overlayForm.drillLimit,
          clickDebounceMs: overlayForm.clickPickMinIntervalMs,
        },
      },
      toolbar: {
        enabled: true,
        config: {
          position: toolbarForm.position,
          direction: toolbarForm.direction,
          buttonSize: toolbarForm.buttonSize,
          buttonSpacing: toolbarForm.buttonSpacing,
          backgroundColor: toolbarForm.backgroundColor,
          borderColor: toolbarForm.borderColor,
          zIndex: toolbarForm.zIndex,
          useI18n: true,
          i18n,
        },
        buttonConfigs: cloneToolbarButtons(),
        searchMenu: {
          ...toolbarSearchMenu,
          panelStyle: {
            ...toolbarSearchMenu.panelStyle,
            containerStyle: {
              ...toolbarSearchMenu.panelStyle.containerStyle,
              background: toolbarForm.searchPanelBackground,
            },
            inputStyle: {
              ...toolbarSearchMenu.panelStyle.inputStyle,
              width: `${toolbarForm.searchWidth}px`,
              background: toolbarForm.searchPanelBackground,
            },
            resultStyle: {
              ...toolbarSearchMenu.panelStyle.resultStyle,
              background: toolbarForm.searchPanelBackground,
            },
          },
        },
        layersMenu: {
          ...toolbarLayersMenu,
          defaultPlaceNameChecked: toolbarForm.defaultPlaceNameChecked,
          defaultNoFlyZoneChecked: toolbarForm.defaultNoFlyZoneChecked,
        },
        callbacks: createToolbarCallbacks(),
      },
    },
  };
}

async function rebuildPlayground(scope: "toolbar" | "overlay") {
  overlayItems.value = [];
  selectedOverlayId.value = "";
  mountedCustomButtonId.value = "";

  pushLog(scope, "rebuild:start", buildMapOverrides());
  await rebuildMap(buildMapOverrides());
  syncOverlayInventory();
  showMessage(`${scope} playground 已重建`);
  pushLog(scope, "rebuild:done", {
    toolbarReady: !!toolbarService.value,
    overlayReady: !!mapPlugin.value,
  });
}

async function rebuildToolbarPlayground() {
  await rebuildPlayground("toolbar");
}

async function rebuildOverlayPlayground() {
  await rebuildPlayground("overlay");
}

function applyToolbarRuntimeStyle() {
  const service = toolbarService.value;
  if (!service) {
    showMessage("ToolbarService 未初始化");
    return;
  }

  const patch: Partial<ToolbarConfig> = {
    position: toolbarForm.position,
    direction: toolbarForm.direction,
    buttonSize: toolbarForm.buttonSize,
    buttonSpacing: toolbarForm.buttonSpacing,
    backgroundColor: toolbarForm.backgroundColor,
    borderColor: toolbarForm.borderColor,
    zIndex: toolbarForm.zIndex,
  };

  service.updateToolbarStyle(patch);
  pushLog("toolbar", "updateToolbarStyle", patch);
  showMessage("Toolbar 样式已更新");
}

function closeToolbarMenus() {
  const service = toolbarService.value;
  if (!service) {
    showMessage("ToolbarService 未初始化");
    return;
  }

  service.closeAllMenus();
  pushLog("toolbar", "closeAllMenus");
}

function showToolbarButton() {
  if (!toolbarService.value) return;
  toolbarService.value.showButton(selectedToolbarButtonId.value);
  pushLog("toolbar", "showButton", { id: selectedToolbarButtonId.value });
}

function hideToolbarButton() {
  if (!toolbarService.value) return;
  toolbarService.value.hideButton(selectedToolbarButtonId.value);
  pushLog("toolbar", "hideButton", { id: selectedToolbarButtonId.value });
}

function enableToolbarButton() {
  if (!toolbarService.value) return;
  toolbarService.value.enableButton(selectedToolbarButtonId.value);
  pushLog("toolbar", "enableButton", { id: selectedToolbarButtonId.value });
}

function disableToolbarButton() {
  if (!toolbarService.value) return;
  toolbarService.value.disableButton(selectedToolbarButtonId.value);
  pushLog("toolbar", "disableButton", { id: selectedToolbarButtonId.value });
}

function patchToolbarButton() {
  const service = toolbarService.value;
  if (!service) {
    return;
  }

  const patch: Partial<CustomButtonConfig> = {};
  if (toolbarRuntimePatch.title) patch.title = toolbarRuntimePatch.title;
  if (toolbarRuntimePatch.backgroundColor) patch.backgroundColor = toolbarRuntimePatch.backgroundColor;
  if (toolbarRuntimePatch.color) patch.color = toolbarRuntimePatch.color;

  service.updateButton(selectedToolbarButtonId.value, patch);
  pushLog("toolbar", "updateButton", { id: selectedToolbarButtonId.value, patch });
  showMessage(`按钮 ${selectedToolbarButtonId.value} 已更新`);
}

function mountCustomToolbarButton() {
  const service = toolbarService.value;
  if (!service) {
    showMessage("ToolbarService 未初始化");
    return;
  }

  if (mountedCustomButtonId.value) {
    service.removeButton(mountedCustomButtonId.value);
  }

  service.addCustomButton(
    {
      id: customToolbarButton.id,
      icon: customToolbarButton.icon,
      title: customToolbarButton.title,
      backgroundColor: customToolbarButton.backgroundColor,
      color: "#ffffff",
      borderColor: "rgba(96, 165, 250, 0.4)",
    },
    () => {
      pushLog("toolbar", "customButton:onClick", { id: customToolbarButton.id });
      showMessage(`自定义按钮 ${customToolbarButton.id} 已点击`);
    },
  );

  mountedCustomButtonId.value = customToolbarButton.id;
  selectedToolbarButtonId.value = customToolbarButton.id;
  pushLog("toolbar", "addCustomButton", customToolbarButton);
  showMessage(`自定义按钮 ${customToolbarButton.id} 已挂载`);
}

function removeCustomToolbarButton() {
  const service = toolbarService.value;
  if (!service || !mountedCustomButtonId.value) {
    return;
  }

  service.removeButton(mountedCustomButtonId.value);
  pushLog("toolbar", "removeButton", { id: mountedCustomButtonId.value });
  mountedCustomButtonId.value = "";
  selectedToolbarButtonId.value = toolbarButtonConfigs[0]?.id ?? "search";
  showMessage("自定义按钮已移除");
}

function addMarkerOverlay() {
  const service = getOverlayService();
  const center = getViewerCenter();
  if (!service || !center) {
    return;
  }

  const marker = service.addMarker({
    position: [center.lon, center.lat],
    pixelSize: 12,
    color: Cesium.Color.ORANGE,
    outlineColor: Cesium.Color.WHITE,
    outlineWidth: 2,
    clickHighlight: true,
    hoverHighlight: true,
    onClick: () => {
      pushLog("overlay", "marker:onClick", { id: marker.getId() });
    },
  });

  const label = service.addLabel({
    position: [center.lon, center.lat, 0],
    text: overlayForm.markerLabel,
    font: "15px sans-serif",
    fillColor: Cesium.Color.WHITE,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString("#0f172ab0"),
    pixelOffset: new Cesium.Cartesian2(0, -24),
  });

  rememberOverlay(marker.getId(), "marker");
  rememberOverlay(label.getId(), "label");
  pushLog("overlay", "addMarker", { markerId: marker.getId(), labelId: label.getId() });
  showMessage("Marker 已创建");
}

function addCircleOverlay() {
  const service = getOverlayService();
  const center = getViewerCenter();
  if (!service || !center) {
    return;
  }

  const circle = service.addCircle({
    position: [center.lon + 0.02, center.lat],
    radius: overlayForm.circleRadius,
    material: Cesium.Color.fromCssColorString("#ff6b6b").withAlpha(0.28),
    outline: true,
    outlineColor: Cesium.Color.fromCssColorString("#ff6b6b"),
    outlineWidth: 4,
    clickHighlight: true,
    hoverHighlight: true,
  });

  rememberOverlay(circle.getId(), "circle");
  pushLog("overlay", "addCircle", { id: circle.getId(), radius: overlayForm.circleRadius });
}

function addRectangleOverlay() {
  const service = getOverlayService();
  const center = getViewerCenter();
  if (!service || !center) {
    return;
  }

  const rectangle = service.addRectangle({
    coordinates: Cesium.Rectangle.fromDegrees(
      center.lon - overlayForm.rectangleWidth,
      center.lat - overlayForm.rectangleHeight,
      center.lon - overlayForm.rectangleWidth * 0.2,
      center.lat - overlayForm.rectangleHeight * 0.2,
    ),
    material: Cesium.Color.fromCssColorString("#2dd4bf").withAlpha(0.22),
    outline: true,
    outlineColor: Cesium.Color.fromCssColorString("#2dd4bf"),
    outlineWidth: 3,
    clickHighlight: true,
    hoverHighlight: true,
  });

  rememberOverlay(rectangle.getId(), "rectangle");
  pushLog("overlay", "addRectangle", { id: rectangle.getId() });
}

function addPolylineOverlay() {
  const service = getOverlayService();
  const center = getViewerCenter();
  if (!service || !center) {
    return;
  }

  const polyline = service.addPolyline({
    positions: [
      [center.lon - 0.03, center.lat - 0.01],
      [center.lon - 0.015, center.lat + 0.008],
      [center.lon + 0.008, center.lat + 0.002],
    ],
    width: 4,
    color: Cesium.Color.fromCssColorString("#f59e0b"),
    clampToGround: true,
    clickHighlight: true,
    hoverHighlight: true,
  });

  rememberOverlay(polyline.getId(), "polyline");
  pushLog("overlay", "addPolyline", { id: polyline.getId() });
}

function addPolygonOverlay() {
  const service = getOverlayService();
  const center = getViewerCenter();
  if (!service || !center) {
    return;
  }

  const polygon = service.addPolygon({
    positions: [
      [center.lon + 0.012, center.lat - 0.006],
      [center.lon + 0.03, center.lat - 0.012],
      [center.lon + 0.038, center.lat + 0.004],
      [center.lon + 0.02, center.lat + 0.012],
    ],
    material: Cesium.Color.fromCssColorString("#60a5fa").withAlpha(0.26),
    outline: true,
    outlineColor: Cesium.Color.fromCssColorString("#60a5fa"),
    outlineWidth: 2,
    clickHighlight: true,
    hoverHighlight: true,
  });

  rememberOverlay(polygon.getId(), "polygon");
  pushLog("overlay", "addPolygon", { id: polygon.getId() });
}

function addInfoWindowOverlay() {
  const service = getOverlayService();
  const center = getViewerCenter();
  if (!service || !center) {
    return;
  }

  const marker = service.addMarker({
    position: [center.lon, center.lat + 0.015],
    pixelSize: 12,
    color: Cesium.Color.CYAN,
    outlineColor: Cesium.Color.WHITE,
    outlineWidth: 2,
  });

  const infoWindow = service.addInfoWindow({
    position: [center.lon, center.lat + 0.015],
    content: `<div style="padding:10px"><h3 style="margin:0 0 8px 0">${overlayForm.infoTitle}</h3><p style="margin:0">${overlayForm.infoBody}</p></div>`,
    width: 260,
    anchorPixel: 18,
    tailGap: 24,
    showArrow: true,
    arrowSize: 10,
    positionOffset: "top",
    updateInterval: 200,
    hideWhenOutOfView: true,
    show: true,
    closable: true,
  });

  rememberOverlay(marker.getId(), "marker");
  rememberOverlay(infoWindow.getId(), "infowindow");
  pushLog("overlay", "addInfoWindow", { markerId: marker.getId(), infoWindowId: infoWindow.getId() });
}

function addRingOverlay() {
  const service = getOverlayService();
  const center = getViewerCenter();
  if (!service || !center) {
    return;
  }

  const ring = service.addRing({
    position: [center.lon - 0.02, center.lat + 0.02, 0],
    radius: 150,
    color: Cesium.Color.RED,
    lineColor: Cesium.Color.RED.withAlpha(0.8),
    lineStyle: "dashed",
    lineMaterialMode: "stripe",
    stripeRepeat: 2048,
    glowWidth: 24,
    speed: 1,
  });

  rememberOverlay(ring.getId(), "ring");
  pushLog("overlay", "addRing", { id: ring.getId() });
}

function requireSelectedOverlay(): string | null {
  if (!selectedOverlayId.value) {
    showMessage("请先选择一个覆盖物");
    return null;
  }
  return selectedOverlayId.value;
}

function toggleSelectedOverlayVisibility() {
  const service = getOverlayService();
  const overlayId = requireSelectedOverlay();
  if (!service || !overlayId) {
    return;
  }

  const target = overlayItems.value.find((item) => item.id === overlayId);
  const nextVisible = !(target?.visible ?? true);
  const changed = service.setOverlayVisible(overlayId, nextVisible);
  if (!changed) {
    showMessage("setOverlayVisible 失败");
    return;
  }

  overlayItems.value = overlayItems.value.map((item) => (
    item.id === overlayId ? { ...item, visible: nextVisible } : item
  ));
  pushLog("overlay", "setOverlayVisible", { id: overlayId, visible: nextVisible });
}

function highlightSelectedOverlay() {
  const service = getOverlayService();
  const overlayId = requireSelectedOverlay();
  if (!service || !overlayId) {
    return;
  }

  const changed = service.setOverlayHighlight(overlayId, true, overlayForm.highlightReason);
  pushLog("overlay", "setOverlayHighlight", {
    id: overlayId,
    enabled: changed,
    reason: overlayForm.highlightReason,
  });
}

function clearSelectedOverlayHighlight() {
  const service = getOverlayService();
  const overlayId = requireSelectedOverlay();
  if (!service || !overlayId) {
    return;
  }

  const changed = service.setOverlayHighlight(overlayId, false, overlayForm.highlightReason);
  pushLog("overlay", "clearHighlight", {
    id: overlayId,
    enabled: changed,
    reason: overlayForm.highlightReason,
  });
}

function toggleSelectedOverlayHighlight() {
  const service = getOverlayService();
  const overlayId = requireSelectedOverlay();
  if (!service || !overlayId) {
    return;
  }

  const changed = service.toggleOverlayHighlight(overlayId, overlayForm.highlightReason);
  pushLog("overlay", "toggleOverlayHighlight", {
    id: overlayId,
    changed,
    reason: overlayForm.highlightReason,
  });
}

function startSelectedOverlayEdit() {
  const service = getOverlayService() as any;
  const overlayId = requireSelectedOverlay();
  if (!service || !overlayId || typeof service.startOverlayEdit !== "function") {
    return;
  }

  const started = service.startOverlayEdit(overlayId, {
    vertex: {
      color: "#38bdf8",
      outlineColor: "#ffffff",
      pixelSize: 11,
    },
  });
  pushLog("overlay", "startOverlayEdit", { id: overlayId, started });
  showMessage(started ? "已进入 overlay 编辑模式" : "overlay 编辑模式启动失败");
}

function stopOverlayEdit() {
  const service = getOverlayService() as any;
  if (!service || typeof service.stopOverlayEdit !== "function") {
    return;
  }

  const result = service.stopOverlayEdit();
  pushLog("overlay", "stopOverlayEdit", { result: result?.id ?? null });
}

function removeSelectedOverlay() {
  const service = getOverlayService();
  const overlayId = requireSelectedOverlay();
  if (!service || !overlayId) {
    return;
  }

  const removed = service.removeOverlay(overlayId);
  if (!removed) {
    showMessage("removeOverlay 失败");
    return;
  }

  overlayItems.value = overlayItems.value.filter((item) => item.id !== overlayId);
  selectedOverlayId.value = overlayItems.value[0]?.id || "";
  pushLog("overlay", "removeOverlay", { id: overlayId });
}

function removeAllOverlays() {
  const service = getOverlayService();
  if (!service) {
    return;
  }

  service.removeAllOverlays();
  overlayItems.value = [];
  selectedOverlayId.value = "";
  pushLog("overlay", "removeAllOverlays");
}

function applyOverlayHoverMode() {
  const service = getOverlayService();
  if (!service) {
    return;
  }

  service.setHoverEnabled(overlayForm.hoverEnabled);
  pushLog("overlay", "setHoverEnabled", { enabled: overlayForm.hoverEnabled });
  showMessage(`hover handler 已${overlayForm.hoverEnabled ? "开启" : "关闭"}`);
}

const onLocaleSelect = (event: Event) => {
  const nextLocale = (event.target as HTMLSelectElement).value as Locale;
  i18n.setLocale(nextLocale, { persist: true });
  pushLog("app", "setLocale", { locale: nextLocale });
};

onMounted(async () => {
  i18n.configure({
    persist: true,
    useStoredLocale: true,
  });

  locale.value = i18n.getLocale() as Locale;
  unsubscribeI18n = i18n.onLocaleChange((nextLocale) => {
    locale.value = nextLocale as Locale;
  });

  await initMap(buildMapOverrides());
  syncOverlayInventory();
  pushLog("app", "mounted", {
    toolbarReady: !!toolbarService.value,
    overlayReady: !!mapPlugin.value,
  });
});

onBeforeUnmount(() => {
  unsubscribeI18n?.();
  unsubscribeI18n = null;
  destroyMap();
});
</script>

<style scoped>
.app-shell {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #020617;
}

.map-host {
  width: 100%;
  height: 100%;
}

.workbench,
.console-panel {
  position: absolute;
  z-index: 1400;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.84);
  box-shadow: 0 18px 40px rgba(2, 8, 23, 0.34);
  backdrop-filter: blur(14px);
}

.workbench {
  top: 16px;
  left: 16px;
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  padding: 16px;
  border-radius: 12px;
  overflow: auto;
}

.console-panel {
  right: 16px;
  bottom: 16px;
  width: min(420px, calc(100vw - 32px));
  max-height: min(52vh, 520px);
  padding: 14px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header,
.console-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.88);
  text-transform: uppercase;
}

.panel-title,
.console-title {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 600;
  color: #f8fafc;
}

.compact-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 100px;
  color: rgba(226, 232, 240, 0.84);
  font-size: 12px;
}

.tab-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.tab-button {
  height: 36px;
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 9px;
  background: rgba(15, 23, 42, 0.5);
  color: rgba(226, 232, 240, 0.86);
}

.tab-button.active {
  background: rgba(37, 99, 235, 0.94);
  color: #ffffff;
}

.status-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.status-strip span {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.82);
  color: rgba(226, 232, 240, 0.84);
  font-size: 11px;
}

.section-block {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(51, 65, 85, 0.72);
  border-radius: 10px;
  background: rgba(2, 6, 23, 0.34);
}

.section-title {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.collapsible-title {
  margin-bottom: 0;
  cursor: pointer;
  list-style: none;
}

.collapsible-title::-webkit-details-marker {
  display: none;
}

.validation-block[open] .collapsible-title {
  margin-bottom: 12px;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field-grid label,
.compact-field {
  min-width: 0;
}

.field-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-grid label span,
.toggle-item span {
  font-size: 12px;
  color: rgba(226, 232, 240, 0.82);
}

.field-grid .span-2 {
  grid-column: span 2;
}

input,
select,
button {
  font: inherit;
}

input,
select {
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.78);
  color: #f8fafc;
}

select option {
  color: #0f172a;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(51, 65, 85, 0.68);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.4);
}

.toggle-item input {
  width: 16px;
  height: 16px;
  margin: 0;
  padding: 0;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.action-row.compact {
  margin-top: 0;
}

.validation-actions {
  margin-top: 12px;
}

.validation-state {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.validation-state-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(51, 65, 85, 0.68);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.48);
}

.validation-state-item span {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.92);
}

.validation-state-item strong {
  min-width: 0;
  color: #f8fafc;
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
}

.validation-note {
  margin: 12px 0 0;
  color: rgba(148, 163, 184, 0.94);
  font-size: 12px;
  line-height: 1.6;
}

button {
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.74);
  color: #f8fafc;
  cursor: pointer;
}

button.primary {
  background: rgba(37, 99, 235, 0.95);
  border-color: rgba(59, 130, 246, 0.9);
}

.inventory-block {
  padding-bottom: 8px;
}

.inventory-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 180px;
  overflow: auto;
}

.inventory-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 34px;
  background: rgba(15, 23, 42, 0.52);
}

.inventory-item.active {
  background: rgba(37, 99, 235, 0.92);
}

.console-list {
  margin-top: 12px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.console-entry {
  padding: 10px;
  border: 1px solid rgba(51, 65, 85, 0.72);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.4);
}

.console-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: rgba(148, 163, 184, 0.9);
}

.console-entry pre {
  margin: 8px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.5;
}

.console-empty {
  padding: 16px;
  border: 1px dashed rgba(71, 85, 105, 0.8);
  border-radius: 8px;
  color: rgba(148, 163, 184, 0.92);
  font-size: 12px;
  text-align: center;
}

.message-bar {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 1500;
  max-width: min(70vw, 680px);
  padding: 9px 14px;
  border-radius: 9px;
  background: rgba(17, 24, 39, 0.9);
  color: #f8fafc;
  font-size: 13px;
  box-shadow: 0 12px 24px rgba(2, 8, 23, 0.24);
}

@media (max-width: 1100px) {
  .workbench {
    width: calc(100vw - 32px);
    max-height: 58vh;
  }

  .console-panel {
    left: 16px;
    right: 16px;
    width: auto;
    max-height: 28vh;
  }
}

@media (max-width: 720px) {
  .field-grid,
  .toggle-grid,
  .validation-state {
    grid-template-columns: minmax(0, 1fr);
  }

  .field-grid .span-2 {
    grid-column: span 1;
  }

  .panel-header,
  .console-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
