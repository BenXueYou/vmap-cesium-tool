import { BaseComponent } from './BaseComponent';
import { i18n as defaultI18n, type I18nLike } from '../i18n';

export interface MapConfigHintOptions {
  i18n?: I18nLike;
  style?: Partial<CSSStyleDeclaration>;
}

/**
 * 地图底图未完成配置时显示的容器内提示。
 */
export class MapConfigHint extends BaseComponent {
  private readonly i18n: I18nLike;
  private readonly messageElement: HTMLSpanElement;
  private readonly unsubscribeLocaleChange: () => void;

  constructor(options: MapConfigHintOptions = {}) {
    super('div', {
      className: 'vmap-map-config-hint',
      style: {
        position: 'absolute',
        inset: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        pointerEvents: 'none',
        zIndex: '900',
        boxSizing: 'border-box',
        ...options.style,
      },
    });

    this.i18n = options.i18n ?? defaultI18n;
    this.messageElement = document.createElement('span');
    this.messageElement.className = 'vmap-map-config-hint__message';
    this.messageElement.setAttribute('role', 'status');
    this.messageElement.style.cssText = [
      'display: inline-block',
      'max-width: min(100%, 560px)',
      'padding: 9px 18px',
      'border: 1px solid rgba(83, 171, 255, 0.72)',
      'border-radius: 999px',
      'background: rgba(5, 70, 139, 0.9)',
      'box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22)',
      'color: #f4f9ff',
      'font: 500 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
      'text-align: center',
      'overflow-wrap: anywhere',
    ].join(';');
    this.element.appendChild(this.messageElement);

    this.render();
    this.unsubscribeLocaleChange = this.i18n.onLocaleChange(() => this.render());
  }

  private render(): void {
    this.messageElement.textContent = this.i18n.t('map.config_required');
  }

  destroy(): void {
    this.unsubscribeLocaleChange();
    super.destroy();
  }
}

export function createMapConfigHint(options?: MapConfigHintOptions): MapConfigHint {
  return new MapConfigHint(options);
}
