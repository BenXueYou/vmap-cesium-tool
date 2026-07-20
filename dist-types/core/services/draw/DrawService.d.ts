import type { Entity, Viewer } from 'cesium';
import type { DrawMode, DrawOptions, DrawResult, DrawServiceOptions } from './types/drawTypes';
export type { DrawArtifacts, DrawMode, DrawOptions, DrawResult, DrawServiceOptions, MeasurementFillStyle, MeasurementLabelOffset, MeasurementStrokeStyle, MeasurementSummaryLabelStyle, MeasurementTheme, MeasurementVertexStyle, } from './types/drawTypes';
export declare class DrawService {
    private readonly viewer;
    private readonly store;
    private readonly interactionController;
    private readonly labelFactory;
    private readonly hintController;
    private readonly entityFactory;
    private readonly entityRegistry;
    private readonly options;
    private readonly i18n;
    private readonly useI18n;
    private callbacks;
    /**
     * 构造函数，初始化绘图服务实例
     * @param viewer - Viewer视图实例，用于显示和交互
     * @param options - DrawServiceOptions类型的配置对象，包含可选的国际化等配置
     */
    constructor(viewer: Viewer, options?: DrawServiceOptions);
    private t;
    startDrawing(mode: DrawMode, options?: DrawOptions): void;
    startDrawingLine(options?: DrawOptions): void;
    startDrawingPolygon(options?: DrawOptions): void;
    startDrawingRectangle(options?: DrawOptions): void;
    startDrawingCircle(options?: DrawOptions): void;
    endDrawing(): void;
    cancelDrawing(): void;
    getFinishedEntities(): Entity[];
    clearAll(): void;
    removeEntity(entity: Entity): void;
    onDrawStart(callback: () => void): void;
    onDrawEnd(callback: (result: DrawResult | null) => void): void;
    onEntityRemoved(callback: (entity: Entity) => void): void;
    isDrawingMode(): boolean;
    getCurrentDrawMode(): DrawMode;
    destroy(): void;
    private finishDrawing;
    private renderPreview;
    private resetCurrentSession;
    private emitDrawEnd;
    private getOutputPositions;
    private resolveCircleMetrics;
}
