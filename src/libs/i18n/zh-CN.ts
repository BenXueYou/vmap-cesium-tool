const zhCN = {
  locale: "zh-CN",
  toolbar: {
    search: "搜索",
    measure: "测量",
    view2d3d: "2D或3D",
    layers: "图层切换",
    location: "定位",
    zoom_in: "缩小",
    zoom_out: "放大",
    fullscreen: "全屏",
  },
  measurement: {
    start: "开始测量",
    distance_done: "测距完成，总距离: {distance} 米",
    area_done: "测面积完成，面积: {area} 平方公里",
    cleared: "已清除所有测量内容",
    menu: {
      area: "测面积",
      distance: "测距",
      clear: "清除",
    },
  },
  search: {
    placeholder: "请输入地址",
    failed: "搜索失败",
    no_results: "未找到相关地址",
  },
  layers: {
    title: "地图类型",
    overlay_title: "叠加图层",
    overlay: {
      airport: "机场禁飞区",
    },
  },
  map_type: {
    normal: "天地图-普通",
    "3d": "天地图-三维",
    imagery: "天地图-影像",
    terrain: "天地图-地形",
  },
  no_fly: {
    description: "机场禁飞区: {name}",
  },
  draw: {
    hint: {
      circle_start: "单击确定圆心",
      circle_radius: "移动鼠标确定半径，单击确定半径点，双击完成，右键撤销",
      rectangle_start: "单击确定起点",
      rectangle_end: "移动鼠标确定终点，单击确定终点，双击完成，右键撤销",
      finish_or_undo: "双击完成，右键撤销",
      polygon_start: "单击绘制区域",
      polygon_add: "单击绘制区域，右键删除点位",
      polygon_continue: "左击绘制区域，右键删除点位，双击结束绘制",
      line_start: "单击绘制区域",
      line_add: "单击绘制区域，右键删除点位",
      line_continue: "左击绘制区域，右键删除点位，双击结束绘制",
      polygon_no_intersection: "多边形不能交叉",
    },
    label: {
      total_length: "总长: {value}",
      area: "面积: {value}",
    },
  },
};

export default zhCN;