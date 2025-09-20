<template>
  <div class="cesium-container">
    <div
      id="cesiumContainer"
      ref="cesiumContainer"
      style="width: 100%; height: 100vh"
    ></div>

    <!-- 控制按钮 -->
    <div class="toolbar">
      <button @click="zoomIn">放大</button>
      <button @click="zoomOut">缩小</button>
      <button @click="setZoom(5)">缩放至5级</button>
      <button @click="setZoom(10)">缩放至10级</button>
      <button @click="addPoint">添加点位</button>
      <button @click="startDistanceMeasurement">测距</button>
      <button @click="startAreaMeasurement">测面</button>
      <button @click="toggle2D3D">{{ is3D ? "切换到2D" : "切换到3D" }}</button>
      <button @click="drawFrustum">绘制视锥体</button>
      <button @click="addOverlay">添加覆盖物</button>
      <button @click="drawVerticalLine">绘制垂直线</button>
      <button @click="setContainerSize('80%', '80vh')">设置容器大小</button>
      <button @click="clearAll">清除所有</button>
    </div>

    <!-- 提示信息 -->
    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount } from "vue";
import { CesiumMapTools, Cesium } from "../libs/CesiumMapHelper";

const message = ref("");
const is3D = ref(true);
let mapTools = null;

// 初始化地图
onMounted(async () => {
  try {
    const config = {
      containerId: "cesiumContainer",
      mapCenter: {
        longitude: 120.15507,
        latitude: 30.274085,
        height: 5000,
        pitch: -30,
        heading: 0
      },
      zoomLevels: [5000000, 2500000, 1250000, 650000, 300000, 150000, 70000, 35000, 18000, 9000, 4500, 2200, 1100],
      defaultZoom: 5,
      viewerOptions: {
        terrainShadows: Cesium.ShadowMode.ENABLED,
        scene3DOnly: false
      }
    };

    mapTools = new CesiumMapTools(config);
    await mapTools.initialize();
    
    message.value = "地图初始化完成";
    setTimeout(() => {
      message.value = "";
    }, 2000);

  } catch (error) {
    console.error("地图初始化失败:", error);
    message.value = "地图初始化失败: " + error.message;
  }
});

// 基础地图功能
const zoomIn = () => {
  if (mapTools) {
    mapTools.zoomIn();
  }
};

const zoomOut = () => {
  if (mapTools) {
    mapTools.zoomOut();
  }
};

const setZoom = (level) => {
  if (mapTools) {
    mapTools.setZoom(level);
  }
};

const toggle2D3D = () => {
  if (mapTools) {
    mapTools.toggle2D3D();
    is3D.value = !is3D.value;
  }
};

const setContainerSize = (width, height) => {
  if (mapTools) {
    mapTools.setContainerSize(width, height);
    message.value = `容器大小已设置为: ${width} x ${height}`;
    setTimeout(() => {
      message.value = "";
    }, 2000);
  }
};

// 点位功能
const addPoint = () => {
  if (mapTools) {
    const position = Cesium.Cartesian3.fromDegrees(120.16, 30.28, 100);
    mapTools.addPoint(position, {
      pixelSize: 12,
      color: Cesium.Color.BLUE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 3,
      showLabel: true,
      labelText: '示例点位',
      onClick: (pos, carto) => {
        const lng = Cesium.Math.toDegrees(carto.longitude).toFixed(6);
        const lat = Cesium.Math.toDegrees(carto.latitude).toFixed(6);
        message.value = `点位被点击: 经度=${lng}, 纬度=${lat}, 高度=${carto.height.toFixed(2)}m`;
        setTimeout(() => {
          message.value = "";
        }, 3000);
      }
    });
  }
};

// 测距功能
const startDistanceMeasurement = () => {
  if (mapTools) {
    mapTools.startDistanceMeasurement({
      width: 4,
      material: Cesium.Color.GREEN,
      showDistance: true,
      onClick: (positions, distance) => {
        message.value = `测量完成，距离: ${distance.toFixed(2)} 米`;
        setTimeout(() => {
          message.value = "";
        }, 3000);
      }
    });
  }
};

// 测面功能
const startAreaMeasurement = () => {
  if (mapTools) {
    mapTools.startAreaMeasurement({
      material: Cesium.Color.CYAN.withAlpha(0.3),
      outline: true,
      outlineColor: Cesium.Color.BLUE,
      outlineWidth: 2,
      showArea: true,
      onClick: (positions, area) => {
        message.value = `测量完成，面积: ${area.toFixed(2)} 平方米`;
        setTimeout(() => {
          message.value = "";
        }, 3000);
      }
    });
  }
};

// 视锥体功能
const drawFrustum = () => {
  if (mapTools) {
    const position = Cesium.Cartesian3.fromDegrees(120.16, 30.28, 1000);
    mapTools.drawFrustum({
      position: position,
      fov: 45,
      aspectRatio: 1.5,
      near: 10,
      far: 2000,
      fillColor: new Cesium.Color(0, 1, 0, 0.2),
      outlineColor: Cesium.Color.GREEN,
      onRightClick: (pos) => {
        message.value = "视锥体右键点击事件触发";
        setTimeout(() => {
          message.value = "";
        }, 2000);
      }
    });
  }
};

// 添加覆盖物
const addOverlay = () => {
  if (mapTools) {
    const position = Cesium.Cartesian3.fromDegrees(120.17, 30.27, 50);
    mapTools.addOverlay({
      position: position,
      type: 'label',
      label: {
        text: '示例覆盖物',
        font: '16px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3
      }
    });
    message.value = "覆盖物添加成功";
    setTimeout(() => {
      message.value = "";
    }, 2000);
  }
};

// 绘制垂直线
const drawVerticalLine = () => {
  if (mapTools) {
    const startPosition = Cesium.Cartesian3.fromDegrees(120.155, 30.274, 0);
    mapTools.drawVerticalLine({
      startPosition: startPosition,
      height: 500,
      width: 3,
      material: Cesium.Color.RED,
      showLabel: true
    });
    message.value = "垂直线绘制完成";
    setTimeout(() => {
      message.value = "";
    }, 2000);
  }
};

// 清理功能
const clearAll = () => {
  if (mapTools) {
    mapTools.clearAll();
    message.value = "已清除所有绘制内容";
    setTimeout(() => {
      message.value = "";
    }, 2000);
  }
};

// 清理资源
onBeforeUnmount(() => {
  if (mapTools) {
    mapTools.destroy();
  }
});
</script>

<style scoped>
.cesium-container {
  position: relative;
}

.toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 1000;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

button {
  padding: 8px 12px;
  font-size: 14px;
  border: none;
  background: #4285f4;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #3367d6;
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
</style>
