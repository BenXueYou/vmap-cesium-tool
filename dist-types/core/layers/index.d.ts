/**
 * 图层模块入口
 *
 * @packageDocumentation
 */
export { MapLayer } from './MapLayer';
export { TDTMapLayer } from './TDTMapLayer';
export { GaodeMapLayer } from './GaodeMapLayer';
export { BaiduMapLayer } from './BaiduMapLayer';
export { OSMMapLayer } from './OSMMapLayer';
export { CustomMapLayer } from './CustomMapLayer';
export { setTDTPlugin, createTDTImageryConfig, createTDTVectorConfig, createTDTTerrainConfig, createTDT3DImageryConfig, createTDT3DTerrainProvider, createTDT3DGeoWTFS, hasTDT3DExtension, } from './TDTMapLayer';
export { HeatmapLayer } from './HeatmapLayer';
export type { HeatPoint, HeatmapGradient, HeatmapOptions } from './HeatmapLayer';
export { PointClusterLayer } from './PointClusterLayer';
export type { ClusterPoint, ClusterStyleStep, PointClusterLayerOptions } from './PointClusterLayer';
