import type { MarkDrawType, MarkServiceOptions } from './markTypes';
export declare class MarkToolbar {
    private readonly container;
    private readonly options;
    private readonly onSelect;
    private element;
    private readonly buttonTypes;
    constructor(container: HTMLElement, options: MarkServiceOptions, onSelect: (type: MarkDrawType) => void);
    mount(): void;
    destroy(): void;
}
