import type { Cartesian3, Entity, Viewer } from 'cesium';

import { DrawEntityFactory } from './entities/drawEntityFactory';
import { DrawEntityRegistry } from './entities/drawEntityRegistry';
import { getMinimumPointCount } from './geometry/drawGeometry';
import { isValidCartesian3 } from './geometry/drawPosition';
import { DrawInteractionController } from './DrawInteractionController';
import { buildHintText, DrawHintController } from './labels/drawHint';
import { MeasurementLabelFactory } from './labels/measurementLabelFactory';
import { DrawSessionStore } from './DrawSessionStore';
import { resolveLabelStyle, resolveMeasurementTheme } from './measurementThemeResolver';
import type { DrawCallbacks } from './types/drawState';
import type { DrawMode, DrawOptions, DrawResult } from './types/drawTypes';

export type {
  DrawArtifacts,
  DrawMode,
  DrawOptions,
  DrawResult,
  MeasurementFillStyle,
  MeasurementLabelOffset,
  MeasurementStrokeStyle,
  MeasurementSummaryLabelStyle,
  MeasurementTheme,
  MeasurementVertexStyle,
} from './types/drawTypes';

export class DrawService {
  private readonly store = new DrawSessionStore();
  private readonly interactionController: DrawInteractionController;
  private readonly labelFactory: MeasurementLabelFactory;
  private readonly hintController: DrawHintController;
  private readonly entityFactory: DrawEntityFactory;
  private readonly entityRegistry = new DrawEntityRegistry();

  private callbacks: DrawCallbacks = {};

  constructor(private readonly viewer: Viewer) {
    this.interactionController = new DrawInteractionController(viewer);
    this.labelFactory = new MeasurementLabelFactory(viewer);
    this.hintController = new DrawHintController(viewer);
    this.entityFactory = new DrawEntityFactory(viewer, this.labelFactory);
  }

  startDrawing(mode: DrawMode, options: DrawOptions = {}): void {
    if (this.store.isDrawing()) {
      this.endDrawing();
    }

    this.resetCurrentSession();
    this.store.start(mode, options);

    const theme = resolveMeasurementTheme(options);
    const hintStyle = resolveLabelStyle(theme, 'hintBubble');
    const syncHint = (position: Cartesian3): void => {
      if (!this.store.isDrawing()) {
        return;
      }

      const text = buildHintText(mode, this.store.getTempPositions().length);
      const currentHintEntity = this.store.getHintEntity();
      if (!text) {
        this.store.setHintEntity(this.hintController.remove(currentHintEntity));
        return;
      }

      if (!currentHintEntity) {
        this.store.setHintEntity(this.hintController.show(position, text, hintStyle));
        return;
      }

      this.hintController.update(currentHintEntity, position, text, hintStyle);
    };

    this.interactionController.activate({
      onLeftClick: (position) => {
        if (!this.store.isDrawing()) {
          return;
        }

        this.store.setPreviewPosition(position);
        this.store.pushTempPosition(position);
        syncHint(position);
        this.renderPreview();
      },
      onRightClick: () => {
        if (!this.store.isDrawing() || this.store.getTempPositions().length === 0) {
          return;
        }

        this.store.popTempPosition();
        const previewPosition = this.store.getPreviewPosition();
        this.renderPreview(previewPosition ?? undefined);
        if (previewPosition) {
          syncHint(previewPosition);
        }
      },
      onMouseMove: (position) => {
        if (!this.store.isDrawing()) {
          return;
        }

        this.store.setPreviewPosition(position);
        syncHint(position);
        if (this.store.getTempPositions().length > 0) {
          this.renderPreview(position);
        }
      },
      onDoubleClick: (position) => {
        if (!this.store.isDrawing()) {
          return;
        }

        this.store.setPreviewPosition(position);
        this.finishDrawing();
      },
    });

    this.callbacks.onDrawStart?.();
  }

  startDrawingLine(options: DrawOptions = {}): void {
    this.startDrawing('line', options);
  }

  startDrawingPolygon(options: DrawOptions = {}): void {
    this.startDrawing('polygon', options);
  }

  startDrawingRectangle(options: DrawOptions = {}): void {
    this.startDrawing('rectangle', options);
  }

  startDrawingCircle(options: DrawOptions = {}): void {
    this.startDrawing('circle', options);
  }

  endDrawing(): void {
    this.interactionController.deactivate();
    this.resetCurrentSession();
    this.store.stop();
  }

  cancelDrawing(): void {
    this.interactionController.deactivate();
    this.resetCurrentSession();
    this.store.stop();
  }

  getFinishedEntities(): Entity[] {
    return this.store.getFinishedEntities();
  }

  clearAll(): void {
    this.entityRegistry.clear(this.viewer, this.store.getFinishedEntities(), this.store.getFinishedAuxEntities());
    this.store.clearFinished();
  }

  removeEntity(entity: Entity): void {
    const record = this.store.unregisterFinished(entity);
    if (!record) {
      return;
    }

    this.entityRegistry.removeGroup(this.viewer, entity);
    this.callbacks.onEntityRemoved?.(entity);
  }

  onDrawStart(callback: () => void): void {
    this.callbacks.onDrawStart = callback;
  }

  onDrawEnd(callback: (result: DrawResult | null) => void): void {
    this.callbacks.onDrawEnd = callback;
  }

  onEntityRemoved(callback: (entity: Entity) => void): void {
    this.callbacks.onEntityRemoved = callback;
  }

  isDrawingMode(): boolean {
    return this.store.isDrawing();
  }

  getCurrentDrawMode(): DrawMode {
    return this.store.getMode();
  }

  destroy(): void {
    this.cancelDrawing();
    this.clearAll();
    this.interactionController.destroy();
  }

  private finishDrawing(): void {
    const mode = this.store.getMode();
    const positions = this.store.getSanitizedTempPositions();
    if (!mode || positions.length < getMinimumPointCount(mode)) {
      this.endDrawing();
      this.emitDrawEnd(null);
      return;
    }

    const artifacts = this.entityFactory.createFinal(mode, positions, resolveMeasurementTheme(this.store.getOptions()));
    let result: DrawResult | null = null;
    if (artifacts) {
      this.entityRegistry.bindAuxiliary(artifacts.primary, artifacts.auxiliary);
      this.store.registerFinished(artifacts.primary, artifacts.auxiliary);
      result = { entity: artifacts.primary, positions };
    }

    this.endDrawing();
    this.emitDrawEnd(result);
  }

  private renderPreview(previewPoint?: Cartesian3): void {
    this.store.getTempEntities().forEach((entity) => this.viewer.entities.remove(entity));
    this.store.replaceTempEntities([]);

    const basePositions = this.store.getSanitizedTempPositions();
    const mode = this.store.getMode();
    if (!mode || basePositions.length === 0) {
      return;
    }

    const validPreviewPoint = isValidCartesian3(previewPoint) ? previewPoint.clone() : undefined;
    const theme = resolveMeasurementTheme(this.store.getOptions());
    const entities = [
      ...this.labelFactory.createVertexMarkerEntities(basePositions, theme),
      ...this.entityFactory.createPreview(mode, basePositions, validPreviewPoint, theme),
    ];
    this.store.replaceTempEntities(entities);
  }

  private resetCurrentSession(): void {
    this.store.getTempEntities().forEach((entity) => this.viewer.entities.remove(entity));
    this.store.setHintEntity(this.hintController.remove(this.store.getHintEntity()));
    this.store.resetTemp();
  }

  private emitDrawEnd(result: DrawResult | null): void {
    this.callbacks.onDrawEnd?.(result);
  }
}