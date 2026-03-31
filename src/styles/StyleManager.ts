/**
 * 样式管理器
 * 负责管理组件样式，支持样式隔离、主题切换和动态样式注入
 */

export interface StyleRule {
  selector: string;
  properties: Record<string, string>;
}

export interface Theme {
  name: string;
  variables: Record<string, string>;
  rules: StyleRule[];
}

export interface StyleManagerConfig {
  prefix?: string;
  isolateStyles?: boolean;
  defaultTheme?: string;
}

/**
 * 样式管理器类
 */
export class StyleManager {
  private static instance: StyleManager;
  private styleElement: HTMLStyleElement | null = null;
  private styles: Map<string, string> = new Map();
  private themes: Map<string, Theme> = new Map();
  private config: StyleManagerConfig;
  private currentTheme: string;

  /**
   * 私有构造函数（单例模式）
   */
  private constructor(config: StyleManagerConfig = {}) {
    this.config = {
      prefix: 'vmap-',
      isolateStyles: true,
      defaultTheme: 'default',
      ...config,
    };

    this.currentTheme = this.config.defaultTheme!;
    this.init();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: StyleManagerConfig): StyleManager {
    if (!StyleManager.instance) {
      StyleManager.instance = new StyleManager(config);
    }
    return StyleManager.instance;
  }

  /**
   * 初始化样式管理器
   */
  private init(): void {
    // 创建样式元素
    this.styleElement = document.createElement('style');
    this.styleElement.id = `${this.config.prefix}styles`;
    document.head.appendChild(this.styleElement);

    // 添加默认主题
    this.addDefaultTheme();

    // 应用默认主题
    this.applyTheme(this.currentTheme);
  }

  /**
   * 添加默认主题
   */
  private addDefaultTheme(): void {
    const defaultTheme: Theme = {
      name: 'default',
      variables: {
        '--primary-color': '#4285f4',
        '--primary-hover-color': '#3367d6',
        '--primary-active-color': '#1a73e8',
        '--background-color': 'rgba(255, 255, 255, 0.95)',
        '--border-color': '#e0e0e0',
        '--text-color': '#333333',
        '--text-secondary-color': '#666666',
        '--border-radius': '6px',
        '--box-shadow': '0 2px 10px rgba(0, 0, 0, 0.1)',
        '--transition-speed': '0.2s',
        '--button-size': '40px',
        '--button-spacing': '8px',
      },
      rules: [
        // 容器样式
        {
          selector: `.${this.config.prefix}container`,
          properties: {
            position: 'relative',
            width: '100%',
            height: '100%',
          },
        },
        // 工具栏样式
        {
          selector: `.${this.config.prefix}toolbar`,
          properties: {
            position: 'absolute',
            background: 'var(--background-color)',
            border: '1px solid var(--border-color)',
            'border-radius': 'var(--border-radius)',
            'box-shadow': 'var(--box-shadow)',
            padding: '8px',
            'z-index': '1000',
            display: 'flex',
            'flex-direction': 'column',
            gap: 'var(--button-spacing)',
          },
        },
        // 按钮样式
        {
          selector: `.${this.config.prefix}button`,
          properties: {
            width: 'var(--button-size)',
            height: 'var(--button-size)',
            'background-color': 'rgba(var(--primary-color-rgb), 0.4)',
            color: 'white',
            border: 'none',
            'border-radius': '4px',
            cursor: 'pointer',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': '14px',
            'font-weight': 'bold',
            transition: 'all var(--transition-speed) ease',
            'user-select': 'none',
          },
        },
        // 按钮悬停状态
        {
          selector: `.${this.config.prefix}button:hover`,
          properties: {
            'background-color': 'rgba(var(--primary-hover-color-rgb), 0.9)',
            transform: 'scale(1.05)',
          },
        },
        // 按钮激活状态
        {
          selector: `.${this.config.prefix}button.active`,
          properties: {
            'background-color': 'rgba(var(--primary-active-color-rgb), 0.9)',
          },
        },
        // 搜索框样式
        {
          selector: `.${this.config.prefix}search-box`,
          properties: {
            position: 'relative',
            'min-width': '200px',
          },
        },
        // 搜索输入框样式
        {
          selector: `.${this.config.prefix}search-box input`,
          properties: {
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ddd',
            'border-radius': '4px',
            'font-size': '14px',
            outline: 'none',
            'box-sizing': 'border-box',
          },
        },
        // 搜索结果样式
        {
          selector: `.${this.config.prefix}search-results`,
          properties: {
            position: 'absolute',
            top: '100%',
            left: '0',
            right: '0',
            background: 'white',
            border: '1px solid #ddd',
            'border-radius': '4px',
            'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.1)',
            'margin-top': '4px',
            'max-height': '300px',
            'overflow-y': 'auto',
            'z-index': '1001',
          },
        },
        // 搜索结果项样式
        {
          selector: `.${this.config.prefix}search-result`,
          properties: {
            padding: '8px 12px',
            'border-bottom': '1px solid #f0f0f0',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          },
        },
        // 搜索结果项悬停状态
        {
          selector: `.${this.config.prefix}search-result:hover`,
          properties: {
            'background-color': '#f5f5f5',
          },
        },
      ],
    };

    // 转换颜色变量
    this.convertColorVariables(defaultTheme);
    this.themes.set('default', defaultTheme);
  }

  /**
   * 转换颜色变量（将十六进制转换为RGB）
   */
  private convertColorVariables(theme: Theme): void {
    const colorVars: Record<string, string> = {};

    Object.entries(theme.variables).forEach(([key, value]) => {
      if (key.includes('color') && value.startsWith('#')) {
        const rgb = this.hexToRgb(value);
        if (rgb) {
          const rgbKey = key.replace('color', 'color-rgb');
          colorVars[rgbKey] = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        }
      }
    });

    theme.variables = { ...theme.variables, ...colorVars };
  }

  /**
   * 十六进制颜色转换为RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * 添加样式规则
   * @param id 样式ID
   * @param cssText CSS文本
   */
  addStyle(id: string, cssText: string): void {
    this.styles.set(id, cssText);
    this.updateStyleElement();
  }

  /**
   * 移除样式规则
   * @param id 样式ID
   */
  removeStyle(id: string): boolean {
    const removed = this.styles.delete(id);
    if (removed) {
      this.updateStyleElement();
    }
    return removed;
  }

  /**
   * 添加主题
   * @param theme 主题配置
   */
  addTheme(theme: Theme): void {
    this.convertColorVariables(theme);
    this.themes.set(theme.name, theme);
  }

  /**
   * 移除主题
   * @param name 主题名称
   */
  removeTheme(name: string): boolean {
    return this.themes.delete(name);
  }

  /**
   * 应用主题
   * @param name 主题名称
   */
  applyTheme(name: string): boolean {
    const theme = this.themes.get(name);
    if (!theme) return false;

    this.currentTheme = name;
    this.updateStyleElement();
    return true;
  }

  /**
   * 获取当前主题
   */
  getCurrentTheme(): string {
    return this.currentTheme;
  }

  /**
   * 获取主题配置
   * @param name 主题名称
   */
  getTheme(name: string): Theme | undefined {
    return this.themes.get(name);
  }

  /**
   * 获取所有主题名称
   */
  getThemeNames(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * 更新样式变量
   * @param variables 变量映射
   */
  updateVariables(variables: Record<string, string>): void {
    const theme = this.themes.get(this.currentTheme);
    if (!theme) return;

    theme.variables = { ...theme.variables, ...variables };
    this.convertColorVariables(theme);
    this.updateStyleElement();
  }

  /**
   * 获取CSS变量值
   * @param name 变量名
   */
  getVariable(name: string): string | undefined {
    const theme = this.themes.get(this.currentTheme);
    return theme?.variables[name];
  }

  /**
   * 设置CSS变量值
   * @param name 变量名
   * @param value 变量值
   */
  setVariable(name: string, value: string): void {
    this.updateVariables({ [name]: value });
  }

  /**
   * 生成作用域选择器
   * @param selector 原始选择器
   */
  scopedSelector(selector: string): string {
    if (!this.config.isolateStyles) return selector;

    // 为选择器添加作用域前缀
    if (selector.startsWith('.')) {
      return `.${this.config.prefix}${selector.slice(1)}`;
    }

    return selector;
  }

  /**
   * 更新样式元素内容
   */
  private updateStyleElement(): void {
    if (!this.styleElement) return;

    const theme = this.themes.get(this.currentTheme);
    if (!theme) return;

    let cssText = '';

    // 添加CSS变量
    cssText += `:root {\n`;
    Object.entries(theme.variables).forEach(([key, value]) => {
      cssText += `  ${key}: ${value};\n`;
    });
    cssText += `}\n\n`;

    // 添加主题规则
    theme.rules.forEach(rule => {
      const scopedSelector = this.scopedSelector(rule.selector);
      cssText += `${scopedSelector} {\n`;
      Object.entries(rule.properties).forEach(([property, value]) => {
        cssText += `  ${property}: ${value};\n`;
      });
      cssText += `}\n\n`;
    });

    // 添加自定义样式
    this.styles.forEach(style => {
      cssText += `${style}\n\n`;
    });

    this.styleElement.textContent = cssText;
  }

  /**
   * 生成组件样式
   * @param componentName 组件名称
   * @param styles 样式对象
   */
  generateComponentStyles(componentName: string, styles: Record<string, string>): string {
    const selector = `.${this.config.prefix}${componentName}`;
    let cssText = `${selector} {\n`;

    Object.entries(styles).forEach(([property, value]) => {
      cssText += `  ${property}: ${value};\n`;
    });

    cssText += `}\n`;
    return cssText;
  }

  /**
   * 注入组件样式
   * @param componentName 组件名称
   * @param styles 样式对象
   * @returns 样式ID
   */
  injectComponentStyles(componentName: string, styles: Record<string, string>): string {
    const styleId = `${componentName}-styles`;
    const cssText = this.generateComponentStyles(componentName, styles);
    this.addStyle(styleId, cssText);
    return styleId;
  }

  /**
   * 销毁样式管理器
   */
  destroy(): void {
    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }
    this.styles.clear();
    this.themes.clear();
    // @ts-ignore
    StyleManager.instance = null;
  }
}

/**
 * 创建样式管理器的工厂函数
 */
export function createStyleManager(config?: StyleManagerConfig): StyleManager {
  return StyleManager.getInstance(config);
}

/**
 * 默认导出样式管理器实例
 */
export const styleManager = StyleManager.getInstance();