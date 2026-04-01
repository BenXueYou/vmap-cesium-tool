# tdt-terrain-cesium-plugin
> cesium天地图地形和地名插件，提取自天地图官方插件

## 特别鸣谢

感谢 [just-ads/tdt-cesium-plugin](https://github.com/just-ads/tdt-cesium-plugin) 提供的原始代码。

## 安装

```bash
npm install github:BenXueYou/tdt-terrain-cesium-plugin
```

## 使用

### 地形
```javascript
import Tdt3dPlug from 'tdt-terrain-cesium-plugin';

const viewer = new Cesium.Viewer('container');

viewer.terrainProvider = new Tdt3dPlug.GeoTerrainProvider({
    url: 'https://t{s}.tianditu.gov.cn/mapservice/swdx?T=elv_c&x={x}&y={y}&l={z}&tk={token}',
    subdomains: ['0','1','2','3','4','5','6','7'],
    token: '你的token'
});

```
### 地名
```javascript
import Tdt3dPlug from 'tdt-terrain-cesium-plugin';

const viewer = new Cesium.Viewer('container');
new Tdt3dPlug.GeoWTFS(viewer, {
        subdomains: ['0','1','2','3','4','5','6','7'],
        url: 'https://t{s}.tianditu.gov.cn/mapservice/GetTiles?lxys={z},{x},{y}&tk=你的token',
        icoUrl: 'https://t{s}.tianditu.gov.cn/mapservice/GetIcon?id={id}&tk=你的token',
        metadata:{
            boundBox: {
                minX: -180,
                minY: -90,
                maxX: 180,
                maxY: 90
            },
            minLevel: 1,
            maxLevel: 20
        },
        aotuCollide: true,
        collisionPadding: [5, 10, 8, 5],
        serverFirstStyle: true
    })
```

