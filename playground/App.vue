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
        <span>Draw {{ drawReady ? "Ready" : "Missing" }}</span>
        <span>{{ overlayCount }} overlays</span>
        <span>{{ drawCount }} drawings</span>
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
            <button @click="applyToolbarStyle">测试更新样式</button>
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

      <template v-else-if="activeTab === 'overlay'">
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

      <template v-else>
        <section class="section-block">
          <div class="section-title">Draw 初始化与运行状态</div>

          <div class="field-grid">
            <label>
              <span>绘制模式</span>
              <select v-model="drawForm.mode">
                <option value="line">line</option>
                <option value="polygon">polygon</option>
                <option value="rectangle">rectangle</option>
                <option value="circle">circle</option>
              </select>
            </label>

            <label>
              <span>输出坐标系</span>
              <select v-model="drawForm.outputCoordSystem">
                <option value="WGS84">WGS84</option>
                <option value="GCJ02">GCJ02</option>
                <option value="BD09">BD09</option>
              </select>
            </label>
          </div>

          <div class="toggle-grid">
            <label class="toggle-item">
              <input v-model="drawForm.clampToGround" type="checkbox" />
              <span>贴地绘制</span>
            </label>

            <label class="toggle-item">
              <input v-model="drawForm.selfIntersectionEnabled" type="checkbox" />
              <span>启用自相交校验</span>
            </label>

            <label class="toggle-item">
              <input v-model="drawForm.selfIntersectionAllowTouch" type="checkbox" />
              <span>允许边界相切</span>
            </label>

            <label class="toggle-item">
              <input v-model="drawForm.selfIntersectionAllowContinue" type="checkbox" />
              <span>允许继续落点</span>
            </label>
          </div>

          <div class="action-row wrap">
            <button class="primary" @click="rebuildDrawPlayground">重建并应用</button>
            <button @click="refreshDrawState">refreshState</button>
            <button @click="startDrawGeneric">startDrawing(mode)</button>
            <button @click="startDrawShortcut">startDrawingXxx</button>
            <button @click="cancelDrawSession">cancelDrawing</button>
            <button @click="endDrawSession">endDrawing</button>
          </div>
        </section>

        <section class="section-block">
          <div class="section-title">Draw 结果管理 API</div>

          <div class="field-grid">
            <label class="span-2">
              <span>目标实体</span>
              <select v-model="selectedDrawEntityId">
                <option value="">请选择</option>
                <option v-for="item in drawItems" :key="item.id" :value="item.id">
                  {{ item.id }} | {{ item.type }}
                </option>
              </select>
            </label>
          </div>

          <div class="action-row wrap">
            <button @click="syncDrawInventory">getFinishedEntities</button>
            <button @click="removeSelectedDrawEntity">removeEntity</button>
            <button @click="removeLastDrawEntity">removeLast</button>
            <button @click="clearDrawEntities">clearAll</button>
          </div>
        </section>

        <section class="section-block">
          <div class="section-title">Draw 事件快照</div>

          <div class="validation-state">
            <div class="validation-state-item">
              <span>isDrawingMode</span>
              <strong>{{ drawStatus.isDrawing ? "true" : "false" }}</strong>
            </div>
            <div class="validation-state-item">
              <span>getCurrentDrawMode</span>
              <strong>{{ drawStatus.currentMode ?? "-" }}</strong>
            </div>
            <div class="validation-state-item">
              <span>Last Result</span>
              <strong>{{ drawStatus.lastSummary }}</strong>
            </div>
            <div class="validation-state-item">
              <span>Last Output</span>
              <strong>{{ drawStatus.lastCoordSystem ?? "-" }}</strong>
            </div>
          </div>

          <div class="event-log">
            <div v-for="entry in drawEventLog" :key="entry" class="event-log-item">
              {{ entry }}
            </div>
          </div>

          <pre class="result-preview">{{ drawResultPreview }}</pre>
        </section>

        <section class="section-block inventory-block">
          <div class="section-title">当前绘制实体</div>

          <div class="inventory-list">
            <button
              v-for="item in drawItems"
              :key="item.id"
              class="inventory-item"
              :class="{ active: selectedDrawEntityId === item.id }"
              @click="selectedDrawEntityId = item.id"
            >
              <span>{{ item.type }}</span>
              <span>{{ item.id }}</span>
            </button>
          </div>
        </section>
      </template>
    </aside>

    <div v-if="message" class="message-bar">{{ message }}</div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { MapPluginOptions, ToolbarCallbacks } from "../src/index";
import { i18n } from "../src/i18n";
import { useOverlaySelectionBenchmark } from "./hooks/useOverlaySelectionBenchmark";
import { useOverlaySelectionValidation } from "./hooks/useOverlaySelectionValidation";
import { usePlaygroundDraw } from "./hooks/usePlaygroundDraw";
import { usePlaygroundOverlay } from "./hooks/usePlaygroundOverlay";
import { usePlaygroundToolbar } from "./hooks/usePlaygroundToolbar";
import { buildPlaygroundMapService } from "./mapServiceConfig";
import { useMapInit } from "./useMapInit";
import { toolbarButtonConfigs, toolbarLayersMenu, toolbarSearchMenu } from "./z.const";

type Locale = "zh-CN" | "en-US";
type TabId = "toolbar" | "overlay" | "draw";

const tabs = [
  { id: "toolbar", label: "Toolbar API" },
  { id: "overlay", label: "Overlay API" },
  { id: "draw", label: "Draw API" },
] as const;

const { initMap, rebuildMap, destroyMap, viewer, mapPlugin, toolbarService, drawService } = useMapInit("cesiumContainer");

const activeTab = ref<TabId>("toolbar");
const locale = ref<Locale>(i18n.getLocale() as Locale);
const message = ref("");
let unsubscribeI18n: (() => void) | null = null;

function showMessage(text: string, timeout = 1800) {
  message.value = text;
  window.setTimeout(() => {
    if (message.value === text) {
      message.value = "";
    }
  }, timeout);
}

const {
  toolbarReady,
  toolbarForm,
  toolbarButtonState,
  toolbarRuntimePatch,
  customToolbarButton,
  selectedToolbarButtonId,
  toolbarButtonOptions,
  cloneToolbarButtons,
  resetToolbarState,
  applyToolbarStyle,
  applyToolbarRuntimeStyle,
  closeToolbarMenus,
  showToolbarButton,
  hideToolbarButton,
  enableToolbarButton,
  disableToolbarButton,
  patchToolbarButton,
  mountCustomToolbarButton,
  removeCustomToolbarButton,
} = usePlaygroundToolbar({
  toolbarService,
  viewer,
  showMessage,
});

const {
  overlayReady,
  overlayCount,
  overlayForm,
  overlayItems,
  selectedOverlayId,
  resetOverlayState,
  syncOverlayInventory,
  addMarkerOverlay,
  addCircleOverlay,
  addRectangleOverlay,
  addPolylineOverlay,
  addPolygonOverlay,
  addInfoWindowOverlay,
  addRingOverlay,
  toggleSelectedOverlayVisibility,
  highlightSelectedOverlay,
  clearSelectedOverlayHighlight,
  toggleSelectedOverlayHighlight,
  startSelectedOverlayEdit,
  stopOverlayEdit,
  removeSelectedOverlay,
  removeAllOverlays,
  applyOverlayHoverMode,
} = usePlaygroundOverlay({
  mapPlugin,
  viewer,
  showMessage,
});

const {
  drawReady,
  drawCount,
  drawForm,
  drawStatus,
  drawItems,
  drawEventLog,
  selectedDrawEntityId,
  drawResultPreview,
  bindDrawCallbacks,
  syncDrawInventory,
  resetDrawState,
  refreshDrawState,
  startDrawGeneric,
  startDrawShortcut,
  cancelDrawSession,
  endDrawSession,
  removeSelectedDrawEntity,
  removeLastDrawEntity,
  clearDrawEntities,
} = usePlaygroundDraw({
  drawService,
  viewer,
  showMessage,
});

const {
  snapshot: selectionValidationSnapshot,
  addBaseObjects: addOverlaySelectionBaseObjects,
  addOverlapObjects: addOverlaySelectionOverlapObjects,
  clearObjects: clearOverlaySelectionObjects,
  clearSelected: clearOverlaySelectionState,
  selectBaseMarker: selectOverlaySelectionBaseMarker,
} = useOverlaySelectionValidation(mapPlugin, viewer, {
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
  onMessage: showMessage,
  onScenarioVisibilityChange: (active) => {
    if (active) {
      resetOverlayState();
    }
  },
});

function createToolbarCallbacks(): ToolbarCallbacks {
  return {
    onMeasurementStart: () => {
      showMessage("Toolbar 测量开始");
    },
    onMeasurementComplete: (result) => {
      const summary = typeof result === "object" && result
        ? JSON.stringify(result)
        : String(result ?? "");
      showMessage(`Toolbar 测量完成: ${summary.slice(0, 80)}`);
    },
    onClear: () => {
      showMessage("Toolbar 测量结果已清空");
    },
  };
}

function buildMapOverrides(): Partial<MapPluginOptions> {
  return {
    mapService: buildPlaygroundMapService(toolbarForm.mapProvider),
    onSearchResultSelected: (result) => {
      showMessage(`地图搜索定位: ${result.name} (${result.provider})`);
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

async function rebuildPlayground(scope: TabId) {
  resetOverlayState();
  resetDrawState();
  resetToolbarState();
  await rebuildMap(buildMapOverrides());
  bindDrawCallbacks();
  syncOverlayInventory();
  syncDrawInventory();
  showMessage(`${scope} playground 已重建`);
}

async function rebuildToolbarPlayground() {
  await rebuildPlayground("toolbar");
}

async function rebuildOverlayPlayground() {
  await rebuildPlayground("overlay");
}

async function rebuildDrawPlayground() {
  await rebuildPlayground("draw");
}

const onLocaleSelect = (event: Event) => {
  const nextLocale = (event.target as HTMLSelectElement).value as Locale;
  i18n.setLocale(nextLocale, { persist: true });
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
  bindDrawCallbacks();
  syncOverlayInventory();
  syncDrawInventory();
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

.workbench {
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

.panel-header {
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

.panel-title {
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.event-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.event-log-item,
.result-preview {
  padding: 10px;
  border: 1px solid rgba(51, 65, 85, 0.68);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.48);
  color: #f8fafc;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.result-preview {
  margin: 12px 0 0;
  white-space: pre-wrap;
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
  gap: 10px;
  width: 100%;
  height: 34px;
  background: rgba(15, 23, 42, 0.52);
}

.inventory-item span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inventory-item.active {
  background: rgba(37, 99, 235, 0.92);
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

  .panel-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
