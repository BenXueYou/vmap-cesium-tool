import * as Cesium from 'cesium';
import type { Viewer } from 'cesium';
import DrawHelper from './CesiumMapHelper';
import type { MapType, ToolbarConfig, SearchCallback, MeasurementCallback, ZoomCallback } from './CesiumMapModel';
import VecImg from '../assets/images/vec_c.png'; // 矢量图标
import TerImg from '../assets/images/ter_c.png'; // 地形
import ImgImg from '../assets/images/img_c.png'; // 影像
import EleImg from '../assets/images/ele_c.jpg'; // 三维


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
            url: `http://t{s}.tianditu.com/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=vec&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            layer: "tdtVecBasicLayer",
            style: "default",
            tileMatrixSetID: "GoogleMapsCompatible",
            minimumLevel: 1,
            maximumLevel: 18,
            credit: '© 天地图'
          }),
          new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t{s}.tianditu.com/cva_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=cva&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default.jpg&tk=${token}`,
            layer: "tdtAnnoLayer",
            style: "default",
            format: "image/jpeg",
            subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
            tileMatrixSetID: "GoogleMapsCompatible"
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
            new Cesium.WebMapTileServiceImageryProvider({
            url: `https://t{s}.tianditu.gov.cn/ter_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 18,
            layer: "tdtVecBasicLayer",
            style: "default",
            format: "image/jpeg",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          })
        ]
      }
    },
    {
      id: 'imagery',
      name: '天地图-影像',
      thumbnail: ImgImg,
      provider: (token: string) => {
        return [
          new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t{s}.tianditu.com/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`,
            layer: "tdtBasicLayer",
            style: "default",
            format: "image/jpeg",
            subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
            tileMatrixSetID: "GoogleMapsCompatible"
          }),
          new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t{s}.tianditu.com/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 18,
            format: "image/jpeg",
            layer: "tdtVecBasicLayer",
            style: "default",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          }),
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
            maximumLevel: 18,
            format: "image/jpeg",
            layer: "tdtVecBasicLayer",
            style: "default",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          }),
          new Cesium.WebMapTileServiceImageryProvider({
            url: `http://t{s}.tianditu.gov.cn/cta_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ter&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=${token}`,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            minimumLevel: 1,
            maximumLevel: 18,
            format: "image/jpeg",
            layer: "tdtVecBasicLayer",
            style: "default",
            tileMatrixSetID: "GoogleMapsCompatible",
            credit: '© 天地图'
          }),
        ]
      }
    }
  ];
