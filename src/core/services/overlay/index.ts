/**
 * 覆盖物服务模块入口
 * 
 * @packageDocumentation
 */

// 导出覆盖物服务
export { OverlayService } from './OverlayService';
export type { OverlayServiceOptions, OverlayPickingOptions } from './OverlayService';

export {
  resolveOverlayPickCandidates,
} from './OverlayPickResolver';
export type {
  OverlayPickCandidate,
  OverlayPickReason,
  OverlayPickResolverOptions,
  OverlayPickRoot,
} from './OverlayPickResolver';
