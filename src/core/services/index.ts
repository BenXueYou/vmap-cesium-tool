/**
 * 服务模块入口
 * 
 * @packageDocumentation
 */

// 导出覆盖物服务
export { OverlayService, resolveOverlayPickCandidates } from './overlay';
export type {
  OverlayPickCandidate,
  OverlayPickReason,
  OverlayPickResolverOptions,
  OverlayPickRoot,
  OverlayServiceOptions,
} from './overlay';

// 导出绘制服务
export { DrawService } from './draw';
export type { DrawMode, DrawOptions, DrawResult, DrawServiceOptions, MeasurementFillStyle, MeasurementLabelOffset, MeasurementStrokeStyle, MeasurementSummaryLabelStyle, MeasurementTheme, MeasurementVertexStyle } from './draw';

// 导出工具栏服务（新架构）
export * from './toolbar/index';

// 导出标绘服务
export * from './mark';
