import type { Viewer } from 'cesium';
/** 隐藏 Cesium 默认的 credit 文本、logo 及 credit 弹层。 */
export declare function hideCesiumCredit(viewer: Viewer): void;
/** 根据配置显示或隐藏 Cesium credit 区域。默认应保持显示以满足版权要求。 */
export declare function setCesiumCreditVisible(viewer: Viewer, visible: boolean): void;
