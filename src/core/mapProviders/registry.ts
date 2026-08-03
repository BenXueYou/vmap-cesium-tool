import * as Cesium from 'cesium';
import type { MapType } from '../types';
import type { BaseMapConfig, BaseMapProviderId, MapAuthConfig, MapProviderContext } from './types';
import {
  buildDefaultBaseMap,
  normalizeProviderId,
  resolveLegacyMapService,
  resolveSecureKey,
  resolveServiceKey,
} from './mapService';
import { createBaiduTilingScheme } from './tilingSchemes/baidu';
import { createGCJ02TilingScheme } from './tilingSchemes/gcj02';
import {
  createTDT3DGeoWTFS,
  createTDT3DImageryConfig,
  createTDT3DTerrainProvider,
  createTDTImageryConfig,
  createTDTTerrainConfig,
  createTDTVectorConfig,
} from '../layers/TDTMapLayer';

const GCJ02_TILING_SCHEME = createGCJ02TilingScheme();
const BAIDU_TILING_SCHEME = createBaiduTilingScheme();

type ProviderFactory = (context: MapProviderContext) => MapType[];

function tdtFactory(context: MapProviderContext): MapType[] {
  const token = context.service?.credentials.serviceKey
    || resolveServiceKey(context.baseMap, context.auth, 'tdt');
  const sk = context.service?.credentials.secureKey
    || resolveSecureKey(context.baseMap, context.auth, 'tdt');
  const wrap = (
    id: string,
    name: string,
    nameKey: string,
    provider: () => Cesium.ImageryProvider[],
    extra?: Partial<MapType>,
  ): MapType => ({
    id,
    providerId: 'tdt',
    name,
    nameKey,
    thumbnail: '',
    provider: () => provider(),
    ...extra,
  });

  return [
    wrap('vec', '矢量地图', 'map.types.vec', () => createTDTVectorConfig(token, sk), { forcePlaceName: true }),
    wrap('img', '影像地图', 'map.types.img', () => createTDTImageryConfig(token, sk)),
    wrap('ter', '地形地图', 'map.types.ter', () => createTDTTerrainConfig(token, sk)),
    wrap('tdt3d', '三维地图', 'map.types.tdt3d', () => createTDT3DImageryConfig(token, sk), {
      terrainProvider: () => createTDT3DTerrainProvider(token, sk),
      geoWTFS: () => createTDT3DGeoWTFS(token, context.viewer!, sk),
    }),
  ];
}

function gaodeFactory(context: MapProviderContext): MapType[] {
  const subdomains = context.baseMap.subdomains || ['1', '2', '3', '4'];
  const createProvider = (url: string) => new Cesium.UrlTemplateImageryProvider({
    url,
    subdomains,
    maximumLevel: context.baseMap.maximumLevel ?? 18,
    minimumLevel: context.baseMap.minimumLevel ?? 0,
    tilingScheme: GCJ02_TILING_SCHEME,
    credit: new Cesium.Credit('Gaode'),
  });

  return [
    {
      id: 'gaode-vector',
      providerId: 'gaode',
      name: '高德矢量',
      nameKey: 'map.types.gaode_vector',
      thumbnail: '',
      forcePlaceName: true,
      provider: () => [
        createProvider('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}'),
      ],
    },
    {
      id: 'gaode-satellite',
      providerId: 'gaode',
      name: '高德影像',
      nameKey: 'map.types.gaode_satellite',
      thumbnail: '',
      provider: () => [
        createProvider('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'),
        createProvider('https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}'),
      ],
    },
  ];
}

function tencentFactory(context: MapProviderContext): MapType[] {
  const subdomains = context.baseMap.subdomains || ['0', '1', '2', '3'];
  const common = {
    subdomains,
    maximumLevel: context.baseMap.maximumLevel ?? 18,
    minimumLevel: context.baseMap.minimumLevel ?? 0,
    tilingScheme: GCJ02_TILING_SCHEME,
    credit: new Cesium.Credit('Tencent Maps'),
  };

  return [
    {
      id: 'tencent-vector',
      providerId: 'tencent',
      name: '腾讯矢量',
      nameKey: 'map.types.tencent_vector',
      thumbnail: '',
      forcePlaceName: true,
      provider: () => [
        new Cesium.UrlTemplateImageryProvider({
          ...common,
          url: 'https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={reverseY}&styleid=1&scene=0',
        }),
      ],
    },
    {
      id: 'tencent-satellite',
      providerId: 'tencent',
      name: '腾讯影像',
      nameKey: 'map.types.tencent_satellite',
      thumbnail: '',
      provider: () => [
        new Cesium.UrlTemplateImageryProvider({
          ...common,
          url: 'https://p{s}.map.gtimg.com/sateTiles/{z}/{sx}/{sy}/{x}_{reverseY}.jpg?version=229',
          customTags: {
            sx: (_provider: Cesium.UrlTemplateImageryProvider, x: number) => String(Math.floor(x / 16)),
            sy: (_provider: Cesium.UrlTemplateImageryProvider, _x: number, y: number, level: number) => {
              const reverseY = (1 << level) - y - 1;
              return String(Math.floor(reverseY / 16));
            },
          },
        }),
        new Cesium.UrlTemplateImageryProvider({
          ...common,
          url: 'https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={reverseY}&styleid=2&scene=0',
        }),
      ],
    },
  ];
}

function createBaiduTileTags() {
  return {
    baiduX: (_provider: any, x: number, _y: number, level: number) => String(x - Math.pow(2, level - 1)),
    baiduY: (_provider: any, _x: number, y: number, level: number) => String(Math.pow(2, level - 1) - y - 1),
  };
}

function baiduFactory(context: MapProviderContext): MapType[] {
  const subdomains = context.baseMap.subdomains || ['0', '1', '2', '3'];
  const common = {
    subdomains,
    maximumLevel: context.baseMap.maximumLevel ?? 18,
    minimumLevel: context.baseMap.minimumLevel ?? 0,
    tilingScheme: BAIDU_TILING_SCHEME,
    customTags: createBaiduTileTags(),
    credit: new Cesium.Credit('Baidu Maps'),
  };

  return [
    {
      id: 'baidu-vector',
      providerId: 'baidu',
      name: '百度矢量',
      nameKey: 'map.types.baidu_vector',
      thumbnail: '',
      forcePlaceName: true,
      provider: () => [
        new Cesium.UrlTemplateImageryProvider({
          ...common,
          url: 'https://maponline{s}.bdimg.com/tile/?qt=tile&x={baiduX}&y={baiduY}&z={z}&styles=pl&scaler=1&p=1',
        }),
      ],
    },
    {
      id: 'baidu-satellite',
      providerId: 'baidu',
      name: '百度影像',
      nameKey: 'map.types.baidu_satellite',
      thumbnail: '',
      provider: () => [
        new Cesium.UrlTemplateImageryProvider({
          ...common,
          url: 'https://maponline{s}.bdimg.com/it/u=x={baiduX};y={baiduY};z={z};v=009;type=sate&fm=46',
        }),
        new Cesium.UrlTemplateImageryProvider({
          ...common,
          url: 'https://maponline{s}.bdimg.com/tile/?qt=tile&x={baiduX}&y={baiduY}&z={z}&styles=sl&v=020',
        }),
      ],
    },
  ];
}

async function createGoogleSession(baseMap: BaseMapConfig, auth?: MapAuthConfig): Promise<string> {
  const apiKey = resolveServiceKey(baseMap, auth, 'google');
  if (!apiKey) {
    throw new Error('Google Map Tiles API key 未配置');
  }

  const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mapType: baseMap.type === 'satellite' ? 'satellite' : 'roadmap',
      language: 'zh-CN',
      region: 'CN',
    }),
  });

  if (!response.ok) {
    throw new Error(`Google session 创建失败: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as { session?: string };
  if (!payload.session) {
    throw new Error('Google session 返回缺少 session');
  }

  return payload.session;
}

function googleFactory(context: MapProviderContext): MapType[] {
  const build = (
    id: string,
    name: string,
    nameKey: string,
    type: 'roadmap' | 'satellite',
  ): MapType => ({
    id,
    providerId: 'google',
    name,
    nameKey,
    thumbnail: '',
    provider: async () => {
      const apiKey = context.service?.credentials.serviceKey
        || resolveServiceKey(context.baseMap, context.auth, 'google');
      const session = await createGoogleSession({ ...context.baseMap, type }, context.auth);
      return [
        new Cesium.UrlTemplateImageryProvider({
          url: `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(apiKey)}`,
          minimumLevel: context.baseMap.minimumLevel ?? 0,
          maximumLevel: context.baseMap.maximumLevel ?? 20,
          tilingScheme: new Cesium.WebMercatorTilingScheme(),
          credit: new Cesium.Credit('Google Maps'),
        }),
      ];
    },
  });

  return [
    build('google-roadmap', 'Google 矢量', 'map.types.google_roadmap', 'roadmap'),
    build('google-satellite', 'Google 影像', 'map.types.google_satellite', 'satellite'),
  ];
}

function customFactory(context: MapProviderContext): MapType[] {
  const type = context.baseMap.type || 'xyz';
  return [
    {
      id: `custom-${type}`,
      providerId: 'custom',
      name: context.baseMap.mode === 'offline' ? '离线地图' : '自定义地图',
      nameKey: context.baseMap.mode === 'offline' ? 'map.types.custom_offline' : 'map.types.custom_online',
      thumbnail: '',
      provider: () => {
        if (type === 'imageryProviders') {
          return context.baseMap.providers || [];
        }

        if (type === 'wmts') {
          if (!context.baseMap.customUrl || !context.baseMap.wmtsLayer || !context.baseMap.tileMatrixSetId) {
            throw new Error('自定义 WMTS 底图缺少 customUrl/wmtsLayer/tileMatrixSetId');
          }
          return [
            new Cesium.WebMapTileServiceImageryProvider({
              url: context.baseMap.customUrl,
              layer: context.baseMap.wmtsLayer,
              style: context.baseMap.wmtsStyle || 'default',
              format: context.baseMap.wmtsFormat || 'image/png',
              tileMatrixSetID: context.baseMap.tileMatrixSetId,
              minimumLevel: context.baseMap.minimumLevel ?? 0,
              maximumLevel: context.baseMap.maximumLevel ?? 18,
              credit: new Cesium.Credit(context.baseMap.credit || '自定义地图'),
            }),
          ];
        }

        if (!context.baseMap.urlTemplate) {
          throw new Error(context.baseMap.mode === 'offline' ? '离线地图缺少 urlTemplate' : '自定义 XYZ 底图缺少 urlTemplate');
        }
        const rectangle = context.baseMap.rectangle
          ? Cesium.Rectangle.fromDegrees(
            context.baseMap.rectangle.west,
            context.baseMap.rectangle.south,
            context.baseMap.rectangle.east,
            context.baseMap.rectangle.north,
          )
          : undefined;

        return [
          new Cesium.UrlTemplateImageryProvider({
            url: context.baseMap.urlTemplate,
            minimumLevel: context.baseMap.minimumLevel ?? 0,
            maximumLevel: context.baseMap.maximumLevel ?? 18,
            tilingScheme: new Cesium.WebMercatorTilingScheme(),
            rectangle,
            credit: new Cesium.Credit(context.baseMap.credit || '本地瓦片'),
          }),
        ];
      },
    },
  ];
}

const FACTORIES: Record<BaseMapProviderId, ProviderFactory> = {
  tdt: tdtFactory,
  gaode: gaodeFactory,
  tencent: tencentFactory,
  baidu: baiduFactory,
  google: googleFactory,
  custom: customFactory,
};

export function resolveMapTypeId(baseMap: BaseMapConfig): string {
  const provider = normalizeProviderId(baseMap.provider);
  if (provider === 'tdt') {
    return baseMap.type || 'img';
  }
  return `${provider}-${baseMap.type || buildDefaultBaseMap(provider).type || 'default'}`;
}

export function mapTypeIdToBaseMapConfig(mapTypeId: string, current: BaseMapConfig): BaseMapConfig {
  if (mapTypeId === 'vec' || mapTypeId === 'img' || mapTypeId === 'ter' || mapTypeId === 'tdt3d') {
    return {
      ...current,
      provider: 'tdt',
      type: mapTypeId,
    };
  }

  if (mapTypeId.startsWith('gaode-')) {
    return { ...current, provider: 'gaode', type: mapTypeId.replace('gaode-', ''), showLabel: true };
  }
  if (mapTypeId.startsWith('tencent-')) {
    return { ...current, provider: 'tencent', type: mapTypeId.replace('tencent-', ''), showLabel: true };
  }
  if (mapTypeId.startsWith('baidu-')) {
    return { ...current, provider: 'baidu', type: mapTypeId.replace('baidu-', ''), showLabel: true };
  }
  if (mapTypeId.startsWith('google-')) {
    return { ...current, provider: 'google', type: mapTypeId.replace('google-', ''), showLabel: false };
  }
  if (mapTypeId.startsWith('custom-')) {
    return { ...current, provider: 'custom', type: mapTypeId.replace('custom-', '') };
  }

  return { ...current };
}

export class BaseMapRegistry {
  getMapTypes(baseMap: BaseMapConfig, auth?: MapAuthConfig, viewer?: Cesium.Viewer): MapType[] {
    const service = resolveLegacyMapService({ baseMap, mapAuth: auth });
    return FACTORIES[service.provider]({
      baseMap: service.baseMap,
      auth: service.auth,
      viewer,
      service,
    });
  }

  getAllMapTypes(auth?: MapAuthConfig, viewer?: Cesium.Viewer): MapType[] {
    return (Object.keys(FACTORIES) as BaseMapProviderId[]).flatMap((provider) => {
      return this.getMapTypes(buildDefaultBaseMap(provider), auth, viewer);
    });
  }

  getMapTypeById(mapTypeId: string, baseMap: BaseMapConfig, auth?: MapAuthConfig, viewer?: Cesium.Viewer): MapType | undefined {
    const resolvedBaseMap = mapTypeIdToBaseMapConfig(mapTypeId, baseMap);
    return this.getMapTypes(resolvedBaseMap, auth, viewer).find((item) => item.id === mapTypeId);
  }
}

export const baseMapRegistry = new BaseMapRegistry();

export { buildDefaultBaseMap, normalizeProviderId };
