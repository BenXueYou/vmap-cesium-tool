import type { MapContainer } from './types';

/**
 * Resolve IDs in the execution document only. Element inputs retain their
 * identity, including elements from another window or without an ID.
 */
export function resolveMapContainer(input: MapContainer): HTMLElement {
  if (typeof input === 'string') {
    const container = document.getElementById(input);
    if (!container) throw new Error(`找不到 ID 为"${input}"的容器元素`);
    return container;
  }

  if (
    input?.nodeType !== 1
    || input.namespaceURI !== 'http://www.w3.org/1999/xhtml'
    || !input.ownerDocument
    || typeof input.appendChild !== 'function'
  ) {
    throw new TypeError('地图容器必须是字符串 ID 或 HTML 元素');
  }

  // Use the element's own realm when available; detached HTML documents may
  // have no defaultView, so structural checks remain necessary in that case.
  const elementClass = input.ownerDocument.defaultView?.HTMLElement;
  if (elementClass && !(input instanceof elementClass)) {
    throw new TypeError('地图容器必须是字符串 ID 或 HTML 元素');
  }
  return input;
}
