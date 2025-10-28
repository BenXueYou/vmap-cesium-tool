<template>
  <div class="cesium-container">
    <div
      id="cesiumContainer"
      ref="cesiumContainer"
      style="width: 100%; height: 100vh"
    ></div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from "vue";

import * as Cesium from "cesium";

const TDT_TK = import.meta.env.VITE_TD_TOKEN;


function createTdtTerrainProvider() {
  return new Cesium.CesiumTerrainProvider({
    url: `https://t0.tianditu.gov.cn/mapservice/swdx?tk=${TDT_TK}`,
    requestVertexNormals: true,  // 获取法线信息，用于光照效果
    requestWaterMask: true     // 获取水体遮罩，用于水面效果
  });
}

function createTdtWmtsProvider(layer: string) {
  return new Cesium.WebMapTileServiceImageryProvider({
    url:
      "https://t{s}.tianditu.gov.cn/" +
      `${layer}_w/wmts?service=WMTS&request=GetTile&version=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&format=tiles` +
      `&tileMatrix={TileMatrix}&tileRow={TileRow}&tileCol={TileCol}&tk=${TDT_TK}`,
    layer,
    style: "default",
    format: "tiles",
    tileMatrixSetID: "w",
    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 18,
    tileMatrixLabels: Array.from({ length: 18 }, (_, i) => String(i + 1)),
  });
}

// 创建 Viewer（若要真实地形起伏，可在此替换 terrainProvider）
const viewer = new Cesium.Viewer("cesiumContainer", {
  // 若你没有可用的天地图地形服务，这里建议先用 World Terrain
  // terrain: 
  terrainProvider: createTdtTerrainProvider(), // 或 new Cesium.EllipsoidTerrain()
  // 如果你想完全控制底图，禁用默认底图再自行添加：
  imageryProvider: false,
  baseLayerPicker: false,
});

// ——— 基础组合函数 ———
// 1) 天地图-普通（矢量底图 + 矢量中文注记）
function addTdtNormalBaseMap() {
  const imgs = viewer.imageryLayers;
  const vec = imgs.addImageryProvider(createTdtWmtsProvider("vec"));
  const cva = imgs.addImageryProvider(createTdtWmtsProvider("cva"));
  // 注记置顶
  imgs.raiseToTop(cva);
  return { vec, cva };
}

// 2) 天地图-影像（影像底图 + 影像中文注记）
function addTdtImageBaseMap() {
  const imgs = viewer.imageryLayers;
  const img = imgs.addImageryProvider(createTdtWmtsProvider("img"));
  const cia = imgs.addImageryProvider(createTdtWmtsProvider("cia"));
  imgs.raiseToTop(cia);
  return { img, cia };
}

// 3) 天地图-三维（地形晕渲底图 + 三维注记）
// 注意：这是影像底图的“晕渲”，非真实高程；真实起伏需设置 terrainProvider
function addTdt3DShadedBaseMap() {
  const imgs = viewer.imageryLayers;
  const ter = imgs.addImageryProvider(createTdtWmtsProvider("ter"));
  const cta = imgs.addImageryProvider(createTdtWmtsProvider("cta"));
  imgs.raiseToTop(cta);
  return { ter, cta };
}

// 4) 天地图-地形：常见两种理解
// 4.1 若是“地形晕渲”影像（很多场景把它也称为地形底图）
function addTdtTerrainShadedImagery() {
  const imgs = viewer.imageryLayers;
  const ter = imgs.addImageryProvider(createTdtWmtsProvider("ter"));
  return { ter };
}
// 4.2 若要“真实地形起伏”（高程），用地形服务（示例为 World Terrain）
async function enableRealTerrain() {
  viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl(
    Cesium.IonResource.fromAssetId(1) // World Terrain
  );
}
</script>

<style scoped>
.cesium-container {
  position: relative;
}
</style>
