<template>
  <div class="cesium-container">
    <div
      id="cesiumContainer"
      ref="cesiumContainer"
      style="width: 100%; height: 100vh"
    ></div>
    
    <!-- 地图切换控制面板 -->
    <div class="map-controls">
      <h3>天地图资源加载测试</h3>
      <div class="control-buttons">
        <!-- <button @click="loadTdtNormalMap()" class="control-btn">天地图-普通</button>
        <button @click="loadTdtImageMap()" class="control-btn">天地图-影像</button>
        <button @click="loadTdt3DMap()" class="control-btn">天地图-三维</button>
        <button @click="loadTdtTerrainMap()" class="control-btn">天地图-地形</button>
        <button @click="loadTdtTerrainOnly()" class="control-btn">纯地形</button>
        <button @click="loadTdtNoTerrain()" class="control-btn">无地形</button>
        <button @click="testTdtTerrainVariants()" class="control-btn">测试地形服务</button> -->
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from "vue";

import * as Cesium from "cesium";

const TDT_TK = import.meta.env.VITE_TD_TOKEN;
const CesiumToken = import.meta.env.VITE_CESIUM_TOKEN;


// 设置 Cesium Ion 访问令牌（兼容 Cesium 1.134.1）
if (CesiumToken) {
  Cesium.Ion.defaultAccessToken = CesiumToken as string;
}

onMounted(() => {
  const viewer = new Cesium.Viewer('cesiumContainer', {
     homeButton: false,
     sceneModePicker: false,
     baseLayerPicker: false,
     navigationHelpButton: false,
     animation: false,
     timeline: false,
     fullscreenButton: false,
     vrButton: false,
     infoBox: true
  });
  
  viewer._cesiumWidget._creditContainer.style.display = "none"; // 去掉左下角的Cesium商标
  
  // 天地图访问密钥
  var MAP_KEY = TDT_TK;
  // 加载矢量底图
  // viewer.imageryLayers.addImageryProvider(new Cesium.WebMapTileServiceImageryProvider({
  //    url: "http://t{s}.tianditu.com/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=vec&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=" + MAP_KEY,
  //    layer: "tdtVecBasicLayer",
  //    style: "default",
  //    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
  //    format: "image/jpeg",
  //    tileMatrixSetID: "GoogleMapsCompatible"
  // }));
  // // 加载矢量注记
  // viewer.imageryLayers.addImageryProvider(new Cesium.WebMapTileServiceImageryProvider({
  //    url: "http://t{s}.tianditu.com/cva_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cva&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default.jpg&tk=" + MAP_KEY,
  //    layer: "tdtAnnoLayer",
  //    style: "default",
  //    format: "image/jpeg",
  //    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
  //    tileMatrixSetID: "GoogleMapsCompatible"
  // }));
  // 加载影像底图
  viewer.imageryLayers.addImageryProvider(new Cesium.WebMapTileServiceImageryProvider({
     url: "http://t{s}.tianditu.com/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=" + MAP_KEY,
     layer: "tdtBasicLayer",
     style: "default",
     format: "image/jpeg",
     subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
     tileMatrixSetID: "GoogleMapsCompatible"
  }));
  // 加载影像注记
  // viewer.imageryLayers.addImageryProvider(new Cesium.WebMapTileServiceImageryProvider({
  //    url: "http://t{s}.tianditu.com/cia_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cia&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default.jpg&tk=" + MAP_KEY,
  //    layer: "tdtAnnoLayer",
  //    style: "default",
  //    format: "image/jpeg",
  //    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
  //    tileMatrixSetID: "GoogleMapsCompatible"
  // }));
  // 加载三维地形
  // viewer.imageryLayers.addImageryProvider(new Cesium.WebMapTileServiceImageryProvider({
  //    url: "http://t0.tianditu.com/cia_w/swdx?service=swdx&request=GetTile&version=1.0.0&LAYER=cia&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default.jpg&tk=" + MAP_KEY,
  //    layer: "tdtAnnoLayer",
  //    style: "default",
  //    format: "image/jpeg",
  //    subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
  //    tileMatrixSetID: "GoogleMapsCompatible"
  // }));
  // 将三维球定位到中国
  viewer.camera.flyTo({
     destination: Cesium.Cartesian3.fromDegrees(103.84, 31.15, 17850000),
     orientation: {
         heading: Cesium.Math.toRadians(348.42),
         pitch: Cesium.Math.toRadians(-89.74),
         roll: Cesium.Math.toRadians(0)
     }
  });
});



</script>

<style scoped>
.cesium-container {
  position: relative;
  width: 100%;
  height: 100vh;
}

.map-controls {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(42, 42, 42, 0.9);
  color: white;
  padding: 15px;
  border-radius: 8px;
  z-index: 1000;
  min-width: 300px;
}

.map-controls h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #00d4ff;
}

.control-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-btn {
  padding: 8px 12px;
  background: #1e1e1e;
  color: white;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #00d4ff;
  color: #000;
  border-color: #00d4ff;
}

.control-btn:active {
  transform: translateY(1px);
}
</style>
