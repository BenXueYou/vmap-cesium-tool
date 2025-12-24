import { ref, type Ref } from "vue";
import * as Cesium from "cesium";
import type { Entity } from "cesium";
import { CesiumOverlayService } from "../libs/overlay";

/**
 * 覆盖物相关的辅助逻辑
 * - 提供添加点位（Marker）与示例覆盖物的便捷方法
 * - 管理点位模式的事件处理及清理
 */
export function useOverlayHelper(
  viewer: Ref<Cesium.Viewer | undefined>,
  message: Ref<string>
) {
  const overlayService = ref<CesiumOverlayService | null>(null);
  const markerHandler = ref<Cesium.ScreenSpaceEventHandler | null>(null);
  const markerEntities: Entity[] = [];

  /**
   * 初始化覆盖物服务
   */
  const initOverlayService = () => {
    if (!viewer.value) return;
    overlayService.value = new CesiumOverlayService(viewer.value);
  };

  /**
   * 取消点位添加模式
   */
  const cancelMarkerMode = () => {
    if (markerHandler.value) {
      markerHandler.value.destroy();
      markerHandler.value = null;
    }
    message.value = "";
  };

  /**
   * 添加点位 - 点击地图添加标记点
   */
  const addMarker = () => {
    if (!viewer.value || !overlayService.value) return;

    // 如果已经有点位添加模式，先取消
    if (markerHandler.value) {
      cancelMarkerMode();
      return;
    }

    message.value = "点击地图添加标记点，右键取消";

    // 创建点击事件处理器
    markerHandler.value = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas);

    // 左键点击添加标记点
    markerHandler.value.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!viewer.value || !overlayService.value) return;

      const cartesian = viewer.value.camera.pickEllipsoid(
        click.position,
        viewer.value.scene.globe.ellipsoid
      );

      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);

        const marker = overlayService.value.addMarker({
          position: [longitude, latitude, 500],
          pixelSize: 15,
          color: Cesium.Color.RED,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          onClick: (entity) => {
            console.log("标记点被点击:", entity);
            message.value = `标记点位置: ${longitude.toFixed(6)}, ${latitude.toFixed(6)}`;
            setTimeout(() => {
              message.value = "点击地图添加标记点，右键取消";
            }, 2000);
          },
        });

        markerEntities.push(marker);
        message.value = `已添加标记点: ${longitude.toFixed(6)}, ${latitude.toFixed(6)}`;
        setTimeout(() => {
          message.value = "点击地图添加标记点，右键取消";
        }, 2000);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 右键取消点位添加模式
    markerHandler.value.setInputAction(() => {
      cancelMarkerMode();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  };

  /**
   * 添加一个中心点（带标签）的示例标记
   */
  const addMarkerWithLabel = () => {
    if (!viewer.value || !overlayService.value) return;
    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    const marker = overlayService.value.addMarker({
      position: [lon + 0.01, lat + 0.01],
      pixelSize: 12,
      color: Cesium.Color.BLUE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      onClick: () => console.log('示例标记点被点击'),
    });

    overlayService.value.addLabel({
      position: [lon + 0.01, lat + 0.01],
      text: '示例标记点',
      font: '16px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      pixelOffset: new Cesium.Cartesian2(0, -30),
      showBackground: true,
      backgroundColor: Cesium.Color.BLUE.withAlpha(0.7),
      backgroundPadding: new Cesium.Cartesian2(8, 4),
    });

    markerEntities.push(marker);
    message.value = '已添加示例标记点';
    setTimeout(() => (message.value = ''), 2000);
  };

  /**
   * 添加图标
   */
  const addIcon = () => {
    if (!viewer.value || !overlayService.value) return;
    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);
    debugger;
    const icon = overlayService.value.addIcon({
      position: [lon - 0.01, lat + 0.01, 200],
      image:
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTQiIGZpbGw9IiNGRjAwMDAiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik04IDJMMTAuNSA2SDEzLjVMOS41IDEwTDEwLjUgMTRMOCAxMkw1LjUgMTRMNi41IDEwTDMgNkg1LjVMOCAyWiIgZmlsbD0iI0ZGRiIvPgo8L3N2Zz4KPC9zdmc+',
      width: 32,
      height: 32,
      scale: 1.0,
      onClick: () => {
        console.log('示例图标被点击');
        message.value = '示例图标被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(icon);
    message.value = '已添加图标';
    setTimeout(() => (message.value = ''), 2000);
  };

  /**
   * 添加 SVG 图标
   */
  const addSvg = () => {
    if (!viewer.value || !overlayService.value) return;
    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    const svg = overlayService.value.addSvg({
      position: [lon, lat + 0.02],
      svg: `
        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="18" fill="#28A745" stroke="#fff" stroke-width="2"/>
          <text x="20" y="26" font-size="20" fill="white" text-anchor="middle">✓</text>
        </svg>
      `,
      width: 40,
      height: 40,
      onClick: () => {
        console.log('示例SVG被点击');
        message.value = '示例SVG被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(svg);
    message.value = '已添加SVG图标';
    setTimeout(() => (message.value = ''), 2000);
  };

  /**
   * 添加折线示例（与 addLine 类似，暴露给外部为 addPolyline）
   */
  const addPolyline = () => {
    if (!viewer.value || !overlayService.value) return;
    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    const polyline = overlayService.value.addPolyline({
      positions: [
        [lon - 0.02, lat],
        [lon - 0.01, lat + 0.01],
        [lon, lat + 0.01],
        [lon + 0.01, lat],
      ],
      width: 3,
      material: Cesium.Color.YELLOW,
      clampToGround: true,
      onClick: () => {
        console.log('示例折线被点击');
        message.value = '示例折线被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(polyline);
    message.value = '已添加折线';
    setTimeout(() => (message.value = ''), 2000);
  };

  /**
   * 添加矩形
   */
  const addRectangle = () => {
    if (!viewer.value || !overlayService.value) return;
    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    const rect = Cesium.Rectangle.fromDegrees(lon - 0.025, lat - 0.015, lon - 0.02, lat - 0.01);
    const rectangle = overlayService.value.addRectangle({
      coordinates: rect,
      // material: Cesium.Color.ORANGE.withAlpha(0.5),
      material: Cesium.Color.RED.withAlpha(0.5),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 2,
      onClick: () => {
        console.log('示例矩形被点击');
        message.value = '示例矩形被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(rectangle);
    message.value = '已添加矩形';
    setTimeout(() => (message.value = ''), 2000);
  };

  /**
   * 添加信息窗口
   */
  const addInfoWindow = () => {
    if (!viewer.value || !overlayService.value) return;
    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);
    let infoA: Entity;
    // Example A: 使用 anchorPixel（优先） + updateInterval 测试节流与相机移动期间绕过节流
    const markerA = overlayService.value.addMarker({
      position: [lon, lat],
      pixelSize: 16,
      color: Cesium.Color.ORANGE,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      onClick: (entity) => {
        infoA.show = !infoA.show;
        console.log('Marker A 被点击');
      },
    });

    infoA = overlayService.value.addInfoWindow({
      position: [lon, lat],
      content: `
        <div style="padding: 10px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px;">示例信息窗口 (anchorPixel)</h3>
          <p style="margin: 0; font-size: 14px; color: #666;">
            使用 <strong>anchorPixel</strong>（像素锚点）并设置 <code>updateInterval: 200</code>。
            拖动/缩放地图时应实时跟随（节流在移动时会被绕过）。
          </p>
        </div>
      `,
      width: 260,
      // pixelOffset: new Cesium.Cartesian2(0, 10),
      anchorPixel: 18,
      tailGap: 24,
      showArrow: true,
      arrowSize: 10,
      positionOffset: 'top',
      updateInterval: 200, // ms
      hideWhenOutOfView: true,
      show: true,
      closable: true,
      onClick: () => {
        console.log('Info A clicked');
        message.value = 'Info A clicked';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(markerA, infoA);
    message.value = '已添加两个信息窗口（anchorPixel / anchorHeight）以供测试';
    setTimeout(() => (message.value = ''), 3000);
  };
  /**
   * 添加折线（示例 / 辅助方法）
   */
  const addLine = () => {
    if (!viewer.value || !overlayService.value) return;

    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    const polyline = overlayService.value.addPolyline({
      positions: [
        [lon - 0.02, lat - 0.005],
        [lon - 0.01, lat + 0.01],
        [lon + 0.01, lat],
      ],
      width: 4,
      material: Cesium.Color.RED,
      clampToGround: true,
      onClick: () => {
        console.log('折线被点击');
        message.value = '折线被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(polyline);
    message.value = '已添加折线';
    setTimeout(() => (message.value = ''), 2000);
  };

  /**
   * 添加区域（多边形）
   */
  const addArea = () => {
    if (!viewer.value || !overlayService.value) return;

    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    const polygon = overlayService.value.addPolygon({
      positions: [
        [lon - 0.01, lat - 0.01],
        [lon + 0.01, lat - 0.01],
        [lon + 0.015, lat + 0.005],
        [lon - 0.005, lat + 0.01],
      ],
      material: Cesium.Color.BLUE.withAlpha(0.4),
      outline: true,
      outlineColor: Cesium.Color.BLUE,
      outlineWidth: 2,
      onClick: () => {
        console.log('区域被点击');
        message.value = '区域被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(polygon);
    message.value = '已添加区域';
    setTimeout(() => (message.value = ''), 2000);
  };

  /**
   * 添加圆形
   */
  const addCircle = () => {
    if (!viewer.value || !overlayService.value) return;

    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    // 圆形 A：演示粗边框（双层椭圆环：outlineWidth>1 即触发）
    const circleA = overlayService.value.addCircle({
      position: [lon + 0.012, lat - 0.01],
      radius: 600,
      material: Cesium.Color.fromCssColorString('#b71c1c').withAlpha(0.4), // 填充色
      outline: true,                                  // 开启边框（用于颜色）
      outlineColor: Cesium.Color.fromCssColorString('#d32f2f'),              // 边框颜色
      outlineWidth: 20,                               // >1 触发双层椭圆环（米为单位）
      onClick: () => {
        console.log('圆形 A 被点击');
        message.value = '圆形 A 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(circleA);
    message.value = '已添加两个粗边框圆形（双层椭圆环效果）';
    setTimeout(() => (message.value = ''), 2200);
  };

  /**
   * 添加多边形（示例 / 辅助方法）
   */
  const addPolygon = () => {
    if (!viewer.value || !overlayService.value) return;

    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    const poly = overlayService.value.addPolygon({
      positions: [
        [lon - 0.015, lat - 0.01],
        [lon - 0.005, lat - 0.01],
        [lon, lat - 0.005],
        [lon - 0.005, lat + 0.005],
        [lon - 0.015, lat],
      ],
      material: Cesium.Color.RED.withAlpha(0.5),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 2,
      onClick: () => {
        console.log('多边形被点击');
        message.value = '多边形被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(poly);
    message.value = '已添加多边形';
    setTimeout(() => (message.value = ''), 2000);
  };

  /**
   * 销毁覆盖物服务及相关资源
   */
  const destroyOverlayService = () => {
    cancelMarkerMode();
    if (overlayService.value) {
      overlayService.value.destroy();
      overlayService.value = null;
    }
    if (viewer.value) {
      markerEntities.forEach((entity) => {
        viewer.value!.entities.remove(entity);
      });
    }
    markerEntities.length = 0;
  };

  return {
    overlayService,
    initOverlayService,
    addMarker,
    addMarkerWithLabel,
    addLabel: (options: any) => {
      if (!overlayService.value) return;
      overlayService.value.addLabel(options);
    },
    addIcon,
    addSvg,
    addPolyline,
    addLine,
    addArea,
    addCircle,
    addPolygon,
    addRectangle,
    addInfoWindow,
    cancelMarkerMode,
    destroyOverlayService,
  };
}

