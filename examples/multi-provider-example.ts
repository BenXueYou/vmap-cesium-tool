import { CesiumMapMark, initCesium, type LegacyInitOptions } from '../src';

const mapAuth: NonNullable<LegacyInitOptions['mapAuth']> = {
  tdt: {
    token: '0624b682cd8f7233295ed929682804b4',
    sk: '9cf0eb485c2f1cb679a09ad000ac5797',
  },
  gaode: {
    key: '083cf2fc37d04fc1d4f45b4ea2a5d1e8',
  },
  tencent: {
    key: '3Y3BZ-WXTLA-BV6KT-COBRB-4GXKO-7MFQC',
  },
  baidu: {
    ak: '8c4RjhGrynydOwm1NSTBW8gt1DTE1riA',
  },
};

async function bootstrap() {
  const { viewer } = await initCesium('cesiumContainer', {
    baseMap: {
      provider: 'gaode',
      type: 'satellite',
      showLabel: true,
      sk: '85f329e4b2f551232cd24862c753055f',
    },
    mapAuth,
    mapCenter: {
      longitude: 120.148915,
      latitude: 30.235901,
      height: 3000,
    },
  });

  const mark = new CesiumMapMark(viewer, {
    showToolbar: true,
  });

  mark.drawPoint({
    outputCoordSystem: 'WGS84',
  });

  mark.drawPolygon({
    coordSystem: 'GCJ02',
    outputCoordSystem: 'WGS84',
  });
}

void bootstrap();

/*
切换腾讯底图：

await initCesium('cesiumContainer', {
  baseMap: {
    provider: 'tencent',
    type: 'satellite',
    showLabel: true,
  },
  mapAuth,
});

切换百度底图：

await initCesium('cesiumContainer', {
  baseMap: {
    provider: 'baidu',
    type: 'satellite',
    showLabel: true,
  },
  mapAuth,
});

切换天地图底图：

await initCesium('cesiumContainer', {
  baseMap: {
    provider: 'tdt',
    type: 'img',
    showLabel: true,
  },
  mapAuth,
});

离线 XYZ：

await initCesium('cesiumContainer', {
  baseMap: {
    provider: 'custom',
    type: 'xyz',
    mode: 'offline',
    urlTemplate: '/tiles/{z}/{x}/{y}.png',
    rectangle: {
      west: 118,
      south: 29,
      east: 123,
      north: 33,
    },
  },
});
*/
