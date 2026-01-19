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
  const lastRectangleB = ref<Entity | null>(null);
  const lastRectangleE = ref<Entity | null>(null);

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
          hoverHighlight: true,
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
      hoverHighlight: true,
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
      hoverHighlight: true,
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
      hoverHighlight: true,
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
      hoverHighlight: true,
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

    // Test A: primitive ✅（粗边框 + 贴地 + 纯色材质）
    const rectA = Cesium.Rectangle.fromDegrees(lon - 0.03, lat - 0.015, lon - 0.022, lat - 0.008);
    const rectangleA = overlayService.value.addRectangle({
      coordinates: rectA,
      material: Cesium.Color.RED.withAlpha(0.45),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 20, // >1：粗边框（米）
      hoverHighlight: { color: '#0be967ff', fillAlpha: 0.35 },
      clickHighlight: { color: '#ffee58', fillAlpha: 0.35 },
      renderMode: 'primitive',
      // clampToGround 默认 true（这里不传，验证默认行为）
      onClick: () => {
        logRectangle('A(click)', rectangleA);
        message.value = '矩形 A(primitive, 粗边框贴地) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logRectangle('A(init)', rectangleA);

    // Test F: primitive ✅ 分层叠加（detect vs alarm）
    // 预期：两个矩形填充都可见，且边框不会被其他 fill 盖住。
    const rectFDetect = Cesium.Rectangle.fromDegrees(lon - 0.029, lat - 0.0145, lon - 0.021, lat - 0.0085);
    const rectangleFDetect = overlayService.value.addRectangle({
      coordinates: rectFDetect,
      material: Cesium.Color.BLUE.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.BLUE,
      outlineWidth: 18,
      renderMode: 'primitive',
      layerKey: 'detect',
      hoverHighlight: true,
    });

    const rectFAlarm = Cesium.Rectangle.fromDegrees(lon - 0.0275, lat - 0.013, lon - 0.0195, lat - 0.0095);
    const rectangleFAlarm = overlayService.value.addRectangle({
      coordinates: rectFAlarm,
      material: Cesium.Color.RED.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 18,
      renderMode: 'primitive',
      layerKey: 'alarm',
      hoverHighlight: true,
    });

    // Test B: primitive ❌（非粗边框：outlineWidth<=1，会回退到 entity rectangle）
    const rectB = Cesium.Rectangle.fromDegrees(lon - 0.02, lat - 0.015, lon - 0.014, lat - 0.008);
    const rectangleB = overlayService.value.addRectangle({
      coordinates: rectB,
      material: Cesium.Color.YELLOW.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
      outlineWidth: 1,
      hoverHighlight: true,
      renderMode: 'primitive',
      onClick: () => {
        logRectangle('B(click)', rectangleB);
        message.value = '矩形 B(fallback, 非粗边框) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logRectangle('B(init)', rectangleB);
    lastRectangleB.value = rectangleB;

    // Test C: primitive ❌（显式悬空 clampToGround=false，会回退到 entity rectangle）
    const rectC = Cesium.Rectangle.fromDegrees(lon - 0.012, lat - 0.015, lon - 0.006, lat - 0.008);
    const rectangleC = overlayService.value.addRectangle({
      coordinates: rectC,
      material: Cesium.Color.ORANGE.withAlpha(0.35),
      outline: true,
      outlineColor: Cesium.Color.ORANGE,
      outlineWidth: 12,
      clampToGround: false,
      height: 500,
      renderMode: 'primitive',
      hoverHighlight: true,
      onClick: () => {
        logRectangle('C(click)', rectangleC);
        message.value = '矩形 C(fallback, 悬空) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logRectangle('C(init)', rectangleC);

    // Test D: auto ✅（粗边框 + 贴地 + 纯色材质，auto 应自动切 primitive）
    const rectD = Cesium.Rectangle.fromDegrees(lon + 0.005, lat - 0.015, lon + 0.013, lat - 0.008);
    const rectangleD = overlayService.value.addRectangle({
      coordinates: rectD,
      material: '#1815c093',
      outline: true,
      outlineColor: '#2519d2ff',
      outlineWidth: 16,
      hoverHighlight: true,
      renderMode: 'auto',
      onClick: () => {
        logRectangle('D(click)', rectangleD);
        message.value = '矩形 D(auto -> primitive) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logRectangle('D(init)', rectangleD);

    // Test E: primitive ❌（非纯色材质，会回退到 entity）
    const rectE = Cesium.Rectangle.fromDegrees(lon + 0.015, lat - 0.015, lon + 0.023, lat - 0.008);
    const rectangleE = overlayService.value.addRectangle({
      coordinates: rectE,
      material: new Cesium.StripeMaterialProperty({
        evenColor: Cesium.Color.RED.withAlpha(0.35),
        oddColor: Cesium.Color.RED.withAlpha(0.35),
        repeat: 8,
      }),
      outline: true,
      outlineColor: Cesium.Color.RED.withAlpha(0.8),
      outlineWidth: 14,
      clampToGround: true,
      renderMode: 'primitive',
      hoverHighlight: { color: '#0be967ff', fillAlpha: 0.35 },
      clickHighlight: { color: '#ffee58', fillAlpha: 0.35 },
      onClick: () => {
        logRectangle('E(click)', rectangleE);
        message.value = '矩形 E(fallback, 非纯色材质) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logRectangle('E(init)', rectangleE);
    lastRectangleE.value = rectangleE;

    markerEntities.push(rectangleA, rectangleB, rectangleC, rectangleD, rectangleE, rectangleFDetect, rectangleFAlarm);
    message.value = '已添加矩形：A primitive粗边框贴地 / B fallback非粗边框 / C fallback悬空 / D auto->primitive / E fallback非纯色材质 / F 分层叠加';
    setTimeout(() => (message.value = ''), 2400);

    // Quick check: visible toggle（primitive/entity 都应该正常生效）
    setTimeout(() => {
      overlayService.value!.setOverlayVisible(rectangleA.id, false);
      overlayService.value!.setOverlayVisible(rectangleD.id, false);
      setTimeout(() => {
        overlayService.value!.setOverlayVisible(rectangleA.id, true);
        overlayService.value!.setOverlayVisible(rectangleD.id, true);
      }, 800);
    }, 900);

    // Quick check: remove（验证 primitive/entity 的 removeOverlay 兼容）
    setTimeout(() => {
      overlayService.value!.removeOverlay(rectangleC.id);
    }, 2600);

    // Quick check: highlight APIs
    setTimeout(() => {
      // 显式高亮（click reason）
      overlayService.value!.setOverlayHighlight(rectangleB.id, true);
      // 2s 后取消高亮
      setTimeout(() => {
        overlayService.value!.setOverlayHighlight(rectangleB.id, false);
      }, 2000);
    }, 3000);

    setTimeout(() => {
      // toggle 高亮（click reason）
      overlayService.value!.toggleOverlayHighlight(rectangleE as any);
      setTimeout(() => {
        overlayService.value!.toggleOverlayHighlight(rectangleE as any);
      }, 2000);
    }, 5600);
  };

  /**
   * 显式高亮测试（setOverlayHighlight）
   */
  const testSetOverlayHighlight = () => {
    if (!overlayService.value) return;
    if (!lastRectangleB.value) {
      message.value = '请先添加矩形（RectB）';
      setTimeout(() => (message.value = ''), 1500);
      return;
    }
    overlayService.value.setOverlayHighlight(lastRectangleB.value.id as any, true, 'hover');
    setTimeout(() => {
      overlayService.value!.setOverlayHighlight(lastRectangleB.value!.id as any, false, 'hover');
    }, 2000);
  };

  /**
   * 切换高亮测试（toggleOverlayHighlight）
   */
  const testToggleOverlayHighlight = () => {
    if (!overlayService.value) return;
    if (!lastRectangleE.value) {
      message.value = '请先添加矩形（RectE）';
      setTimeout(() => (message.value = ''), 1500);
      return;
    }
    overlayService.value.toggleOverlayHighlight(lastRectangleE.value as any);
    setTimeout(() => {
      overlayService.value!.toggleOverlayHighlight(lastRectangleE.value as any);
    }, 2000);
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
      hoverHighlight: true,
      outlineColor: Cesium.Color.BLUE,
      outlineWidth: 2,
      onClick: () => {
        console.log('区域 A(贴地) 被点击');
        message.value = '区域 A(贴地) 被点击';
        logPolygon('区域 A(贴地) 被点击', polygonA);
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
      hoverHighlight: true,
      clampToGround: false,
      onClick: () => {
        console.log('区域 B(悬空) 被点击');
        message.value = '区域 B(悬空) 被点击';
        logPolygon('区域 B(悬空) 被点击', polygonB);
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    markerEntities.push(polygonA, polygonB);
    message.value = '已添加区域：A贴地(默认) / B悬空(clampToGround=false,height=500)';
    setTimeout(() => (message.value = ''), 2000);
  };

  const logOverlayBase = (prefix: 'Circle' | 'Polygon' | 'Rectangle', tag: string, e: Entity, extra?: Record<string, any>) => {
    const oe = e as OverlayEntity;
    console.log(`[${prefix}Test] ${tag}`, {
      id: oe.id,
      overlayType: oe._overlayType,
      show: oe.show,
      ...(extra || {}),
    });
  };

  const logCircle = (tag: string, e: Entity) => {
    const oe = e as OverlayEntity;
    logOverlayBase('Circle', tag, e, {
      isRing: oe._isRing,
      innerId: oe._innerEntity?.id,
      primitiveLayerKey: (oe as any)._primitiveLayerKey,
    });
  };

  const logPolygon = (tag: string, e: Entity) => {
    const oe = e as OverlayEntity;
    const anyE = oe as any;
    logOverlayBase('Polygon', tag, e, {
      borderId: anyE._borderEntity?.id,
      isThickOutline: anyE._isThickOutline,
      outlineWidth: anyE._outlineWidth,
    });
  };

  const logRectangle = (tag: string, e: Entity) => {
    const oe = e as OverlayEntity;
    logOverlayBase('Rectangle', tag, e, {
      isRing: oe._isRing,
      innerId: oe._innerEntity?.id,
      ringThickness: oe._ringThickness,
    });
  };
  /**
   * 添加圆形
   */
  const addCircle = () => {
    if (!viewer.value || !overlayService.value) return;

    const center = viewer.value.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(center.longitude);
    const lat = Cesium.Math.toDegrees(center.latitude);


    // Test A: primitive ✅（粗边框 + 贴地 + 纯色材质）
    const circleA = overlayService.value.addCircle({
      position: [120.09747987, 30.12573937],
      radius: 2635.9,
      material: Cesium.Color.fromCssColorString('#b71c1c').withAlpha(0.4), // 填充色（纯 Color）
      outline: true,                                  // 开启边框（用于颜色）
      outlineColor: '#d32f2f',              // 边框颜色
      outlineWidth: 20,                               // >1 触发双层椭圆环（米为单位）
      segments: 512,
      // clickHighlight: true,
      // hoverHighlight: true,
      clickHighlight: { color: '#ffee58', fillAlpha: 0.35 },
      hoverHighlight: { color: '#0be967ff', fillAlpha: 0.35 }, // { color: '#ffee58', fillAlpha: 0.35 },
      renderMode: 'primitive',      // clampToGround 默认 true（这里不传，验证默认行为）
      onClick: () => {
        const circleOverlay = circleA as OverlayEntity;
        console.log('圆形 A 被点击=', circleOverlay);
        console.log('圆形 A 被点击=', circleOverlay.id);
        console.log('圆形 A 被点击=', circleOverlay._innerEntity?.id);
        logCircle('A(click)', circleA);
        message.value = '圆形 A 被点击';
        // circleA.show = !circleA.show;
        // circleA._innerEntity.show = !circleA._innerEntity.show;
        // overlayService.value!.setOverlayVisible(circleA.id, false); 
        // overlayService.value!.setOverlayVisible(circleA._innerEntity.id, false); 
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    // 初始化时打印一次，确认是否走了 primitive
    logCircle('A(init)', circleA);

    addIcon({ longitude: 120.09747987, latitude: 30.12573937 });

    // Test B: primitive ❌（非粗边框：outlineWidth<=1，会回退到 entity ellipse）
    const circleB = overlayService.value.addCircle({
      position: [lon + 0.02, lat, 800], // 即便传高度，贴地默认会归零
      radius: 1200,
      material: Cesium.Color.YELLOW.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
      outlineWidth: 1,
      hoverHighlight: true,
      clickHighlight: {
        color: Cesium.Color.ORANGE,
        fillAlpha: 0.5,
      },
      onClick: () => {
        logCircle('B(click)', circleB);
        message.value = '圆形 B(贴地默认) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });

    addIcon({ longitude: lon + 0.02, latitude: lat });

    // Test C: primitive ❌（显式悬空：clampToGround=false，会回退到 entity ellipse）
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
        logCircle('C(click)', circleC);
        message.value = '圆形 C(悬空) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    addIcon({ longitude: lon - 0.02, latitude: lat });

    // Test D: primitive ✅（粗边框 + 贴地 + 字符串颜色材质）
    const circleD = overlayService.value.addCircle({
      position: [lon + 0.03, lat + 0.01],
      radius: 800,
      material: '#1815c093',
      outline: true,
      outlineColor: '#2519d2ff',
      outlineWidth: 15,
      segments: 256,
      clickHighlight: { color: '#ffee58', fillAlpha: 0.35 },
      hoverHighlight: true,
      renderMode: 'primitive',
      onClick: () => {
        logCircle('D(click)', circleD);
        message.value = '圆形 D(primitive, string color) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    addIcon({ longitude: lon + 0.03, latitude: lat + 0.01 });

    // Test E: primitive ❌（非纯色材质：StripeMaterialProperty，会回退到 entity ring/polygon）
    const circleE = overlayService.value.addCircle({
      position: [lon - 0.03, lat - 0.01],
      radius: 900,
      material: new Cesium.StripeMaterialProperty({
        evenColor: Cesium.Color.RED.withAlpha(0.35),
        oddColor: Cesium.Color.RED.withAlpha(0.35),
        repeat: 8,
      }),
      outline: true,
      outlineColor: Cesium.Color.RED.withAlpha(0.6),
      outlineWidth: 12,
      clampToGround: true,
      renderMode: 'primitive',
      hoverHighlight: { color: '#0be967ff', fillAlpha: 0.35 }, // { color: '#ffee58', fillAlpha: 0.35 },
      clickHighlight: { color: '#ffee58', fillAlpha: 0.35 },
      onClick: () => {
        logCircle('E(click)', circleE);
        message.value = '圆形 E(stripe material fallback) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    addIcon({ longitude: lon - 0.03, latitude: lat - 0.01 });


    const detectCenter: [number, number] = [lon + 0.06, lat];
    // 告警区：后创建 => 位于更上层（填充+边框都更靠上）；边框仍会画在所有填充上方。
    const alarmCircle = overlayService.value.addCircle({
      position: detectCenter,
      radius: 950,
      material: Cesium.Color.fromCssColorString('#e65100').withAlpha(0.28),
      outline: true,
      outlineColor: '#fb8c00',
      outlineWidth: 20,
      renderMode: 'primitive',
      layerKey: 'alarm111',
      hoverHighlight: { color: '#0be967ff', fillAlpha: 0.35 },
      clickHighlight: { color: '#ffee58', fillAlpha: 0.35 },
      onClick: () => {
        logCircle('F-alarm(click)', alarmCircle);
        message.value = '告警区(primitive, layer=alarm) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logCircle('F-alarm(init)', alarmCircle);

        // Test F: primitive ✅（分层叠加：侦测区 vs 告警区）
    // 目标：两个区域都填充、且边界始终清晰可见。
    // 关键：为 primitive circle 提供 layerKey，按业务顺序创建即可确定上下层。

    const detectCircle = overlayService.value.addCircle({
      // position: detectCenter,
      position: [lon + 0.05, lat],
      radius: 1400,
      material: Cesium.Color.fromCssColorString('#1b5e20').withAlpha(0.28),
      outline: true,
      outlineColor: '#2e7d32',
      outlineWidth: 20,
      renderMode: 'primitive',
      layerKey: 'detect222',
      hoverHighlight: { color: '#0be967ff', fillAlpha: 0.35 },
      clickHighlight: { color: '#ffee58', fillAlpha: 0.35 },
      onClick: () => {
        logCircle('F-detect(click)', detectCircle);
        message.value = '侦测区(primitive, layer=detect) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logCircle('F-detect(init)', detectCircle);

    addIcon({ longitude: detectCenter[0], latitude: detectCenter[1] });

    markerEntities.push(circleA, circleB, circleC, circleD, circleE, detectCircle, alarmCircle);
    message.value = '已添加圆形：A primitive粗边框贴地 / B fallback非粗边框 / C fallback悬空 / D primitive字符串颜色 / E fallback非纯色材质 / F layered(侦测区+告警区)';
    setTimeout(() => (message.value = ''), 2200);

    // Quick check: visible toggle（primitive/entity 都应该正常生效）
    setTimeout(() => {
      overlayService.value!.setOverlayVisible(circleA.id, false);
      overlayService.value!.setOverlayVisible(circleD.id, false);
      setTimeout(() => {
        overlayService.value!.setOverlayVisible(circleA.id, true);
        overlayService.value!.setOverlayVisible(circleD.id, true);
      }, 800);
    }, 800);
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
      lineStyle: 'dashed', // 边框样式：虚线
      lineMaterialMode: 'stripe', // 使用虚线材质
      stripeRepeat: 2048, // 边框虚线段数
      glowWidth: 24, // 发光宽度
      lineWidth: 12, // 边框宽度
      glowPower: 0.75, // 发光强度
      clampToGround: true,
      gapColor: Cesium.Color.WHITE.withAlpha(0.01),
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

    // Test A: primitive ✅（粗边框 + 贴地 + 纯色材质）
    const polyA = overlayService.value.addPolygon({
      positions: [
        [lon - 0.01, lat - 0.008],
        [lon + 0.01, lat - 0.008],
        [lon + 0.012, lat + 0.006],
        [lon - 0.004, lat + 0.01],
      ],
      // 预期：填充为半透明橙色，边框为不透明橙色（hover/click 高亮可叠加，click 优先）
      material: Cesium.Color.ORANGE.withAlpha(0.5),
      outline: true,
      outlineColor: Cesium.Color.ORANGE,
      outlineWidth: 10,
      hoverHighlight: true,
      clickHighlight: true,
      renderMode: 'primitive',
      onClick: () => {
        logPolygon('A(click)', polyA);
        message.value = '多边形 A(primitive, 粗边框贴地) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logPolygon('A(init)', polyA);

    // Test D: primitive ✅ 分层叠加（detect vs alarm）
    // 预期：边框永远压在所有填充之上，重叠区域也能看清边界。
    const polyDDetect = overlayService.value.addPolygon({
      positions: [
        [lon - 0.004, lat - 0.002],
        [lon + 0.014, lat - 0.002],
        [lon + 0.016, lat + 0.01],
        [lon - 0.002, lat + 0.012],
      ],
      material: Cesium.Color.BLUE.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.BLUE,
      outlineWidth: 10,
      renderMode: 'primitive',
      layerKey: 'detect',
      hoverHighlight: true,
    });

    const polyDAlarm = overlayService.value.addPolygon({
      positions: [
        [lon - 0.002, lat - 0.004],
        [lon + 0.012, lat - 0.004],
        [lon + 0.014, lat + 0.008],
        [lon, lat + 0.01],
      ],
      material: Cesium.Color.RED.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.RED,
      outlineWidth: 10,
      renderMode: 'primitive',
      layerKey: 'alarm',
      hoverHighlight: true,
    });

    // Test B: primitive ❌（显式悬空 clampToGround=false，会回退到 entity）
    const polyB = overlayService.value.addPolygon({
      positions: [
        [lon + 0.02, lat - 0.005, 600],
        [lon + 0.032, lat - 0.005, 600],
        [lon + 0.03, lat + 0.008, 600],
        [lon + 0.018, lat + 0.01, 600],
      ],
      material: Cesium.Color.PURPLE.withAlpha(0.25),
      outline: true,
      outlineColor: Cesium.Color.PURPLE,
      outlineWidth: 10,
      clampToGround: false,
      hoverHighlight: true,
      clickHighlight: true,
      renderMode: 'primitive',
      onClick: () => {
        logPolygon('B(click)', polyB);
        message.value = '多边形 B(fallback, 悬空) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logPolygon('B(init)', polyB);

    // Test C: primitive ❌（非纯色材质，会回退到 entity）
    const polyC = overlayService.value.addPolygon({
      positions: [
        [lon - 0.03, lat - 0.006],
        [lon - 0.018, lat - 0.006],
        [lon - 0.016, lat + 0.008],
        [lon - 0.032, lat + 0.01],
      ],
      material: new Cesium.StripeMaterialProperty({
        evenColor: Cesium.Color.RED.withAlpha(0.3),
        oddColor: Cesium.Color.RED.withAlpha(0.3),
        repeat: 8,
      }),
      outline: true,
      outlineColor: Cesium.Color.RED.withAlpha(0.8),
      outlineWidth: 10,
      hoverHighlight: true,
      clickHighlight: true,
      clampToGround: true,
      renderMode: 'primitive',
      onClick: () => {
        logPolygon('C(click)', polyC);
        message.value = '多边形 C(fallback, stripe material) 被点击';
        setTimeout(() => (message.value = ''), 2000);
      },
    });
    logPolygon('C(init)', polyC);

    markerEntities.push(polyA, polyB, polyC, polyDDetect, polyDAlarm);
    message.value = '已添加多边形：A primitive粗边框贴地 / B fallback悬空 / C fallback非纯色材质 / D 分层叠加';
    setTimeout(() => (message.value = ''), 2200);

    // Quick check: visible toggle（primitive/entity 都应该正常生效）
    setTimeout(() => {
      overlayService.value!.setOverlayVisible(polyA.id, false);
      setTimeout(() => {
        overlayService.value!.setOverlayVisible(polyA.id, true);
      }, 800);
    }, 800);

    // Quick check: remove（用于验证 primitive/entity 的 removeOverlay 兼容）
    setTimeout(() => {
      overlayService.value!.removeOverlay(polyB.id);
    }, 2500);
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
    testSetOverlayHighlight,
    testToggleOverlayHighlight,
    cancelMarkerMode,
    destroyOverlayService,
  };
}

