import { CesiumMapTools } from './CesiumMapTools';

/**
 * 地图工具插件测试函数
 */
export async function testCesiumMapTools(containerId: string = 'cesiumContainer') {
  console.log('开始测试 CesiumMapTools...');

  try {
    // 创建地图工具实例
    const config = {
      containerId: containerId,
      mapCenter: {
        longitude: 120.15507,
        latitude: 30.274085,
        height: 5000,
        pitch: -30,
        heading: 0
      },
      zoomLevels: [5000000, 2500000, 1250000, 650000, 300000, 150000, 70000, 35000, 18000, 9000, 4500, 2200, 1100],
      defaultZoom: 5
    };

    const mapTools = new CesiumMapTools(config);
    
    // 初始化地图
    console.log('初始化地图...');
    await mapTools.initialize();
    console.log('地图初始化成功');

    // 测试基础功能
    console.log('测试基础功能...');
    
    // 测试缩放功能
    setTimeout(() => {
      console.log('测试缩放功能...');
      mapTools.zoomIn();
      setTimeout(() => mapTools.zoomOut(), 1000);
    }, 2000);

    // 测试点位功能
    setTimeout(() => {
      console.log('测试点位功能...');
      const position = Cesium.Cartesian3.fromDegrees(120.16, 30.28, 100);
      mapTools.addPoint(position, {
        pixelSize: 12,
        color: Cesium.Color.BLUE,
        onClick: (pos, carto) => {
          console.log('点位点击事件:', {
            longitude: Cesium.Math.toDegrees(carto.longitude),
            latitude: Cesium.Math.toDegrees(carto.latitude),
            height: carto.height
          });
        }
      });
    }, 4000);

    // 测试测距功能
    setTimeout(() => {
      console.log('测试测距功能...');
      mapTools.startDistanceMeasurement({
        width: 4,
        material: Cesium.Color.GREEN,
        onClick: (positions, distance) => {
          console.log('测距完成，距离:', distance.toFixed(2), '米');
        }
      });
    }, 6000);

    // 测试测面功能
    setTimeout(() => {
      console.log('测试测面功能...');
      mapTools.startAreaMeasurement({
        material: Cesium.Color.CYAN.withAlpha(0.3),
        onClick: (positions, area) => {
          console.log('测面完成，面积:', area.toFixed(2), '平方米');
        }
      });
    }, 8000);

    // 测试视锥体功能
    setTimeout(() => {
      console.log('测试视锥体功能...');
      const position = Cesium.Cartesian3.fromDegrees(120.16, 30.28, 1000);
      mapTools.drawFrustum({
        position: position,
        fov: 45,
        onRightClick: (pos) => {
          console.log('视锥体右键点击:', pos);
        }
      });
    }, 10000);

    // 测试覆盖物功能
    setTimeout(() => {
      console.log('测试覆盖物功能...');
      const position = Cesium.Cartesian3.fromDegrees(120.17, 30.27, 50);
      mapTools.addOverlay({
        position: position,
        type: 'label',
        label: {
          text: '测试覆盖物',
          font: '16px sans-serif',
          fillColor: Cesium.Color.YELLOW
        }
      });
    }, 12000);

    // 测试垂直线功能
    setTimeout(() => {
      console.log('测试垂直线功能...');
      const startPosition = Cesium.Cartesian3.fromDegrees(120.155, 30.274, 0);
      mapTools.drawVerticalLine({
        startPosition: startPosition,
        height: 500,
        material: Cesium.Color.RED,
        showLabel: true
      });
    }, 14000);

    // 测试容器大小设置
    setTimeout(() => {
      console.log('测试容器大小设置...');
      mapTools.setContainerSize('90%', '90vh');
    }, 16000);

    // 测试清理功能
    setTimeout(() => {
      console.log('测试清理功能...');
      mapTools.clearAll();
      console.log('所有内容已清理');
    }, 18000);

    console.log('测试将在20秒内完成所有功能测试');

    return mapTools;

  } catch (error) {
    console.error('测试失败:', error);
    throw error;
  }
}

// 导出测试函数
export default testCesiumMapTools;