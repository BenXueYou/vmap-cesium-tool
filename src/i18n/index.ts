import zhCN from "./zh-CN";
import enUS from "./en-US";

interface I18nConfig {
  persist?: boolean;
  useStoredLocale?: boolean;
}

interface I18nMessages {
  [key: string]: any;
}

interface I18nLike {
  t(key: string, params?: Record<string, any>, locale?: string): string;
  getLocale(): string;
  setLocale(locale: string, options?: { persist?: boolean }): void;
  onLocaleChange(callback: (locale: string) => void): () => void;
  addMessages(locale: string, messages: I18nMessages, options?: { merge?: boolean }): void;
  configure(config: I18nConfig): void;
  bindElement(element: HTMLElement, key: string, attribute: string): void;
  updateTree(element: HTMLElement): void;
}

class SimpleI18n implements I18nLike {
  private currentLocale: string = 'zh-CN';
  private messages: Record<string, I18nMessages> = {};
  private localeChangeCallbacks: ((locale: string) => void)[] = [];
  private config: I18nConfig = {};

  constructor() {
    // Load default messages
    this.addMessages('zh-CN', zhCN);
    this.addMessages('en-US', enUS);
    
    // Try to load from localStorage
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('vmap-locale');
      if (stored && (stored === 'zh-CN' || stored === 'en-US')) {
        this.currentLocale = stored;
      }
    }
  }

  configure(config: I18nConfig): void {
    this.config = { ...this.config, ...config };
    if (config.useStoredLocale && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('vmap-locale');
      if (stored && (stored === 'zh-CN' || stored === 'en-US')) {
        this.currentLocale = stored;
      }
    }
  }

  addMessages(locale: string, messages: I18nMessages, options?: { merge?: boolean }): void {
    if (options?.merge && this.messages[locale]) {
      this.messages[locale] = this.deepMerge(this.messages[locale], messages);
    } else {
      this.messages[locale] = { ...messages };
    }
  }

  t(key: string, params?: Record<string, any>, locale?: string): string {
    const targetLocale = locale || this.currentLocale;
    const messages = this.messages[targetLocale] || this.messages['zh-CN'] || {};
    
    const value = this.getNestedValue(messages, key);
    if (typeof value === 'string') {
      return this.interpolate(value, params || {});
    }
    return key;
  }

  getLocale(): string {
    return this.currentLocale;
  }

  setLocale(locale: string, options?: { persist?: boolean }): void {
    if (locale !== this.currentLocale) {
      this.currentLocale = locale;
      
      if ((options?.persist !== false && this.config.persist) || options?.persist) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('vmap-locale', locale);
        }
      }
      
      this.localeChangeCallbacks.forEach(callback => callback(locale));
    }
  }

  onLocaleChange(callback: (locale: string) => void): () => void {
    this.localeChangeCallbacks.push(callback);
    return () => {
      const index = this.localeChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.localeChangeCallbacks.splice(index, 1);
      }
    };
  }

  bindElement(element: HTMLElement, key: string, attribute: string): void {
    // 存根实现 - 保持向后兼容
    const text = this.t(key);
    if (attribute === 'textContent') {
      element.textContent = text;
    } else if (attribute === 'title') {
      element.setAttribute('title', text);
    } else {
      element.setAttribute(attribute, text);
    }
  }

  updateTree(element: HTMLElement): void {
    // 存根实现 - 保持向后兼容
    // 递归更新DOM树中的国际化文本
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private interpolate(template: string, params: Record<string, any>): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

export const i18n = new SimpleI18n();
export type { I18nLike };