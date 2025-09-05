import { CesiumMapTools, MapToolsConfig, PointOptions, LineOptions, PolygonOptions, FrustumOptions, OverlayOptions, VerticalLineOptions } from './CesiumMapTools';

// 使用示例
export class CesiumMapToolsExample {
  private mapTools: CesiumMapTools;

  constructor(containerId: string) {
    const config: MapToolsConfig = {
      containerId: containerId,
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

    this.mapTools = new CesiumMapTools(config);
  }

  // 初始化地图
  async initialize(): Promise<void> {
    await this.mapTools.initialize();
    console.log('地图初始化完成');
  }

  // 示例：设置容器大小
  setContainerSize(width: string, height: string): void {
    this.mapTools.setContainerSize(width, height);
  }

  // 示例：缩放控制
  demoZoom(): void {
    this.mapTools.zoomIn();
    setTimeout(() => this.mapTools.zoomOut(), 1000);
  }

  // 示例：添加点位
  demoAddPoint(): void {
    const position = Cesium.Cartesian3.fromDegrees(120.16, 30.28, 100);
    const options: PointOptions = {
      pixelSize: 12,
      color: Cesium.Color.BLUE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 3,
      showLabel: true,
      labelText: '自定义点位',
      onClick: (pos, carto) => {
        console.log('点位被点击:', {
          longitude: Cesium.Math.toDegrees(carto.longitude),
          latitude: Cesium.Math.toDegrees(carto.latitude),
          height: carto.height
        });
      }
    };
    this.mapTools.addPoint(position, options);
  }

  // 示例：测距功能
  demoDistanceMeasurement(): void {
    const options: LineOptions = {
      width: 4,
      material: Cesium.Color.GREEN,
      showDistance: true,
      onClick: (positions, distance) => {
        console.log('测量线被点击，距离:', distance.toFixed(2), '米');
      }
    };
    this.mapTools.startDistanceMeasurement(options);
  }

  // 示例：测面功能
  demoAreaMeasurement(): void {
    const options: PolygonOptions = {
      material: Cesium.Color.CYAN.withAlpha(0.3),
      outline: true,
      outlineColor: Cesium.Color.BLUE,
      outlineWidth: 2,
      showArea: true,
      onClick: (positions, area) => {
        console.log('测量面被点击，面积:', area.toFixed(2), '平方米');
      }
    };
    this.mapTools.startAreaMeasurement(options);
  }

  // 示例：绘制视锥体
  demoDrawFrustum(): void {
    const position = Cesium.Cartesian3.fromDegrees(120.16, 30.28, 1000);
    const options: FrustumOptions = {
      position: position,
      fov: 45,
      aspectRatio: 1.5,
      near: 10,
      far: 2000,
      fillColor: new Cesium.Color(0, 1, 0, 0.2),
      outlineColor: Cesium.Color.GREEN,
      onRightClick: (pos) => {
        console.log('视锥体右键点击:', pos);
      }
    };
    this.mapTools.drawFrustum(options);
  }

  // 示例：添加覆盖物
  demoAddOverlay(): void {
    const position = Cesium.Cartesian3.fromDegrees(120.17, 30.27, 50);
    const options: OverlayOptions = {
      position: position,
      type: 'label',
      label: {
        text: '测试覆盖物',
        font: '16px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3
      }
    };
    this.mapTools.addOverlay(options);
  }

  // 示例：绘制垂直线
  demoDrawVerticalLine(): void {
    const startPosition = Cesium.Cartesian3.fromDegrees(120.155, 30.274, 0);
    const options: VerticalLineOptions = {
      startPosition: startPosition,
      height: 500,
      width: 3,
      material: Cesium.Color.RED,
      showLabel: true
    };
    this.mapTools.drawVerticalLine(options);
  }

  // 示例：切换2D/3D
  demoToggle2D3D(): void {
    this.mapTools.toggle2D3D();
  }

  // 清理所有
  clearAll(): void {
    this.mapTools.clearAll();
  }

  // 销毁
  destroy(): void {
    this.mapTools.destroy();
  }
}

// Vue组件使用示例
export const useCesiumMapTools = (containerId: string) => {
  const example = new CesiumMapToolsExample(containerId);

  return {
    initialize: () => example.initialize(),
    addPoint: () => example.demoAddPoint(),
    measureDistance: () => example.demoDistanceMeasurement(),
    measureArea: () => example.demoAreaMeasurement(),
    drawFrustum: () => example.demoDrawFrustum(),
    addOverlay: () => example.demoAddOverlay(),
    drawVerticalLine: () => example.demoDrawVerticalLine(),
    toggleView: () => example.demoToggle2D3D(),
    clear: () => example.clearAll(),
    destroy: () => example.destroy()
  };
};