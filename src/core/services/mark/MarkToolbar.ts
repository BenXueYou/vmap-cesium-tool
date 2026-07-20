import type { MarkDrawType, MarkServiceOptions } from './markTypes';

export class MarkToolbar {
  private element: HTMLElement | null = null;
  private readonly buttonTypes: MarkDrawType[];

  constructor(
    private readonly container: HTMLElement,
    private readonly options: MarkServiceOptions,
    private readonly onSelect: (type: MarkDrawType) => void,
  ) {
    this.buttonTypes = (options.buttons?.length ? options.buttons : ['point', 'polyline', 'polygon', 'circle', 'rectangle'] as MarkDrawType[])
      .filter((item, index, array) => array.indexOf(item) === index);
  }

  mount(): void {
    if (this.element || this.options.showToolbar === false) {
      return;
    }

    const root = document.createElement('div');
    root.style.position = 'absolute';
    root.style.display = 'flex';
    root.style.gap = `${this.options.buttonSpacing ?? 8}px`;
    root.style.zIndex = String(this.options.zIndex ?? 1001);
    root.style.top = this.options.toolbarPosition?.startsWith('top') ? '12px' : '';
    root.style.bottom = this.options.toolbarPosition?.startsWith('bottom') ? '12px' : '';
    root.style.left = this.options.toolbarPosition?.endsWith('left') ? '12px' : '';
    root.style.right = this.options.toolbarPosition?.endsWith('right') ? '12px' : '';

    const items = ([
      { type: 'point', label: '点' },
      { type: 'polyline', label: '线' },
      { type: 'polygon', label: '面' },
      { type: 'circle', label: '圆' },
      { type: 'rectangle', label: '矩形' },
    ] as Array<{ type: MarkDrawType; label: string }>).filter((item) => this.buttonTypes.includes(item.type));

    items.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.style.width = `${this.options.buttonSize ?? 32}px`;
      button.style.height = `${this.options.buttonSize ?? 32}px`;
      button.style.border = '1px solid rgba(255,255,255,0.28)';
      button.style.background = 'rgba(6, 29, 62, 0.92)';
      button.style.color = '#fff';
      button.style.cursor = 'pointer';
      button.addEventListener('click', () => this.onSelect(item.type));
      root.appendChild(button);
    });

    this.container.appendChild(root);
    this.element = root;
  }

  destroy(): void {
    this.element?.remove();
    this.element = null;
  }
}
