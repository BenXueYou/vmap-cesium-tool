import type { Viewer } from 'cesium';

/** 隐藏 Cesium 默认的 credit 文本、logo 及 credit 弹层。 */
export function hideCesiumCredit(viewer: Viewer): void {
  const widget = viewer.cesiumWidget;
  // Cesium 不同版本的 creditViewport 并不稳定，部分版本会指向承载
  // canvas 的 .cesium-widget。隐藏它会导致整张地图 display:none。
  // creditContainer 和其中的版权节点已经足以隐藏 logo/版权区域。
  const elements = [widget.creditContainer as HTMLElement | undefined];
  elements.forEach((element) => {
    if (!element) return;
    element.style.setProperty('display', 'none', 'important');
    element.setAttribute('aria-hidden', 'true');
  });
  (viewer.container as HTMLElement).querySelectorAll<HTMLElement>('.cesium-widget-credits, .cesium-credit-logoContainer, .cesium-credit-expand-link').forEach((element) => {
    element.style.setProperty('display', 'none', 'important');
    element.setAttribute('aria-hidden', 'true');
  });
}

/** 根据配置显示或隐藏 Cesium credit 区域。使用方应按地图服务授权要求决定是否显示。 */
export function setCesiumCreditVisible(viewer: Viewer, visible: boolean): void {
  if (!visible) {
    hideCesiumCredit(viewer);
    return;
  }
  const widget = viewer.cesiumWidget;
  const elements = [widget.creditContainer as HTMLElement | undefined];
  elements.forEach((element) => {
    if (!element) return;
    element.style.removeProperty('display');
    element.removeAttribute('aria-hidden');
  });
  (viewer.container as HTMLElement).querySelectorAll<HTMLElement>('.cesium-widget-credits, .cesium-credit-logoContainer, .cesium-credit-expand-link').forEach((element) => {
    element.style.removeProperty('display');
    element.removeAttribute('aria-hidden');
  });
}
