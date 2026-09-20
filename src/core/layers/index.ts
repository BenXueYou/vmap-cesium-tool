/**
 * 图层模块入口
 *
 * @packageDocumentation
 */

// 导出天地图相关工具函数
export {
  setTDTPlugin,
  createTDTImageryConfig,
  createTDTVectorConfig,
  createTDTTerrainConfig,
  createTDT3DImageryConfig,
  createTDT3DTerrainProvider,
  createTDT3DGeoWTFS,
  hasTDT3DExtension,
} from './TDTMapLayer';

// 导出热力图图层
export { HeatmapLayer } from './HeatmapLayer';
export type { HeatPoint, HeatmapGradient, HeatmapOptions } from './HeatmapLayer';

// 导出点聚合图层
export { PointClusterLayer } from './PointClusterLayer';
export type { ClusterPoint, ClusterStyleStep, PointClusterLayerOptions } from './PointClusterLayer';
