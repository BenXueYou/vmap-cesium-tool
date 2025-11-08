// 导入图标资源
import searchIcon from "../assets/images/toolbar/search@3x.png";
import measureIcon from "../assets/images/toolbar/measure@3x.png";
import view2dIcon from "../assets/images/toolbar/view_2d@3x.png";
import layersIcon from "../assets/images/toolbar/layers@3x.png";
import locationIcon from "../assets/images/toolbar/location@3x.png";
import zoomInIcon from "../assets/images/toolbar/zoom-in@3x.png";
import zoomOutIcon from "../assets/images/toolbar/zoom-out@3x.png";
import fullscreenIcon from "../assets/images/toolbar/fullscreen@3x.png";

import type { SearchResult } from "../libs/CesiumMapModel";


export const useToolBarConfig = (message: any) => {

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
        callback: () => {
          console.log("图层切换");
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
      {
        size: 36,
        id: "fullscreen",
        icon: fullscreenIcon,
        title: "全屏",
        color: "#007BFF",
        borderColor: "#0775D1",
        backgroundColor: "rgba(0, 0, 0, 0.52)",
      },
    ],
  };

  const toolbarCallback = {
    // 搜索回调
    search: {
      onSearch: async (query: string): Promise<SearchResult[]> => {
        // 这里可以调用真实的地理编码API
        return [] as SearchResult[];
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
      onDistanceComplete: (positions: any, distance: any) => {
        message.value = `测距完成，总距离: ${distance.toFixed(2)} 米`;
        setTimeout(() => {
          message.value = "";
        }, 3000);
      },
      onAreaComplete: (positions: any, area: any) => {
        message.value = `测面积完成，面积: ${area.toFixed(2)} 平方公里`;
        setTimeout(() => {
          message.value = "";
        }, 3000);
      },
      onClear: () => {
        message.value = "已清除所有测量内容";
        setTimeout(() => {
          message.value = "";
        }, 2000);
      },
    },
    // 缩放回调
    zoom: {
      onZoomIn: (beforeLevel: any, afterLevel: any) => {
        console.log(
          `放大: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`
        );
      },
      onZoomOut: (beforeLevel: any, afterLevel: any) => {
        console.log(
          `缩小: ${beforeLevel.toFixed(0)} -> ${afterLevel.toFixed(0)}`
        );
      },
    },
  }

  return {
    toolbarConfig,
    toolbarCallback
  };
};
