import { getViteTdToken } from '../src/utils/common';

const tdMapToken = getViteTdToken();

export const chinaMapBound = '73.5577,18.1597,135.0882,53.5609';

export const chinaMapExtent = {
  west: 73.5577,
  south: 18.1597,
  east: 135.0882,
  north: 53.5609,
};

export function getTdMapSearchUrl(keywords: string, mapConfig: { defaultZoomLevel?: number }, token = tdMapToken) {
  const payload = {
    start: 0,
    count: 10,
    queryType: 7,
    keyWord: keywords,
    mapBound: chinaMapBound,
    level: mapConfig?.defaultZoomLevel || 15,
  };

  return `http://api.tianditu.gov.cn/v2/search?postStr=${JSON.stringify(payload)}&type=query&tk=${token}`;
}