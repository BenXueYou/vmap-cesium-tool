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
    setLocale(locale: string, options?: {
        persist?: boolean;
    }): void;
    onLocaleChange(callback: (locale: string) => void): () => void;
    addMessages(locale: string, messages: I18nMessages, options?: {
        merge?: boolean;
    }): void;
    configure(config: I18nConfig): void;
    bindElement(element: HTMLElement, key: string, attribute: string): void;
    updateTree(element: HTMLElement): void;
}
declare class SimpleI18n implements I18nLike {
    private currentLocale;
    private messages;
    private localeChangeCallbacks;
    private config;
    constructor();
    configure(config: I18nConfig): void;
    addMessages(locale: string, messages: I18nMessages, options?: {
        merge?: boolean;
    }): void;
    t(key: string, params?: Record<string, any>, locale?: string): string;
    getLocale(): string;
    setLocale(locale: string, options?: {
        persist?: boolean;
    }): void;
    onLocaleChange(callback: (locale: string) => void): () => void;
    bindElement(element: HTMLElement, key: string, attribute: string): void;
    updateTree(element: HTMLElement): void;
    private updateBoundElement;
    private getNestedValue;
    private interpolate;
    private deepMerge;
}
export declare const i18n: SimpleI18n;
export type { I18nLike };
