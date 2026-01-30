import { getViteTdToken } from "../utils/common";

// 天地图Token
export const TD_Map_TOKEN = getViteTdToken();

// 中国地图范围 - 覆盖整个中国
export const China_Map_Bound = '73.5577,18.1597,135.0882,53.5609'

// 中国地图中心点
export const China_Map_Center = {
  longitude: 104.1141,
  latitude: 37.5503,
  height: 10,
}

// 中国地图边界范围（用于限制地图显示区域）
export const China_Map_Extent = {
  west: 73.5577, // 最西端经度
  south: 18.1597, // 最南端纬度
  east: 135.0882, // 最东端经度
  north: 53.5609, // 最北端纬度
}

export const TD_Map_Search_URL = (keywords: string, mapConfig: any, token = TD_Map_TOKEN) => {
  const obj = {
    start: 0,
    count: 10,
    queryType: 7,
    keyWord: keywords,
    mapBound: China_Map_Bound,
    level: mapConfig?.defaultZoomLevel || 15,
  }
  return `http://api.tianditu.gov.cn/v2/search?postStr=${JSON.stringify(
    obj,
  )}&type=query&tk=${token}`
}