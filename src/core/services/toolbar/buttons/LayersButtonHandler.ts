/**
 * 图层按钮处理器
 * 处理图层切换功能的按钮点击、菜单显示等逻辑
 */

import type { LayersPanelStyleConfig } from '../../../../core/types';
import type { ToolbarButton } from '../../../../components/ToolbarButton';
import { BaseMenu } from '../menus/BaseMenu';

export interface MapTypeConfig {
  id: string;
  name: string;
  nameKey?: string;
  thumbnail?: string;
  placeNameLabel?: string;
  placeNameLabelKey?: string;
  forcePlaceName?: boolean;
}

export interface LayersButtonHandlerOptions {
  layersService?: any;
  mapTypes?: MapTypeConfig[];
  currentMapType?: string;
  isPlaceNameChecked?: boolean;
  token?: string;
  isNoFlyZoneChecked?: boolean;
  onMapTypeChange?: (mapTypeId: string) => void;
  onPlaceNameToggle?: (isChecked: boolean) => void;
  onShowNoFlyZones?: () => Promise<void>;
  onNoFlyZoneToggle?: (isChecked: boolean) => void;
  panelStyle?: LayersPanelStyleConfig;
}

interface LayersPanelSectionOptions {
  title: string;
  titleKey?: string;
}

interface ResolvedPanelStyles {
  container: Partial<CSSStyleDeclaration>;
  section: Partial<CSSStyleDeclaration>;
  sectionTitle: Partial<CSSStyleDeclaration>;
  mapTypesGrid: Partial<CSSStyleDeclaration>;
  mapTypeCard: Partial<CSSStyleDeclaration>;
  mapTypeCardSelected: Partial<CSSStyleDeclaration>;
  mapTypeCardHover: Partial<CSSStyleDeclaration>;
  mapTypeCardSelectedHover: Partial<CSSStyleDeclaration>;
  mapTypeThumbnail: Partial<CSSStyleDeclaration>;
  mapTypeLabel: Partial<CSSStyleDeclaration>;
  mapTypeCheckmark: Partial<CSSStyleDeclaration>;
  mapTypeCheckmarkSelected: Partial<CSSStyleDeclaration>;
  placeNameBadge: Partial<CSSStyleDeclaration>;
  placeNameCheckbox: Partial<CSSStyleDeclaration>;
  placeNameText: Partial<CSSStyleDeclaration>;
  noFlyZoneItem: Partial<CSSStyleDeclaration>;
  noFlyZoneItemHover: Partial<CSSStyleDeclaration>;
  noFlyZoneCheckbox: Partial<CSSStyleDeclaration>;
  noFlyZoneLabel: Partial<CSSStyleDeclaration>;
  noFlyZoneDot: Partial<CSSStyleDeclaration>;
}

export class LayersButtonHandler extends BaseMenu {
  readonly id = 'layers';

  private options: LayersButtonHandlerOptions;
  private button: ToolbarButton | null = null;
  private panelStyle: LayersPanelStyleConfig;

  constructor(
    toolbarElement: HTMLElement,
    options: LayersButtonHandlerOptions = {},
    i18n?: any,
    useI18n: boolean = true,
  ) {
    super(toolbarElement, i18n, useI18n);
    this.options = options;
    this.panelStyle = options.panelStyle || {};
  }

  show(anchor: HTMLElement): void {
    if (this.isDestroyed) return;

    this.hide();

    const styles = this.getPanelStyles();
    this.menuElement = this.createMenuContainer('layers-menu', styles.container);
    this.positionMenu(anchor, { position: 'left' });

    const mapTypesSection = this.createSection({
      title: '地图类型',
      titleKey: 'layers.base_maps',
    }, styles);

    const mapTypesGrid = document.createElement('div');
    Object.assign(mapTypesGrid.style, styles.mapTypesGrid);

    const currentType = this.options.currentMapType || 'img';
    (this.options.mapTypes || []).forEach((mapType) => {
      mapTypesGrid.appendChild(this.createMapTypeItem(mapType, currentType, styles));
    });

    mapTypesSection.appendChild(mapTypesGrid);
    this.menuElement.appendChild(mapTypesSection);

    const assistanceSection = this.createSection({
      title: '叠加图层',
      titleKey: 'layers.assistance',
    }, styles);
    assistanceSection.appendChild(this.createNoFlyZoneItem(styles));
    this.menuElement.appendChild(assistanceSection);

    this.toolbarElement!.appendChild(this.menuElement);
    this.anchorElement = anchor;
    this.adjustPosition();
    this.setupAutoClose();
  }

  initialize(button: ToolbarButton): void {
    this.button = button;

    if (this.useI18n && this.i18n) {
      this.i18n.bindElement(button.getElement(), 'toolbar.layers', 'title');
    } else {
      button.setAttribute('title', '图层切换');
    }
  }

  handleClick(): void {
    if (!this.toolbarElement || !this.button) return;
    this.toggle(this.button.getElement());
  }

  handleMouseEnter(): void {}

  handleMouseLeave(): void {
    if (this.menuElement) {
      setTimeout(() => {
        if (this.menuElement && !this.menuElement.matches(':hover')) {
          this.hide();
        }
      }, 100);
    }
  }

  destroy(): void {
    super.destroy();
    this.button = null;
  }

  updateOptions(options: Partial<LayersButtonHandlerOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };

    if (options.panelStyle) {
      this.panelStyle = {
        ...this.panelStyle,
        ...options.panelStyle,
      };
    }
  }

  private createSection(options: LayersPanelSectionOptions, styles: ResolvedPanelStyles): HTMLElement {
    const section = document.createElement('section');
    Object.assign(section.style, styles.section);

    const title = document.createElement('div');
    Object.assign(title.style, styles.sectionTitle);
    if (options.titleKey && this.useI18n && this.i18n) {
      this.i18n.bindElement(title, options.titleKey, 'textContent');
    } else {
      title.textContent = options.title;
    }

    section.appendChild(title);
    return section;
  }

  private createMapTypeItem(
    mapType: MapTypeConfig,
    currentType: string,
    styles: ResolvedPanelStyles,
  ): HTMLElement {
    const isSelected = mapType.id === currentType;
    const item = document.createElement('div');
    item.setAttribute('data-map-type', mapType.id);
    Object.assign(item.style, styles.mapTypeCard);
    if (isSelected) {
      Object.assign(item.style, styles.mapTypeCardSelected);
    }

    const thumbnail = document.createElement('div');
    Object.assign(thumbnail.style, styles.mapTypeThumbnail);
    if (mapType.thumbnail) {
      thumbnail.style.backgroundImage = `url(${mapType.thumbnail})`;
    }

    if (isSelected) {
      const placeNameBadge = this.createPlaceNameToggle(mapType, styles);
      if (placeNameBadge) {
        thumbnail.appendChild(placeNameBadge);
      }
    }

    const checkmark = document.createElement('span');
    checkmark.textContent = isSelected ? '✓' : '';
    Object.assign(checkmark.style, styles.mapTypeCheckmark);
    if (isSelected) {
      Object.assign(checkmark.style, styles.mapTypeCheckmarkSelected);
    }
    thumbnail.appendChild(checkmark);

    const label = document.createElement('div');
    label.textContent = mapType.nameKey && this.useI18n ? this.t(mapType.nameKey) : mapType.name;
    Object.assign(label.style, styles.mapTypeLabel);

    item.appendChild(thumbnail);
    item.appendChild(label);

    item.addEventListener('mouseenter', () => {
      Object.assign(item.style, styles.mapTypeCard);
      Object.assign(item.style, isSelected ? styles.mapTypeCardSelectedHover : styles.mapTypeCardHover);
    });

    item.addEventListener('mouseleave', () => {
      Object.assign(item.style, styles.mapTypeCard);
      if (isSelected) {
        Object.assign(item.style, styles.mapTypeCardSelected);
      }
    });

    item.addEventListener('click', () => {
      this.selectMapType(mapType.id);
    });

    return item;
  }

  private createPlaceNameToggle(mapType: MapTypeConfig, styles: ResolvedPanelStyles): HTMLElement | null {
    const forceChecked = !!mapType.forcePlaceName;
    const checked = forceChecked || (this.options.isPlaceNameChecked ?? true);
    const labelText = mapType.placeNameLabel
      || (mapType.placeNameLabelKey ? this.t(mapType.placeNameLabelKey) : this.t('layers.map_type.place_name'));

    const wrapper = document.createElement('label');
    Object.assign(wrapper.style, styles.placeNameBadge);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.disabled = forceChecked;
    Object.assign(checkbox.style, styles.placeNameCheckbox);
    checkbox.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    checkbox.addEventListener('change', (event) => {
      event.stopPropagation();
      this.togglePlaceName((event.target as HTMLInputElement).checked);
    });

    const text = document.createElement('span');
    text.textContent = labelText;
    Object.assign(text.style, styles.placeNameText);

    wrapper.appendChild(checkbox);
    wrapper.appendChild(text);
    return wrapper;
  }

  private createNoFlyZoneItem(styles: ResolvedPanelStyles): HTMLElement {
    const item = document.createElement('label');
    item.setAttribute('data-no-fly-zone', 'true');
    Object.assign(item.style, styles.noFlyZoneItem);

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '8px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.options.isNoFlyZoneChecked ?? false;
    Object.assign(checkbox.style, styles.noFlyZoneCheckbox);
    checkbox.addEventListener('change', (event) => {
      event.stopPropagation();
      this.toggleNoFlyZone((event.target as HTMLInputElement).checked);
    });

    const dot = document.createElement('span');
    Object.assign(dot.style, styles.noFlyZoneDot);

    const label = document.createElement('span');
    label.textContent = this.useI18n ? this.t('layers.no_fly_zone') : '机场禁飞区';
    Object.assign(label.style, styles.noFlyZoneLabel);

    left.appendChild(checkbox);
    left.appendChild(dot);
    left.appendChild(label);
    item.appendChild(left);

    item.addEventListener('mouseenter', () => {
      Object.assign(item.style, styles.noFlyZoneItem);
      Object.assign(item.style, styles.noFlyZoneItemHover);
    });

    item.addEventListener('mouseleave', () => {
      Object.assign(item.style, styles.noFlyZoneItem);
    });

    return item;
  }

  private selectMapType(mapTypeId: string): void {
    this.options.currentMapType = mapTypeId;
    this.options.onMapTypeChange?.(mapTypeId);

    if (this.options.layersService && typeof this.options.layersService.setMapType === 'function') {
      this.options.layersService.setMapType(mapTypeId);
    }

    if (this.menuElement && this.toolbarElement) {
      this.hide();
      const anchor = this.button?.getElement();
      if (anchor) {
        setTimeout(() => this.show(anchor), 50);
      }
    }
  }

  private toggleNoFlyZone(isChecked: boolean): void {
    this.options.isNoFlyZoneChecked = isChecked;
    this.options.onNoFlyZoneToggle?.(isChecked);

    if (isChecked && this.options.onShowNoFlyZones) {
      void this.options.onShowNoFlyZones();
    }
  }

  private togglePlaceName(isChecked: boolean): void {
    this.options.isPlaceNameChecked = isChecked;
    this.options.onPlaceNameToggle?.(isChecked);

    if (this.menuElement && this.toolbarElement) {
      this.hide();
      const anchor = this.button?.getElement();
      if (anchor) {
        setTimeout(() => this.show(anchor), 50);
      }
    }
  }

  private getPanelStyles(): ResolvedPanelStyles {
    return {
      container: {
        minWidth: '438px',
        padding: '10px 12px 12px',
        background: 'rgba(4, 39, 73, 0.96)',
        border: '1px solid rgba(24, 124, 255, 0.85)',
        borderRadius: '0',
        boxShadow: '0 8px 18px rgba(0, 0, 0, 0.28)',
        ...this.panelStyle.containerStyle,
      },
      section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        ...this.panelStyle.sectionStyle,
      },
      sectionTitle: {
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: '700',
        lineHeight: '18px',
        ...this.panelStyle.sectionTitleStyle,
      },
      mapTypesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(88px, 1fr))',
        gap: '12px',
        ...this.panelStyle.mapTypesGridStyle,
      },
      mapTypeCard: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        cursor: 'pointer',
        position: 'relative',
        color: '#ffffff',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease',
        ...this.panelStyle.mapTypeCardStyle,
      },
      mapTypeCardSelected: {
        ...this.panelStyle.mapTypeCardSelectedStyle,
      },
      mapTypeCardHover: {
        transform: 'translateY(-1px)',
        ...this.panelStyle.mapTypeCardHoverStyle,
      },
      mapTypeCardSelectedHover: {
        transform: 'translateY(-1px)',
        ...this.panelStyle.mapTypeCardSelectedHoverStyle,
      },
      mapTypeThumbnail: {
        position: 'relative',
        width: '100%',
        height: '52px',
        border: '1px solid rgba(153, 196, 255, 0.4)',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        boxShadow: 'inset 0 0 0 1px rgba(8, 60, 112, 0.35)',
        ...this.panelStyle.mapTypeThumbnailStyle,
      },
      mapTypeLabel: {
        fontSize: '12px',
        lineHeight: '16px',
        textAlign: 'center',
        color: '#ffffff',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...this.panelStyle.mapTypeLabelStyle,
      },
      mapTypeCheckmark: {
        position: 'absolute',
        top: '4px',
        right: '4px',
        width: '16px',
        height: '16px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(6, 39, 78, 0.9)',
        color: 'transparent',
        border: '1px solid rgba(147, 196, 255, 0.55)',
        fontSize: '11px',
        lineHeight: '1',
        ...this.panelStyle.mapTypeCheckmarkStyle,
      },
      mapTypeCheckmarkSelected: {
        color: '#ffffff',
        background: 'rgba(36, 124, 255, 0.95)',
        boxShadow: '0 0 8px rgba(36, 124, 255, 0.5)',
        ...this.panelStyle.mapTypeCheckmarkSelectedStyle,
      },
      placeNameBadge: {
        position: 'absolute',
        top: '4px',
        left: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 4px',
        background: 'rgba(8, 43, 83, 0.92)',
        border: '1px solid rgba(147, 196, 255, 0.55)',
        color: '#ffffff',
        fontSize: '10px',
        lineHeight: '12px',
        ...this.panelStyle.placeNameBadgeStyle,
      },
      placeNameCheckbox: {
        margin: '0',
        width: '12px',
        height: '12px',
        accentColor: '#4ea5ff',
        cursor: 'pointer',
        ...this.panelStyle.placeNameCheckboxStyle,
      },
      placeNameText: {
        color: '#ffffff',
        ...this.panelStyle.placeNameTextStyle,
      },
      noFlyZoneItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 8px 0',
        minHeight: '32px',
        borderTop: '1px solid rgba(132, 181, 255, 0.35)',
        color: '#ffffff',
        ...this.panelStyle.noFlyZoneItemStyle,
      },
      noFlyZoneItemHover: {
        ...this.panelStyle.noFlyZoneItemHoverStyle,
      },
      noFlyZoneCheckbox: {
        margin: '0',
        width: '14px',
        height: '14px',
        accentColor: '#4ea5ff',
        cursor: 'pointer',
        ...this.panelStyle.noFlyZoneCheckboxStyle,
      },
      noFlyZoneLabel: {
        color: '#ffffff',
        fontSize: '12px',
        lineHeight: '16px',
        ...this.panelStyle.noFlyZoneLabelStyle,
      },
      noFlyZoneDot: {
        width: '10px',
        height: '10px',
        borderRadius: '999px',
        background: '#ca4f67',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.18)',
        ...this.panelStyle.noFlyZoneDotStyle,
      },
    };
  }
}
