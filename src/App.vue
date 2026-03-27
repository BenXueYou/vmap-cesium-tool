<template>
  <div class="cesium-container">
    <div id="cesiumContainer"></div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from "vue";
import { useMapInit } from "./hooks/useMapInit.ts";

const { initMap, destroyMap } = useMapInit('cesiumContainer');

onMounted(() => {
  void initMap();
});

onBeforeUnmount(() => {
  destroyMap();
});
</script>

<style scoped>
.cesium-container {
  position: relative;
  width: 100%;
  height: 100vh;

  #cesiumContainer {
    width: 100%;
    height: 100%;
  }
}

.test-button-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1001;

  .action-row {
    display: flex;
  }
}

.action-select {
  min-width: 260px;
  max-width: 360px;
  height: 34px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fff;
  background: rgba(0, 0, 0, 0.52);
  outline: none;
}

.action-select option {
  color: #000;
}

.message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 15px 20px;
  border-radius: 5px;
  z-index: 1001;
  font-size: 16px;
  text-align: center;
  max-width: 80%;
  word-wrap: break-word;
}

/* 新框架演示控件样式 */
.demo-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1001;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  max-width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.control-group {
  margin-bottom: 16px;
}

.control-group h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.button-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.demo-btn {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: #007acc;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.demo-btn:hover {
  background: #0056b3;
  transform: translateY(-1px);
}

.demo-btn.danger {
  background: #dc3545;
}

.demo-btn.danger:hover {
  background: #c82333;
}

.info-panel {
  border-top: 1px solid #e0e0e0;
  padding-top: 12px;
}

.info-panel h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.info-panel ul {
  margin: 0;
  padding-left: 16px;
  list-style: none;
}

.info-panel li {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  line-height: 1.4;
}
</style>
