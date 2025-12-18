// 导入图标资源
import searchIcon from "../assets/images/toolbar/search@3x.png";
import measureIcon from "../assets/images/toolbar/measure@3x.png";
import view2dIcon from "../assets/images/toolbar/view_2d@3x.png";
import layersIcon from "../assets/images/toolbar/layers@3x.png";
import locationIcon from "../assets/images/toolbar/location@3x.png";
import zoomInIcon from "../assets/images/toolbar/zoom-in@3x.png";
import zoomOutIcon from "../assets/images/toolbar/zoom-out@3x.png";
import fullscreenIcon from "../assets/images/toolbar/fullscreen@3x.png";
import { TD_Map_Search_URL, China_Map_Extent } from "./useMap";
import type { SearchResult } from "../libs/CesiumMapModel";


export const useToolBarConfig = (viewer, message: any) => {

  const toolbarConfig = {
    position: "bottom-right",
    buttonSize: 36,
    buttonSpacing: 8,
    borderRadius: 6,
    borderWidth: 0,
    zIndex: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    buttons: [
      {
        size: 36,
        id: "search",
        icon: searchIcon,
        title: "搜索",
        color: "#007BFF",
        borderColor: "#0775D1",
        backgroundColor: "rgba(0, 0, 0, 0.52)",
      },
      {
        size: 36,
        id: "measure",
        icon: measureIcon,
        title: "测量",
        color: "#007BFF",
        backgroundColor: "rgba(0, 0, 0, 0.52)",
      },
      {
        size: 36,
        id: "view2d3d",
        icon: false,
        activeIcon: false,
        title: "2D或3D",
        color: "#007BFF",
        backgroundColor: "rgba(0, 0, 0, 0.52)",
      },
      {
        size: 36,
        id: "layers",
        icon: layersIcon,
        title: "图层切换",
        color: "#007BFF",
        borderColor: "#0775D1",
        backgroundColor: "rgba(0, 0, 0, 0.52)",
        callback: (isChecked: boolean, toolbar?: any) => {
          if (isChecked) {
            console.log("绘制禁飞区开启");
            // 显示禁飞区
            if (toolbar && typeof toolbar.showNoFlyZones === 'function') {
              toolbar.showNoFlyZones().catch((error: any) => {
                console.error('显示禁飞区失败:', error);
              });
            }
          } else {
            console.log("绘制禁飞区关闭");
            // 隐藏禁飞区
            if (toolbar && typeof toolbar.hideNoFlyZones === 'function') {
              toolbar.hideNoFlyZones();
            }
          }
        },
      },
      {
        size: 36,
        id: "location",
        icon: locationIcon,
        title: "定位",
        color: "#007BFF",
        borderColor: "#0775D1",
        backgroundColor: "rgba(0, 0, 0, 0.52)",
      },
      {
        size: 36,
        id: "zoom-in",
        icon: zoomInIcon,
        title: "缩小",
        color: "#007BFF",
        borderColor: "#0775D1",
        backgroundColor: "rgba(0, 0, 0, 0.52)",
      },
      {
        size: 36,
        id: "zoom-out",
        icon: zoomOutIcon,
        title: "放大",
        color: "#007BFF",
        borderColor: "#0775D1",
        backgroundColor: "rgba(0, 0, 0, 0.52)",
      },
      // {
      //   size: 36,
      //   id: "fullscreen",
      //   icon: fullscreenIcon,
      //   title: "全屏",
      //   color: "#007BFF",
      //   borderColor: "#0775D1",
      //   backgroundColor: "rgba(0, 0, 0, 0.52)",
      // },
    ],
  };

  const toolbarCallback = {
    // 搜索回调
    search: {
      onSearch: async (query: string): Promise<SearchResult[]> => {
        // 这里可以调用真实的地理编码API
        try {
          const url = TD_Map_Search_URL(query, China_Map_Extent);
          const response = await fetch(url, {
            method: "GET",
            mode: "cors", // 允许跨域请求
            credentials: "omit", // 不发送凭证信息
            headers: {
              Accept: "application/json",
            },
          });
      
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
      
          const data = await response.json();
          const pois = data?.data?.pois || data?.pois || [];
          return pois.map((location: any) => ({
            name: location?.name || query,
            address: location?.address || "",
            longitude: Number(location?.lonlat.split(",")[0] || 0),
            latitude: Number(location?.lonlat.split(",")[1] || 0),
            height: 100,
          }));
        } catch (err) {
          console.error('搜索失败:', err)
          return []
        }
      },
      onSelect: (result: SearchResult) => {
        message.value = `已定位到: ${result.name}`;
        setTimeout(() => {
          message.value = "";
        }, 3000);
      },
    },
    // 测量回调
    measurement: {
      onMeasurementStart: (positions?: any) => {
        if (viewer?.scene?.requestRenderMode) {
          viewer.scene.requestRenderMode = false;
        }
        message.value = `开始测量`;
        setTimeout(() => {
          message.value = "";
        }, 2000);
      },
      onDistanceComplete: (positions: any, distance: any) => {
        message.value = `测距完成，总距离: ${distance.toFixed(2)} 米`;
        if (viewer?.scene?.requestRenderMode) {
          viewer.scene.requestRenderMode = true;
          viewer.scene.requestRender();
        }
        setTimeout(() => {
          message.value = "";
        }, 3000);
      },
      onAreaComplete: (positions: any, area: any) => {
        message.value = `测面积完成，面积: ${area.toFixed(2)} 平方公里`;
        if (viewer?.scene?.requestRenderMode) {
          viewer.scene.requestRenderMode = true;
          viewer.scene.requestRender();
        }
        setTimeout(() => {
          message.value = "";
        }, 3000);
      },
      onClear: () => {
        message.value = "已清除所有测量内容";
        viewer?.scene?.requestRender()
        setTimeout(() => {
          message.value = "";
        }, 2000);
      },
    },
    // 缩放回调
    zoom: {
      onZoomIn: (beforeLevel: any, afterLevel: any, currentLevel: any) => {
        console.log(
          `放大: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}: ${currentLevel.toFixed(0)}`
        );
      },
      onZoomOut: (beforeLevel: any, afterLevel: any, currentLevel: any) => {
        console.log(
          `缩小: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}: ${currentLevel.toFixed(0)}`
        );
      },
    },
  }

  return {
    toolbarConfig,
    toolbarCallback
  };
};
