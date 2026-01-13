import { ref, type Ref } from "vue";
import * as Cesium from "cesium";
import type { Entity } from "cesium";
import type { OverlayEntity } from '../libs/overlay/types';
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
  const addIcon = (coords?: { longitude: number; latitude: number }) => {
    const { longitude, latitude } = coords || {};
    if (!viewer.value || !overlayService.value) return;
    const center = viewer.value.camera.positionCartographic;
    const lon = longitude || Cesium.Math.toDegrees(center.longitude);
    const lat = latitude || Cesium.Math.toDegrees(center.latitude);
    const icon = overlayService.value.addIcon({
      position: [lon, lat, 200],
      image:
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTQiIGZpbGw9IiNGRjAwMDAiLz4KPHN2ZyB4PSI4IiB5PSI4IiB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSI+CjxwYXRoIGQ9Ik04IDJMMTAuNSA2SDEzLjVMOS41IDEwTDEwLjUgMTRMOCAxMkw1LjUgMTRMNi41IDEwTDMgNkg1LjVMOCAyWiIgZmlsbD0iI0ZGRiIvPgo8L3N2Zz4KPC9zdmc+',
      width: 32,
      height: 32,
      scale: 1.0,
      disableDepthTestDistance: 100, // 禁用深度测试距离
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
  const addSvg = (coords?: { longitude: number; latitude: number }) => {
    const { longitude, latitude } = coords || {};
    if (!viewer.value || !overlayService.value) return;
    const center = viewer.value.camera.positionCartographic;
    const lon = longitude || Cesium.Math.toDegrees(center.longitude);
    const lat = latitude || Cesium.Math.toDegrees(center.latitude);
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

    // Test A: 非粗边框默认贴地（outlineWidth=2 仍是普通 outline，不是粗边框方案）
    const rectA = Cesium.Rectangle.fromDegrees(lon - 0.025, lat - 0.015, lon - 0.02, lat - 0.01);
    const rectangleA = overlayService.value.addRectangle({
      coordinates: rectA,
      material: Cesium.Color.RED.withAlpha(0.5),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 2,
      // clampToGround 默认 true（这里不传，验证默认行为）
      onClick: () => {
        console.log('矩形 A(贴地) 被点击');
        message.value = '矩形 A(贴地) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    // Test B: 显式悬空（clampToGround=false + height）
    const rectB = Cesium.Rectangle.fromDegrees(lon - 0.018, lat - 0.015, lon - 0.013, lat - 0.01);
    const rectangleB = overlayService.value.addRectangle({
      coordinates: rectB,
      material: Cesium.Color.ORANGE.withAlpha(0.35),
      outline: true,
      outlineColor: Cesium.Color.ORANGE,
      outlineWidth: 2,
      clampToGround: false,
      height: 500,
      onClick: () => {
        console.log('矩形 B(悬空) 被点击');
        message.value = '矩形 B(悬空) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(rectangleA, rectangleB);
    message.value = '已添加矩形：A贴地(默认) / B悬空(clampToGround=false,height=500)';
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
        console.log('折线被点击', polyline);
        message.value = '折线被点击';
        overlayService.value!.setOverlayVisible(polyline.id, false); // 切换所有覆盖物的显示状态
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

    // Test A: 非粗边框默认贴地（clampToGround 默认 true）
    const polygonA = overlayService.value.addPolygon({
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
        console.log('区域 A(贴地) 被点击');
        message.value = '区域 A(贴地) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    // Test B: 显式悬空（clampToGround=false + positions 带高度）
    const polygonB = overlayService.value.addPolygon({
      positions: [
        [lon + 0.02, lat - 0.01, 500],
        [lon + 0.04, lat - 0.01, 500],
        [lon + 0.045, lat + 0.005, 500],
        [lon + 0.025, lat + 0.01, 500],
      ],
      material: Cesium.Color.CYAN.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.CYAN,
      outlineWidth: 2,
      clampToGround: false,
      onClick: () => {
        console.log('区域 B(悬空) 被点击');
        message.value = '区域 B(悬空) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(polygonA, polygonB);
    message.value = '已添加区域：A贴地(默认) / B悬空(clampToGround=false,height=500)';
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

    // Test A: 粗边框默认贴地（outlineWidth>1 触发粗边框方案）
    const circleA = overlayService.value.addCircle({
      position: [120.09747987, 30.12573937],
      radius: 2635.9,
      material: Cesium.Color.fromCssColorString('#b71c1c').withAlpha(0.4), // 填充色
      outline: true,                                  // 开启边框（用于颜色）
      outlineColor: Cesium.Color.fromCssColorString('#d32f2f'),              // 边框颜色
      outlineWidth: 20,                               // >1 触发双层椭圆环（米为单位）
      segments: 512,
      clickHighlight: true,
      // clampToGround 默认 true（这里不传，验证默认行为）
      onClick: () => {
        const circleOverlay = circleA as OverlayEntity;
        console.log('圆形 A 被点击=', circleOverlay);
        console.log('圆形 A 被点击=', circleOverlay.id);
        console.log('圆形 A 被点击=', circleOverlay._innerEntity?.id);
        message.value = '圆形 A 被点击';
        // circleA.show = !circleA.show;
        // circleA._innerEntity.show = !circleA._innerEntity.show;
        // overlayService.value!.setOverlayVisible(circleA.id, false); 
        // overlayService.value!.setOverlayVisible(circleA._innerEntity.id, false); 
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    addIcon({ longitude: 120.09747987, latitude: 30.12573937 });

    // Test B: 非粗边框默认贴地（outlineWidth=1）
    const circleB = overlayService.value.addCircle({
      position: [lon + 0.02, lat, 800], // 即便传高度，贴地默认会归零
      radius: 1200,
      material: Cesium.Color.YELLOW.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
      outlineWidth: 1,
      clickHighlight: {
        color: Cesium.Color.ORANGE,
        fillAlpha: 0.5,
      },
      onClick: () => {
        message.value = '圆形 B(贴地默认) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    addIcon({ longitude: lon + 0.02, latitude: lat });

    // Test C: 非粗边框显式悬空（clampToGround=false + position 带高度）
    const circleC = overlayService.value.addCircle({
      position: [lon - 0.02, lat, 1000],
      radius: 1000,
      material: Cesium.Color.LIME.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.LIME,
      outlineWidth: 1,
      clampToGround: false,
      clickHighlight: true,
      onClick: () => {
        message.value = '圆形 C(悬空) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    addIcon({ longitude: lon - 0.02, latitude: lat });

    markerEntities.push(circleA, circleB, circleC);
    message.value = '已添加圆形：A粗边框贴地(默认) / B普通贴地(默认) / C普通悬空(clampToGround=false,height=1000)';
    setTimeout(() => (message.value = ''), 2200);
  };

  /**
   * 添加发光圆环（MapRing）
   */
  const addRing = (i?: number) => {
    if (!viewer.value || !overlayService.value) return;

    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude) + (isNaN(i ?? 0) ? 0 : Number(i ?? 0)) * 0.0001;
    const lat = Cesium.Math.toDegrees(center.latitude) + (isNaN(i ?? 0) ? 0 : Number(i ?? 0)) * 0.0001;
    debugger;
    const ring = overlayService.value.addRing({
      position: [lon, lat, 0],
      radius: 150,
      color: Cesium.Color.RED,
      lineColor: Cesium.Color.RED.withAlpha(0.8),
      lineStyle: 'dashed',
      lineMaterialMode: 'stripe',
      stripeRepeat: 40,
      glowWidth: 14,
      lineWidth: 6,
      glowPower: 0.35,
      clampToGround: true,
      gapColor: Cesium.Color.BLUE.withAlpha(0.3),
      segments: 128,
      onClick: (entity) => {
        console.log('发光圆环被点击:', entity);
        message.value = '发光圆环被点击';
        // 演示：点击后短暂隐藏再显示
        overlayService.value!.setOverlayVisible(entity.id, false);
        setTimeout(() => {
          overlayService.value!.setOverlayVisible(entity.id, true);
          message.value = '';
        }, 800);
      },
    });

    markerEntities.push(ring);
    message.value = '已添加发光圆环';
    setTimeout(() => (message.value = ''), 2000);
    return ring;
  };

  /**
   * 添加多边形（示例 / 辅助方法）
   */
  const addPolygon = () => {
    if (!viewer.value || !overlayService.value) return;

    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);

    // Test A: 粗边框默认贴地（outlineWidth>1）
    const polyA = overlayService.value.addPolygon({
      // positions: [
      //   [lon - 0.015, lat - 0.01],
      //   [lon - 0.005, lat - 0.01],
      //   [lon, lat - 0.005],
      // ],
      // positions: [
      //   [120.18965632598375, 29.965010101455256], 
      //   [120.21315165524578, 29.965098259065662], 
      //   [120.18965915933653, 29.950994372532026], 
      //   [120.1781605071513, 29.955780181296227], 
      // ],
      positions: [[120.19619413234396, 30.186834775221342], [120.19751133777739, 30.186779919361378], [120.19641969581805, 30.186125462043783], [120.19641969581805, 30.186125462043783]],
      // 预期：填充为半透明橙色，边框为不透明橙色
      material: Cesium.Color.ORANGE.withAlpha(0.5),
      outline: true,
      outlineColor: Cesium.Color.ORANGE,
      outlineWidth: 10,
      onClick: () => {
        console.log('多边形 A(粗边框贴地) 被点击');
        message.value = '多边形 A(粗边框贴地) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    // Test B: 粗边框显式悬空（clampToGround=false + positions 带高度）
    const polyB = overlayService.value.addPolygon({
      positions: [
        [lon - 0.03, lat + 0.02, 500],
        [lon - 0.015, lat + 0.02, 500],
        [lon - 0.015, lat + 0.03, 500],
        [lon - 0.03, lat + 0.03, 500],
      ],
      material: Cesium.Color.PURPLE.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.PURPLE,
      outlineWidth: 10,
      clampToGround: false,
      onClick: () => {
        console.log('多边形 B(粗边框悬空) 被点击');
        message.value = '多边形 B(粗边框悬空) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(polyA, polyB);
    message.value = '已添加多边形：A粗边框贴地(默认) / B粗边框悬空(clampToGround=false,height=500)';
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
    addRing,
    addPolygon,
    addRectangle,
    addInfoWindow,
    cancelMarkerMode,
    destroyOverlayService,
  };
}

