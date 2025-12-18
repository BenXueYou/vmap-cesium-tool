import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import DrawHelper from '../toolBar/CesiumMapHelper';
import type { MapType, ToolbarConfig, SearchCallback, MeasurementCallback, ZoomCallback } from '../CesiumMapModel';
import VecImg from '../../assets/images/vec_c.png'; // 矢量图标
import TerImg from '../../assets/images/ter_c.png'; // 地形
import ImgImg from '../../assets/images/img_c.png'; // 影像
import EleImg from '../../assets/images/ele_c.jpg'; // 三维


export interface CesiumMapConfig {
  viewer?: Viewer;
  drawHelper?: DrawHelper;
  toolbar?: ToolbarConfig;
  search?: SearchCallback;
  measurement?: MeasurementCallback;
  zoom?: ZoomCallback;
  mapTypes?: MapType[];
}

export const TDTMapTypes: MapType[] = [
    {
      id: 'normal',
      name: '天地图-普通',
      thumbnail: VecImg,
      provider: (token: string) => {
        return [
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            layer: "vec",
            style: "default",
            tileMatrixSetID: "GoogleMapsCompatible",
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© 天地图'
          }),
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            layer: "cva",
            style: "default",
            format: "tiles",
            subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
            tileMatrixSetID: "GoogleMapsCompatible",
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© 天地图'
          })
        ]
      }
    },
    {
      id: '3d',
      name: '天地图-三维',
      thumbnail: EleImg,
      provider: (token: string) => {
        return [
           // 影像底图
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            layer: "img",
            style: "default",
            format: "tiles",
            subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
            tileMatrixSetID: "GoogleMapsCompatible",
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© 天地图'
          }),
          // 影像标注
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 18,
            layer: "cia",
            style: "default",
            format: "tiles",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          })
        ]
      },
      // 三维地形提供者
      terrainProvider: (token: string) => {
        // 检查是否引入了天地图扩展包（cesiumTdt.js）
        if (typeof (Cesium as any).GeoTerrainProvider === 'undefined') {
          console.warn('未检测到 Cesium.GeoTerrainProvider，请确保已引入 cesiumTdt.js 扩展包');
          return null;
        }
        const tdtUrl = 'https://t{s}.tianditu.gov.cn/';
        const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7'];
        const terrainUrls: string[] = [];
        
        for (let i = 0; i < subdomains.length; i++) {
          const url = tdtUrl.replace('{s}', subdomains[i]) + `mapservice/swdx?T=elv_c&tk=${token}`;
          terrainUrls.push(url);
        }
        
        return new (Cesium as any).GeoTerrainProvider({
          urls: terrainUrls
        });
      },
      // 三维地名服务配置
      geoWTFS: (token: string, viewer: Cesium.Viewer) => {
        // 检查是否引入了天地图扩展包（cesiumTdt.js）
        if (typeof (Cesium as any).GeoWTFS === 'undefined') {
          console.warn('未检测到 Cesium.GeoWTFS，请确保已引入 cesiumTdt.js 扩展包');
          return null;
        }
        
        const tdtUrl = 'https://t{s}.tianditu.gov.cn/';
        const subdomains = ['0', '1', '2', '3', '4', '5', '6', '7'];
        
        // 创建三维地名服务实例
        const wtfs = new (Cesium as any).GeoWTFS({
          viewer,
          subdomains: subdomains,
          metadata: {
            boundBox: {
              minX: -180,
              minY: -90,
              maxX: 180,
              maxY: 90
            },
            minLevel: 1,
            maxLevel: 20
          },
          depthTestOptimization: true,
          dTOElevation: 15000,
          dTOPitch: Cesium.Math.toRadians(-70),
          aotuCollide: true, // 是否开启避让
          collisionPadding: [5, 10, 8, 5], // 开启避让时，标注碰撞增加内边距，上、右、下、左
          serverFirstStyle: true, // 服务端样式优先
          labelGraphics: {
            font: "28px sans-serif",
            fontSize: 28,
            fillColor: Cesium.Color.WHITE,
            scale: 0.5,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            showBackground: false,
            backgroundColor: Cesium.Color.RED,
            backgroundPadding: new Cesium.Cartesian2(10, 10),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            verticalOrigin: Cesium.VerticalOrigin.TOP,
            eyeOffset: Cesium.Cartesian3.ZERO,
            pixelOffset: new Cesium.Cartesian2(5, 5),
            disableDepthTestDistance: undefined
          },
          billboardGraphics: {
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            eyeOffset: Cesium.Cartesian3.ZERO,
            pixelOffset: Cesium.Cartesian2.ZERO,
            alignedAxis: Cesium.Cartesian3.ZERO,
            color: Cesium.Color.WHITE,
            rotation: 0,
            scale: 1,
            width: 18,
            height: 18,
            disableDepthTestDistance: undefined
          }
        });
        
        // 设置三维地名服务URL
        wtfs.getTileUrl = function() {
          return tdtUrl + `mapservice/GetTiles?lxys={z},{x},{y}&VERSION=1.0.0&tk=${token}`;
        };
        
        // 设置三维图标服务URL
        wtfs.getIcoUrl = function() {
          return tdtUrl + `mapservice/GetIcon?id={id}&tk=${token}`;
        };
        
        // 初始化三维地名服务（使用默认的瓦片配置）
        // 这里使用与 demo-108.html 和 demo-122.html 相同的瓦片配置
        const tileConfig = [
          {"x": 6, "y": 1, "level": 2, "boundBox": {"minX": 90, "minY": 0, "maxX": 135, "maxY": 45}},
          {"x": 7, "y": 1, "level": 2, "boundBox": {"minX": 135, "minY": 0, "maxX": 180, "maxY": 45}},
          {"x": 6, "y": 0, "level": 2, "boundBox": {"minX": 90, "minY": 45, "maxX": 135, "maxY": 90}},
          {"x": 7, "y": 0, "level": 2, "boundBox": {"minX": 135, "minY": 45, "maxX": 180, "maxY": 90}},
          {"x": 5, "y": 1, "level": 2, "boundBox": {"minX": 45, "minY": 0, "maxX": 90, "maxY": 45}},
          {"x": 4, "y": 1, "level": 2, "boundBox": {"minX": 0, "minY": 0, "maxX": 45, "maxY": 45}},
          {"x": 5, "y": 0, "level": 2, "boundBox": {"minX": 45, "minY": 45, "maxX": 90, "maxY": 90}},
          {"x": 4, "y": 0, "level": 2, "boundBox": {"minX": 0, "minY": 45, "maxX": 45, "maxY": 90}},
          {"x": 6, "y": 2, "level": 2, "boundBox": {"minX": 90, "minY": -45, "maxX": 135, "maxY": 0}},
          {"x": 6, "y": 3, "level": 2, "boundBox": {"minX": 90, "minY": -90, "maxX": 135, "maxY": -45}},
          {"x": 7, "y": 2, "level": 2, "boundBox": {"minX": 135, "minY": -45, "maxX": 180, "maxY": 0}},
          {"x": 5, "y": 2, "level": 2, "boundBox": {"minX": 45, "minY": -45, "maxX": 90, "maxY": 0}},
          {"x": 4, "y": 2, "level": 2, "boundBox": {"minX": 0, "minY": -45, "maxX": 45, "maxY": 0}},
          {"x": 3, "y": 1, "level": 2, "boundBox": {"minX": -45, "minY": 0, "maxX": 0, "maxY": 45}},
          {"x": 3, "y": 0, "level": 2, "boundBox": {"minX": -45, "minY": 45, "maxX": 0, "maxY": 90}},
          {"x": 2, "y": 0, "level": 2, "boundBox": {"minX": -90, "minY": 45, "maxX": -45, "maxY": 90}},
          {"x": 0, "y": 1, "level": 2, "boundBox": {"minX": -180, "minY": 0, "maxX": -135, "maxY": 45}},
          {"x": 1, "y": 0, "level": 2, "boundBox": {"minX": -135, "minY": 45, "maxX": -90, "maxY": 90}},
          {"x": 0, "y": 0, "level": 2, "boundBox": {"minX": -180, "minY": 45, "maxX": -135, "maxY": 90}}
        ];
        
        wtfs.initTDT(tileConfig);
        
        return wtfs;
      }
    },
    {
      id: 'imagery',
      name: '天地图-影像',
      thumbnail: ImgImg,
      provider: (token: string) => {
        return [
          // 影像底图
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            layer: "img",
            style: "default",
            format: "tiles",
            subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
            tileMatrixSetID: "GoogleMapsCompatible",
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© 天地图'
          }),
          // 影像标注
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 18,
            layer: "cia",
            style: "default",
            format: "tiles",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          })
        ]
      }
    },
    {
      id: 'terrain',
      name: '天地图-地形',
      thumbnail: TerImg,
      provider: (token: string) => {
        return [
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 14,  // 限制地形图最大缩放级别
            format: "tiles",
            layer: "ter",
            style: "default",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          }),
          new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cta&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 14,  // 限制地形标注最大缩放级别
            layer: "cta",
            style: "default",
            format: "tiles",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          })
        ]
      }
    }
  ];
