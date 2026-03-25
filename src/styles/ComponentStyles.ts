import { styleManager } from './StyleManager';
import type { StyleConfig } from '../core/types';

/**
 * 组件样式工具
 * 提供组件样式的创建、管理和应用功能
 */

export interface ComponentStyleOptions {
  baseClass?: string;
  variants?: Record<string, Record<string, string>>;
  defaultVariant?: string;
}

/**
 * 组件样式类
 */
export class ComponentStyles {
  private componentName: string;
  private options: ComponentStyleOptions;
  private styleId: string | null = null;

  /**
   * 构造函数
   * @param componentName 组件名称
   * @param options 样式选项
   */
  constructor(componentName: string, options: ComponentStyleOptions = {}) {
    this.componentName = componentName;
    this.options = {
      baseClass: componentName,
      variants: {},
      defaultVariant: 'default',
      ...options,
    };
  }

  /**
   * 生成基础样式
   */
  private generateBaseStyles(): Record<string, string> {
    const baseStyles: Record<string, string> = {
      'box-sizing': 'border-box',
      position: 'relative',
    };

    // 根据组件类型添加特定样式
    switch (this.componentName) {
      case 'toolbar':
        Object.assign(baseStyles, {
          position: 'absolute',
          display: 'flex',
          'flex-direction': 'column',
          'z-index': '1000',
        });
        break;
      case 'button':
        Object.assign(baseStyles, {
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          cursor: 'pointer',
          'user-select': 'none',
          transition: 'all 0.2s ease',
        });
        break;
      case 'search-box':
        Object.assign(baseStyles, {
          position: 'relative',
          'min-width': '200px',
        });
        break;
    }

    return baseStyles;
  }

  /**
   * 生成变体样式
   */
  private generateVariantStyles(): string {
    let cssText = '';

    if (this.options.variants) {
      Object.entries(this.options.variants).forEach(([variantName, styles]) => {
        const variantClass = `${this.options.baseClass}--${variantName}`;
        cssText += `.${variantClass} {\n`;
        
        Object.entries(styles).forEach(([property, value]) => {
          cssText += `  ${property}: ${value};\n`;
        });
        
        cssText += `}\n\n`;
      });
    }

    return cssText;
  }

  /**
   * 生成状态样式
   */
  private generateStateStyles(): string {
    let cssText = '';

    // 通用状态样式
    const states = ['hover', 'active', 'focus', 'disabled'];
    
    states.forEach(state => {
      cssText += `.${this.options.baseClass}:${state} {\n`;
      
      switch (state) {
        case 'hover':
          cssText += `  opacity: 0.9;\n`;
          cssText += `  transform: translateY(-1px);\n`;
          break;
        case 'active':
          cssText += `  opacity: 0.8;\n`;
          cssText += `  transform: translateY(0);\n`;
          break;
        case 'disabled':
          cssText += `  opacity: 0.5;\n`;
          cssText += `  cursor: not-allowed;\n`;
          cssText += `  pointer-events: none;\n`;
          break;
      }
      
      cssText += `}\n\n`;
    });

    return cssText;
  }

  /**
   * 注入样式
   */
  inject(): string {
    if (this.styleId) {
      return this.styleId;
    }

    const baseStyles = this.generateBaseStyles();
    let cssText = '';

    // 基础样式
    cssText += `.${this.options.baseClass} {\n`;
    Object.entries(baseStyles).forEach(([property, value]) => {
      cssText += `  ${property}: ${value};\n`;
    });
    cssText += `}\n\n`;

    // 变体样式
    cssText += this.generateVariantStyles();

    // 状态样式
    cssText += this.generateStateStyles();

    // 注入样式
    this.styleId = styleManager.injectComponentStyles(this.componentName, baseStyles);
    
    // 添加额外的CSS文本
    if (cssText) {
      const extraStyleId = `${this.componentName}-extra-styles`;
      styleManager.addStyle(extraStyleId, cssText);
    }

    return this.styleId;
  }

  /**
   * 移除样式
   */
  remove(): void {
    if (this.styleId) {
      styleManager.removeStyle(this.styleId);
      styleManager.removeStyle(`${this.componentName}-extra-styles`);
      this.styleId = null;
    }
  }

  /**
   * 获取样式配置
   * @param variant 变体名称
   */
  getStyleConfig(variant?: string): StyleConfig {
    const className = variant 
      ? `${this.options.baseClass} ${this.options.baseClass}--${variant}`
      : this.options.baseClass!;

    return {
      className,
    };
  }

  /**
   * 应用样式到元素
   * @param element 目标元素
   * @param variant 变体名称
   */
  applyToElement(element: HTMLElement, variant?: string): void {
    const styleConfig = this.getStyleConfig(variant);
    
    if (styleConfig.className) {
      element.className = styleConfig.className;
    }
  }

  /**
   * 添加变体
   * @param variantName 变体名称
   * @param styles 样式对象
   */
  addVariant(variantName: string, styles: Record<string, string>): void {
    if (!this.options.variants) {
      this.options.variants = {};
    }
    
    this.options.variants[variantName] = styles;
    
    // 重新注入样式
    if (this.styleId) {
      this.remove();
      this.inject();
    }
  }

  /**
   * 移除变体
   * @param variantName 变体名称
   */
  removeVariant(variantName: string): void {
    if (this.options.variants && this.options.variants[variantName]) {
      delete this.options.variants[variantName];
      
      // 重新注入样式
      if (this.styleId) {
        this.remove();
        this.inject();
      }
    }
  }
}

/**
 * 预定义组件样式
 */
export const predefinedComponentStyles = {
  toolbar: new ComponentStyles('toolbar', {
    variants: {
      'top-right': {
        top: '10px',
        right: '10px',
      },
      'top-left': {
        top: '10px',
        left: '10px',
      },
      'bottom-right': {
        bottom: '10px',
        right: '10px',
      },
      'bottom-left': {
        bottom: '10px',
        left: '10px',
      },
    },
  }),

  button: new ComponentStyles('button', {
    variants: {
      primary: {
        'background-color': 'var(--primary-color)',
        color: 'white',
      },
      secondary: {
        'background-color': 'transparent',
        color: 'var(--primary-color)',
        border: '1px solid var(--primary-color)',
      },
      danger: {
        'background-color': '#f44336',
        color: 'white',
      },
      success: {
        'background-color': '#4caf50',
        color: 'white',
      },
      small: {
        width: '32px',
        height: '32px',
        'font-size': '12px',
      },
      large: {
        width: '48px',
        height: '48px',
        'font-size': '16px',
      },
    },
  }),

  searchBox: new ComponentStyles('search-box', {
    variants: {
      compact: {
        'min-width': '150px',
      },
      expanded: {
        'min-width': '300px',
      },
    },
  }),
};

/**
 * 创建组件样式的工厂函数
 */
export function createComponentStyles(
  componentName: string,
  options?: ComponentStyleOptions
): ComponentStyles {
  return new ComponentStyles(componentName, options);
}

/**
 * 获取预定义组件样式
 */
export function getPredefinedComponentStyles(componentName: keyof typeof predefinedComponentStyles): ComponentStyles {
  return predefinedComponentStyles[componentName];
}