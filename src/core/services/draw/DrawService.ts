import * as Cesium from 'cesium';
import type { Cartesian3, Entity, Viewer } from 'cesium';

import { DrawEntityFactory } from './entities/drawEntityFactory';
import { DrawEntityRegistry } from './entities/drawEntityRegistry';
import {
  calculateDistance,
  calculatePolygonArea,
  calculateRectangleArea,
  calculateTotalDistance,
  getMinimumPointCount,
  getRectangleCornerPositions,
} from './geometry/drawGeometry';
import { isValidCartesian3 } from './geometry/drawPosition';
import { DrawInteractionController } from './DrawInteractionController';
import { buildHintText, DrawHintController } from './labels/drawHint';
import { MeasurementLabelFactory } from './labels/measurementLabelFactory';
import { DrawSessionStore } from './DrawSessionStore';
import { resolveLabelStyle, resolveMeasurementTheme } from './measurementThemeResolver';
import type { DrawCallbacks } from './types/drawState';
import type {
  DrawMode,
  DrawOptions,
  DrawResult,
  DrawServiceOptions,
  ResolvedMeasurementLabelStyle,
} from './types/drawTypes';
import { i18n as defaultI18n } from '../../../i18n';
import {
  isClosedPolygonSelfIntersecting,
  wouldCreatePolygonSelfIntersection,
} from '../../../utils/selfIntersection';
import { positionsToLngLats } from '../../mapProviders/coordinates/cesium';

export type {
  DrawArtifacts,
  DrawMode,
  DrawOptions,
  DrawResult,
  DrawServiceOptions,
  MeasurementFillStyle,
  MeasurementLabelOffset,
  MeasurementStrokeStyle,
  MeasurementSummaryLabelStyle,
  MeasurementTheme,
  MeasurementVertexStyle,
} from './types/drawTypes';

/**
 * DrawService 类提供绘图相关的功能，包括创建、管理和交互各种绘图实体
 */
export class DrawService {
  // 私有属性：存储绘图会话数据
  private readonly store = new DrawSessionStore();
  // 私有属性：交互控制器，处理绘图过程中的用户交互
  private readonly interactionController: DrawInteractionController;
  // 私有属性：标签工厂，用于创建测量标签
  private readonly labelFactory: MeasurementLabelFactory;
  // 私有属性：提示控制器，用于显示绘图提示信息
  private readonly hintController: DrawHintController;
  // 私有属性：实体工厂，用于创建各种绘图实体
  private readonly entityFactory: DrawEntityFactory;
  // 私有属性：实体注册表，管理所有绘图实体
  private readonly entityRegistry = new DrawEntityRegistry();
  // 私有属性：绘图服务的配置选项
  private readonly options: DrawServiceOptions;
  // 私有属性：国际化实例
  private readonly i18n;
  // 私有属性：是否使用国际化
  private readonly useI18n: boolean;

  // 回调函数集合
  private callbacks: DrawCallbacks = {};

  /**
   * 构造函数，初始化绘图服务实例
   * @param viewer - Viewer视图实例，用于显示和交互
   * @param options - DrawServiceOptions类型的配置对象，包含可选的国际化等配置
   */
  constructor(private readonly viewer: Viewer, options: DrawServiceOptions = {}) {
    // 初始化配置选项
    this.options = options;
    // 设置国际化配置，如果未提供则使用默认配置
    this.i18n = options.i18n ?? defaultI18n;
    // 设置是否使用国际化，默认为true
    this.useI18n = options.useI18n ?? true;
    // 创建交互控制器，用于处理绘图交互
    this.interactionController = new DrawInteractionController(viewer);
    // 创建标签工厂，用于生成测量标签
    this.labelFactory = new MeasurementLabelFactory(viewer, {
      i18n: this.i18n,
      useI18n: this.useI18n,
    });
    // 创建提示控制器，用于显示绘图提示
    this.hintController = new DrawHintController(viewer);
    // 创建实体工厂，用于生成绘图实体
    this.entityFactory = new DrawEntityFactory(viewer, this.labelFactory);
  }

  /**
   * 国际化翻译函数
   * @param key - 翻译键
   * @returns 翻译后的文本
   */
  private t(key: string): string {
    if (!this.useI18n) {
      return key;
    }

    return this.i18n.t(key);
  }

  /**
   * 开始绘图
   * @param mode - 绘图模式
   * @param options - 绘图选项
   */
  startDrawing(mode: DrawMode, options: DrawOptions = {}): void {
    if (this.store.isDrawing()) {
      this.endDrawing();
    }

    this.resetCurrentSession();
    this.store.start(mode, options);

    // 解析测量主题
    const theme = resolveMeasurementTheme(options);
    const hintStyle = resolveLabelStyle(theme, 'hintBubble');
    const invalidPolygonHintStyle = {
      ...hintStyle,
      textColor: Cesium.Color.RED,
    };
    const polygonNoIntersectionText = this.t('draw.hint.polygon_no_intersection');
    const syncHintAtPosition = (
      position: Cartesian3,
      text: string,
      style = hintStyle,
    ): void => {
      this.upsertHint(position, text, style);
    };
    const syncHint = (position: Cartesian3): void => {
      if (!this.store.isDrawing()) {
        return;
      }

      const text = buildHintText(mode, this.store.getTempPositions().length, {
        t: (key) => this.t(key),
      });
      if (!text) {
        this.store.setHintEntity(this.hintController.remove(this.store.getHintEntity()));
        return;
      }

      syncHintAtPosition(position, text, hintStyle);
    };
    const showPolygonNoIntersectionHint = (position?: Cartesian3 | null): void => {
      if (!this.store.isDrawing()) {
        return;
      }

      const hintPosition = position ?? this.store.getPreviewPosition() ?? this.store.getTempPositions().at(-1) ?? null;
      if (!hintPosition) {
        return;
      }

      syncHintAtPosition(hintPosition, polygonNoIntersectionText, invalidPolygonHintStyle);
    };
    const hasEffectiveCircleRadius = (): boolean => {
      const positions = this.store.getSanitizedTempPositions();
      if (positions.length < 2) {
        return false;
      }

      const center = Cesium.Cartographic.fromCartesian(positions[0]);
      const edge = Cesium.Cartographic.fromCartesian(positions[1]);
      if (!center || !edge) {
        return false;
      }

      const radius = calculateDistance(center, edge);
      return Number.isFinite(radius) && radius > 0;
    };
    const hasEffectiveRectangleEndpoint = (start: Cartesian3, end: Cartesian3): boolean => {
      const corners = getRectangleCornerPositions(start, end);
      const area = calculateRectangleArea(corners);
      return Number.isFinite(area) && area > 0;
    };
    const hasEffectiveRectangleArea = (): boolean => {
      const positions = this.store.getSanitizedTempPositions();
      return positions.length >= 2 && hasEffectiveRectangleEndpoint(positions[0], positions[1]);
    };

    this.interactionController.activate({
      onLeftClick: (position) => {
        if (!this.store.isDrawing()) {
          return;
        }

        const currentMode = this.store.getMode();
        if (currentMode === 'circle') {
          const positions = this.store.getSanitizedTempPositions();
          if (positions.length >= 2) {
            return;
          }

          if (positions.length === 1) {
            const center = Cesium.Cartographic.fromCartesian(positions[0]);
            const edge = Cesium.Cartographic.fromCartesian(position);
            const radius = center && edge ? calculateDistance(center, edge) : 0;
            if (!Number.isFinite(radius) || radius <= 0) {
              this.store.setPreviewPosition(position);
              syncHint(position);
              this.renderPreview(position);
              return;
            }
          }

          this.store.setPreviewPosition(position);
          this.store.pushTempPosition(position);
          syncHint(position);
          this.renderPreview(position);
          return;
        }

        if (currentMode === 'rectangle') {
          const positions = this.store.getSanitizedTempPositions();
          if (positions.length >= 2) {
            return;
          }

          if (positions.length === 1 && !hasEffectiveRectangleEndpoint(positions[0], position)) {
            this.store.setPreviewPosition(position);
            syncHint(position);
            this.renderPreview(position);
            return;
          }

          this.store.setPreviewPosition(position);
          this.store.pushTempPosition(position);
          syncHint(position);
          this.renderPreview(position);
          return;
        }

        const currentOptions = this.store.getOptions();
        if (currentMode === 'polygon' && currentOptions?.selfIntersectionEnabled) {
          const existing = this.store.getTempPositions();
          if (existing.length >= 2) {
            const allowTouch = !!currentOptions.selfIntersectionAllowTouch;
            const allowContinue = !!currentOptions.selfIntersectionAllowContinue;
            const willSelfIntersect = wouldCreatePolygonSelfIntersection(existing, position, {
              allowTouch,
            });
            if (willSelfIntersect && !allowContinue) {
              showPolygonNoIntersectionHint(position);
              return;
            }
          }
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
        const currentMode = this.store.getMode();
        if (currentMode === 'circle' || currentMode === 'rectangle') {
          if (this.store.getTempPositions().length === 1) {
            syncHint(position);
            this.renderPreview(position);
          }
          return;
        }

        const currentOptions = this.store.getOptions();
        if (currentMode === 'polygon' && currentOptions?.selfIntersectionEnabled) {
          const existing = this.store.getTempPositions();
          if (existing.length >= 2) {
            const allowTouch = !!currentOptions.selfIntersectionAllowTouch;
            const allowContinue = !!currentOptions.selfIntersectionAllowContinue;
            const willSelfIntersect = wouldCreatePolygonSelfIntersection(existing, position, {
              allowTouch,
            });
            if (willSelfIntersect && !allowContinue) {
              showPolygonNoIntersectionHint(position);
              this.renderPreview();
              return;
            }
          }
        }

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
        if (this.store.getMode() === 'circle' && !hasEffectiveCircleRadius()) {
          syncHint(position);
          this.renderPreview(position);
          return;
        }
        if (this.store.getMode() === 'rectangle' && !hasEffectiveRectangleArea()) {
          syncHint(position);
          this.renderPreview(position);
          return;
        }

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

    if (mode === 'polygon') {
      const currentOptions = this.store.getOptions();
      const selfIntersectionEnabled = !!currentOptions?.selfIntersectionEnabled;
      const allowTouch = !!currentOptions?.selfIntersectionAllowTouch;
      const allowContinue = !!currentOptions?.selfIntersectionAllowContinue;

      if (selfIntersectionEnabled && !allowContinue) {
        const isSelfIntersecting = isClosedPolygonSelfIntersecting(positions, { allowTouch });
        if (isSelfIntersecting) {
          this.showPolygonNoIntersectionHint(
            this.store.getPreviewPosition() ?? positions[positions.length - 1],
            currentOptions,
          );
          return;
        }
      }

      const area = calculatePolygonArea(positions);
      const hasValidArea = Number.isFinite(area) && area > 1e-6;
      if (!hasValidArea) {
        this.endDrawing();
        this.emitDrawEnd(null);
        return;
      }
    }

    if (mode === 'line') {
      const requestedMinimumLength = Number(this.store.getOptions()?.minPolylineLength ?? 0);
      const minPolylineLength = Number.isFinite(requestedMinimumLength)
        ? Math.max(0, requestedMinimumLength)
        : 0;
      const distance = calculateTotalDistance(positions);
      if (!Number.isFinite(distance) || distance <= minPolylineLength) {
        this.endDrawing();
        this.emitDrawEnd(null);
        return;
      }
    }

    const artifacts = this.entityFactory.createFinal(mode, positions, resolveMeasurementTheme(this.store.getOptions()));
    let result: DrawResult | null = null;
    if (artifacts) {
      this.entityRegistry.bindAuxiliary(artifacts.primary, artifacts.auxiliary);
      this.store.registerFinished(artifacts.primary, artifacts.auxiliary);
      const outputPositions = this.getOutputPositions(mode, positions);
      const geographicPositions = positionsToLngLats(outputPositions, this.store.getOptions()?.outputCoordSystem || 'WGS84');
      const outputCoordSystem = this.store.getOptions()?.outputCoordSystem || 'WGS84';
      result = {
        type: mode,
        entity: artifacts.primary,
        positions: outputPositions,
        geographicPositions,
        outputCoordSystem,
        ...(mode === 'line' ? { distance: calculateTotalDistance(outputPositions) } : {}),
        ...(mode === 'polygon' ? { area: calculatePolygonArea(outputPositions) } : {}),
        ...(mode === 'rectangle' ? { area: calculateRectangleArea(outputPositions) } : {}),
        ...(mode === 'circle' ? this.resolveCircleMetrics(positions) : {}),
      };
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

  private upsertHint(
    position: Cartesian3,
    text: string,
    style: ResolvedMeasurementLabelStyle,
  ): void {
    const currentHintEntity = this.store.getHintEntity();
    if (!currentHintEntity) {
      this.store.setHintEntity(this.hintController.show(position, text, style));
      return;
    }

    this.hintController.update(currentHintEntity, position, text, style);
  }

  private getPolygonNoIntersectionHintStyle(options?: DrawOptions | null): ResolvedMeasurementLabelStyle {
    return {
      ...resolveLabelStyle(resolveMeasurementTheme(options ?? undefined), 'hintBubble'),
      textColor: Cesium.Color.RED,
    };
  }

  private showPolygonNoIntersectionHint(position?: Cartesian3 | null, options?: DrawOptions | null): void {
    if (!this.store.isDrawing()) {
      return;
    }

    const hintPosition = position ?? this.store.getPreviewPosition() ?? this.store.getTempPositions().at(-1) ?? null;
    if (!hintPosition) {
      return;
    }

    this.upsertHint(
      hintPosition,
      this.t('draw.hint.polygon_no_intersection'),
      this.getPolygonNoIntersectionHintStyle(options),
    );
  }

  private getOutputPositions(mode: Exclude<DrawMode, null>, positions: Cartesian3[]): Cartesian3[] {
    if (mode === 'rectangle' && positions.length >= 2) {
      return getRectangleCornerPositions(positions[0], positions[1]);
    }

    return positions.map((position) => position.clone());
  }

  private resolveCircleMetrics(positions: Cartesian3[]): Pick<DrawResult, 'radius' | 'area'> {
    if (positions.length < 2) {
      return {};
    }

    const center = positions[0];
    const edge = positions[1];
    const centerCarto = Cesium.Cartographic.fromCartesian(center);
    const edgeCarto = Cesium.Cartographic.fromCartesian(edge);
    if (!centerCarto || !edgeCarto) {
      return {};
    }

    const radius = calculateDistance(centerCarto, edgeCarto);
    if (!Number.isFinite(radius) || radius <= 0) {
      return {};
    }

    return {
      radius,
      area: Math.PI * radius * radius,
    };
  }
}
