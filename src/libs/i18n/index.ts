import zhCN from "./zh-CN";
import enUS from "./en-US";

type Locale = "zh-CN" | "en-US" | (string & {});
type I18nDict = Record<string, any>;

interface I18nLike {
  getLocale(): Locale;
  setLocale(locale: Locale, options?: { persist?: boolean }): void;
  t(key: string, params?: Record<string, any>, localeOverride?: Locale): string;
  onLocaleChange(cb: (locale: Locale) => void): () => void;
  bindElement(el: HTMLElement, key: string, attr?: "text" | "title" | "placeholder", params?: Record<string, any>): void;
  updateTree(root: HTMLElement): void;
  addMessages?(locale: Locale, dict: I18nDict, options?: { merge?: boolean }): void;
  setFallbackLocale?(locale: Locale): void;
  configure?(options: { persist?: boolean; useStoredLocale?: boolean; fallbackLocale?: Locale; locale?: Locale }): void;
}

const I18N_STORAGE_KEY = "vmap-cesium-tool-locale";

const dictionaries: Record<string, I18nDict> = {
  [zhCN.locale]: zhCN,
  [enUS.locale]: enUS,
};

let fallbackLocale: Locale = "zh-CN";
let persistLocale = false;
let useStoredLocale = false;

let currentLocale: Locale = ((): Locale => {
  if (typeof window === "undefined") return fallbackLocale;
  const nav = navigator.language || fallbackLocale;
  return (dictionaries[nav] ? nav : fallbackLocale) as Locale;
})();

const listeners = new Set<(locale: Locale) => void>();

const getByPath = (obj: I18nDict, path: string): string | undefined => {
  return path.split(".").reduce<any>((acc, key) => (acc ? acc[key] : undefined), obj);
};

const format = (template: string, params?: Record<string, any>) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value === undefined || value === null ? "" : String(value);
  });
};

export const i18n: I18nLike = {
  getLocale(): Locale {
    return currentLocale;
  },
  setLocale(locale: Locale, options?: { persist?: boolean }) {
    if (!dictionaries[locale]) return;
    currentLocale = locale;
    const shouldPersist = options?.persist ?? persistLocale;
    if (shouldPersist && typeof window !== "undefined") {
      window.localStorage.setItem(I18N_STORAGE_KEY, locale);
    }
    listeners.forEach((cb) => cb(locale));
  },
  addMessages(locale: Locale, dict: I18nDict, options?: { merge?: boolean }) {
    const shouldMerge = options?.merge ?? true;
    if (shouldMerge && dictionaries[locale]) {
      dictionaries[locale] = { ...dictionaries[locale], ...dict };
    } else {
      dictionaries[locale] = dict;
    }
  },
  setFallbackLocale(locale: Locale) {
    if (!dictionaries[locale]) return;
    fallbackLocale = locale;
  },
  configure(options: { persist?: boolean; useStoredLocale?: boolean; fallbackLocale?: Locale; locale?: Locale }) {
    if (typeof options.persist === "boolean") persistLocale = options.persist;
    if (typeof options.useStoredLocale === "boolean") useStoredLocale = options.useStoredLocale;
    if (options.fallbackLocale && dictionaries[options.fallbackLocale]) {
      fallbackLocale = options.fallbackLocale;
    }
    if (typeof window !== "undefined" && useStoredLocale) {
      const saved = window.localStorage.getItem(I18N_STORAGE_KEY);
      if (saved && dictionaries[saved]) {
        currentLocale = saved as Locale;
      }
    }
    if (options.locale && dictionaries[options.locale]) {
      currentLocale = options.locale;
    }
    listeners.forEach((cb) => cb(currentLocale));
  },
  t(key: string, params?: Record<string, any>, localeOverride?: Locale) {
    const locale = localeOverride || currentLocale;
    const dict = dictionaries[locale] || dictionaries[fallbackLocale];
    const fallback = dictionaries[fallbackLocale];
    const value = getByPath(dict, key) ?? getByPath(fallback, key) ?? key;
    return typeof value === "string" ? format(value, params) : String(value);
  },
  onLocaleChange(cb: (locale: Locale) => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  bindElement(el: HTMLElement, key: string, attr: "text" | "title" | "placeholder" = "text", params?: Record<string, any>) {
    el.dataset.i18nKey = key;
    el.dataset.i18nAttr = attr;
    if (params) {
      el.dataset.i18nParams = JSON.stringify(params);
    }
    this.updateElement(el);
  },
  updateElement(el: HTMLElement) {
    const key = el.dataset.i18nKey;
    if (!key) return;
    const attr = (el.dataset.i18nAttr as "text" | "title" | "placeholder") || "text";
    let params: Record<string, any> | undefined;
    if (el.dataset.i18nParams) {
      try {
        params = JSON.parse(el.dataset.i18nParams);
      } catch {
        params = undefined;
      }
    }
    const value = this.t(key, params);
    if (attr === "title") {
      el.title = value;
    } else if (attr === "placeholder") {
      (el as HTMLInputElement).placeholder = value;
    } else {
      el.textContent = value;
    }
  },
  updateTree(root: HTMLElement) {
    root.querySelectorAll<HTMLElement>("[data-i18n-key]").forEach((el) => this.updateElement(el));
  },
};

export type { Locale, I18nLike };