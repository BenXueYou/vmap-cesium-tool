import * as Cesium from 'cesium';
import type { Viewer, Entity, Color, MaterialProperty, HeightReference } from 'cesium';
import { BaseOverlay, type BaseOverlayOptions, type OverlayEntity, type OverlayPosition } from './BaseOverlay';
import { PolygonPrimitiveBatch } from './primitives/PolygonPrimitiveBatch';
import { PolygonPrimitiveLayerStack } from './primitives/PolygonPrimitiveLayerStack';
import { isMacPlatform } from '../../utils/PickGovernor';

export interface PolygonOptions extends BaseOverlayOptions {
  positions: OverlayPosition[];
  material?: MaterialProperty | Color | string;
  outline?: boolean;
  outlineColor?: Color | string;
  outlineWidth?: number;
  clampToGround?: boolean;
  groundHeightEpsilon?: number;
  heightReference?: HeightReference;
  extrudedHeight?: number;
  renderMode?: 'auto' | 'entity' | 'primitive';
}

class PolygonPrimitiveManager {
  private readonly defaultBatch: PolygonPrimitiveBatch;
  private readonly batchesByLayer = new Map<string, PolygonPrimitiveBatch>();
  private layerStack: PolygonPrimitiveLayerStack | null = null;

  constructor(private readonly viewer: Viewer) {
    this.defaultBatch = new PolygonPrimitiveBatch(viewer);
  }

  private getBatchByLayerKey(layerKey?: string): PolygonPrimitiveBatch {
    if (!layerKey) {
      return this.defaultBatch;
    }

    const key = String(layerKey);
    const existing = this.batchesByLayer.get(key);
    if (existing) {
      return existing;
    }

    if (!this.layerStack) {
      this.layerStack = new PolygonPrimitiveLayerStack(this.viewer);
    }

    const { fillCollection, borderCollection } = this.layerStack.getLayerCollections(key);
    const batch = new PolygonPrimitiveBatch(this.viewer, { fillCollection, borderCollection });
    this.batchesByLayer.set(key, batch);
    return batch;
  }

  private getBatchForOverlay(overlay: any): PolygonPrimitiveBatch {
    return this.getBatchByLayerKey(overlay?._primitiveLayerKey);
  }

  public upsertGeometry(args: {
    root: any;
    parts: { fill: Entity; border: Entity };
    fillPositions: Cesium.Cartesian3[];
    borderPositions: Cesium.Cartesian3[];
    borderWidth: number;
    fillColor: Cesium.Color;
    borderColor: Cesium.Color;
    visible: boolean;
  }): void {
    this.getBatchForOverlay(args.root).upsertGeometry({
      polygonId: String(args.root.id),
      parts: args.parts,
      fillPositions: args.fillPositions,
      borderPositions: args.borderPositions,
      borderWidth: args.borderWidth,
      fillColor: args.fillColor,
      borderColor: args.borderColor,
      visible: args.visible,
    });
  }

  public setVisible(root: any, visible: boolean): void {
    this.getBatchForOverlay(root).setVisible(String(root.id), visible);
  }

  public setColors(root: any, borderColor: Cesium.Color, fillColor: Cesium.Color): void {
    this.getBatchForOverlay(root).setColors(String(root.id), borderColor, fillColor);
  }

  public setBorderWidth(root: any, borderWidth: number): void {
    this.getBatchForOverlay(root).setBorderWidth(String(root.id), borderWidth);
  }

  public remove(root: any): void {
    this.getBatchForOverlay(root).remove(String(root.id));
  }
}

export class Polygon extends BaseOverlay {
  private static primitiveManagers = new WeakMap<Viewer, PolygonPrimitiveManager>();

  private polygonOptions: PolygonOptions;
  private borderEntity?: Entity;
  private primitiveMode = false;
  private primitiveManager: PolygonPrimitiveManager | null = null;

  constructor(viewer: Viewer, options: PolygonOptions) {
    super(viewer, options);
    this.polygonOptions = { ...options };

    const renderMode = options.renderMode ?? 'auto';
    if ((renderMode === 'primitive' || renderMode === 'auto') && this.canUsePrimitive(options)) {
      this.initPrimitivePolygon(options);
      return;
    }

    this.entity.polygon = this.createPolygonGraphics(options);

    if (options.outlineWidth && options.outlineWidth > 1) {
      this.borderEntity = this.createBorderPolyline(options);
      const root: any = this.entity as any;
      const borderOverlay: any = this.borderEntity as any;
      const group = [this.entity, this.borderEntity];
      root._borderEntity = this.borderEntity;
      root._isThickOutline = true;
      root._highlightEntities = group;
      borderOverlay._highlightEntities = group;
      if (options.onClick) {
        root._onClick = options.onClick;
        borderOverlay._onClick = options.onClick;
      }
      if (options.clickHighlight) {
        root._clickHighlight = options.clickHighlight;
        borderOverlay._clickHighlight = options.clickHighlight;
      }
      if (options.selectionHighlight !== undefined) {
        root._selectionHighlight = options.selectionHighlight;
        borderOverlay._selectionHighlight = options.selectionHighlight;
      }
      if (options.hoverHighlight) {
        root._hoverHighlight = options.hoverHighlight;
        borderOverlay._hoverHighlight = options.hoverHighlight;
      }
    }

    (this.entity as any)._overlayType = 'polygon';
  }

  private static getPrimitiveManager(viewer: Viewer): PolygonPrimitiveManager {
    const existing = Polygon.primitiveManagers.get(viewer);
    if (existing) {
      return existing;
    }

    const manager = new PolygonPrimitiveManager(viewer);
    Polygon.primitiveManagers.set(viewer, manager);
    return manager;
  }

  private canUsePrimitive(options: PolygonOptions): boolean {
    if (isMacPlatform()) return false;
    const ringThickness = options.outlineWidth && options.outlineWidth > 1 ? options.outlineWidth : 0;
    if (!(ringThickness > 0)) return false;
    if ((options.clampToGround ?? true) !== true) return false;
    if (options.extrudedHeight !== undefined) return false;
    if (this.resolveMaterialColor(options.material) === null) return false;
    if (options.outlineColor !== undefined && this.resolveColorOrNull(options.outlineColor) === null) return false;
    return true;
  }

  private initPrimitivePolygon(options: PolygonOptions): void {
    this.primitiveMode = true;
    this.primitiveManager = Polygon.getPrimitiveManager(this.viewer);

    const positions = options.positions.map((pos) => this.toCartesian3(pos)!);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const fillPositions = this.elevatePositions(positions, groundHeightEpsilon);
    const borderPositions = fillPositions.slice();
    if (borderPositions.length >= 2) {
      borderPositions.push(fillPositions[0]);
    }

    const fillColor = this.resolveMaterialColor(options.material) ?? Cesium.Color.BLUE.withAlpha(0.5);
    const borderColor = this.resolveColor(options.outlineColor ?? Cesium.Color.ORANGE, Cesium.Color.ORANGE);
    const borderWidth = Math.max(1, Number(options.outlineWidth ?? 2) || 1);

    const root = this.entity as OverlayEntity & Record<string, any>;
    const border = new Cesium.Entity({ id: `${this.getId()}__border` });
    const borderOverlay = border as OverlayEntity & Record<string, any>;
    this.borderEntity = border;

    root._overlayType = 'polygon-primitive';
    root._primitiveLayerKey = options.layerKey;
    root._borderEntity = border;
    root._isThickOutline = true;
    root._outlineWidth = borderWidth;
    root._clampToGround = true;
    root._baseHeight = 0;
    root._groundHeightEpsilon = groundHeightEpsilon;
    root._primitiveFillBaseColor = fillColor;
    root._primitiveBorderBaseColor = borderColor;
    root._primitiveOutlinePositions = borderPositions;

    borderOverlay._overlayType = 'polygon-primitive';
    borderOverlay._primitiveLayerKey = options.layerKey;
    borderOverlay._primitiveFillBaseColor = fillColor;
    borderOverlay._primitiveBorderBaseColor = borderColor;
    borderOverlay._primitiveOutlinePositions = borderPositions;
    borderOverlay._groundHeightEpsilon = groundHeightEpsilon;

    if (options.onClick) {
      root._onClick = options.onClick;
      borderOverlay._onClick = options.onClick;
    }
    if (options.clickHighlight) {
      root._clickHighlight = options.clickHighlight;
      borderOverlay._clickHighlight = options.clickHighlight;
    }
    if (options.selectionHighlight !== undefined) {
      root._selectionHighlight = options.selectionHighlight;
      borderOverlay._selectionHighlight = options.selectionHighlight;
    }
    if (options.hoverHighlight) {
      root._hoverHighlight = options.hoverHighlight;
      borderOverlay._hoverHighlight = options.hoverHighlight;
    }

    const group = [this.entity, border];
    root._highlightEntities = group;
    borderOverlay._highlightEntities = group;

    this.primitiveManager.upsertGeometry({
      root,
      parts: { fill: this.entity, border },
      fillPositions,
      borderPositions,
      borderWidth,
      fillColor,
      borderColor,
      visible: this.entity.show !== false,
    });
  }

  private createPolygonGraphics(options: PolygonOptions): Cesium.PolygonGraphics {
    const positions = options.positions.map((pos) => this.toCartesian3(pos)!);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const surfacePositions = this.elevatePositions(positions, 0);
    const heightReference = options.heightReference ?? (
      clampToGround
        ? (groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND)
        : Cesium.HeightReference.NONE
    );

    return new Cesium.PolygonGraphics({
      hierarchy: surfacePositions,
      material: this.resolveMaterial(options.material),
      outline: options.outline ?? true,
      outlineColor: options.outlineColor ? this.resolveColor(options.outlineColor, Cesium.Color.BLACK) : undefined,
      outlineWidth: options.outlineWidth ?? 1,
      heightReference,
      ...(clampToGround && groundHeightEpsilon > 0 ? { height: groundHeightEpsilon } : {}),
      extrudedHeight: options.extrudedHeight,
    });
  }

  private createBorderPolyline(options: PolygonOptions): Entity {
    const positions = options.positions.map((pos) => this.toCartesian3(pos)!);
    const clampToGround = options.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(options.groundHeightEpsilon ?? 0)) : 0;
    const baseHeight = clampToGround ? groundHeightEpsilon : (Cesium.Cartographic.fromCartesian(positions[0])?.height ?? 0);
    const borderPositions = this.elevatePositions(positions, baseHeight);
    const closedPositions = borderPositions.slice();
    if (closedPositions.length >= 2) {
      closedPositions.push(borderPositions[0]);
    }

    return this.viewer.entities.add({
      polyline: {
        positions: closedPositions,
        width: options.outlineWidth ?? 2,
        material: new Cesium.ColorMaterialProperty(
          this.resolveColor(options.outlineColor ?? Cesium.Color.ORANGE, Cesium.Color.ORANGE),
        ),
        clampToGround,
        ...(clampToGround ? { zIndex: 1 } : {}),
      },
    });
  }

  private resolveColorOrNull(color: Color | string): Color | null {
    if (color instanceof Cesium.Color) {
      return color;
    }
    try {
      return Cesium.Color.fromCssColorString(color);
    } catch {
      return null;
    }
  }

  private resolveColor(color: Color | string | undefined, fallback: Color): Color {
    if (!color) return fallback;
    return this.resolveColorOrNull(color) ?? fallback;
  }

  private resolveMaterial(material?: MaterialProperty | Color | string): MaterialProperty {
    if (!material) {
      return new Cesium.ColorMaterialProperty(Cesium.Color.BLUE.withAlpha(0.5));
    }
    if (typeof material === 'string') {
      return new Cesium.ColorMaterialProperty(this.resolveColor(material, Cesium.Color.BLUE.withAlpha(0.5)));
    }
    if (material instanceof Cesium.Color) {
      return new Cesium.ColorMaterialProperty(material);
    }
    return material;
  }

  private resolveMaterialColor(material?: MaterialProperty | Color | string): Cesium.Color | null {
    if (!material) return Cesium.Color.BLUE.withAlpha(0.5);
    if (typeof material === 'string') return this.resolveColor(material, Cesium.Color.BLUE.withAlpha(0.5));
    if (material instanceof Cesium.Color) return material;
    if (material instanceof Cesium.ColorMaterialProperty) {
      try {
        const c: any = (material as any).color;
        const v = c && typeof c.getValue === 'function' ? c.getValue(Cesium.JulianDate.now()) : c;
        if (v instanceof Cesium.Color) return v;
        if (typeof v === 'string') return this.resolveColor(v, Cesium.Color.BLUE.withAlpha(0.5));
      } catch {
        // ignore
      }
    }
    return null;
  }

  private elevatePositions(positions: Cesium.Cartesian3[], heightMeters: number): Cesium.Cartesian3[] {
    return positions.map((position) => {
      const cartographic = Cesium.Cartographic.fromCartesian(position);
      return Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, heightMeters);
    });
  }

  private getPrimitiveRoot(): OverlayEntity & Record<string, any> {
    const entity = this.entity as OverlayEntity & Record<string, any>;
    if (entity._overlayType === 'polygon-primitive') {
      return entity;
    }
    const highlightEntities = entity._highlightEntities;
    if (Array.isArray(highlightEntities) && highlightEntities.length > 0) {
      return highlightEntities[0] as OverlayEntity & Record<string, any>;
    }
    return entity;
  }

  private refreshPrimitiveGeometry(positions: Cesium.Cartesian3[]): void {
    if (!this.primitiveMode || !this.primitiveManager) return;
    const root = this.getPrimitiveRoot();
    const groundHeightEpsilon = root._groundHeightEpsilon ?? 0;
    const fillPositions = this.elevatePositions(positions, groundHeightEpsilon);
    const borderPositions = fillPositions.slice();
    if (borderPositions.length >= 2) {
      borderPositions.push(fillPositions[0]);
    }

    root._primitiveOutlinePositions = borderPositions;
    if (this.borderEntity) {
      (this.borderEntity as any)._primitiveOutlinePositions = borderPositions;
    }

    this.primitiveManager.upsertGeometry({
      root,
      parts: { fill: this.entity, border: this.borderEntity! },
      fillPositions,
      borderPositions,
      borderWidth: Math.max(1, Number(root._outlineWidth ?? this.polygonOptions.outlineWidth ?? 2) || 1),
      fillColor: root._primitiveFillBaseColor ?? Cesium.Color.BLUE.withAlpha(0.5),
      borderColor: root._primitiveBorderBaseColor ?? Cesium.Color.ORANGE,
      visible: this.entity.show !== false,
    });
  }

  update(options: Partial<PolygonOptions>): void {
    if (this.destroyed) return;
    this.polygonOptions = { ...this.polygonOptions, ...options };

    if (this.primitiveMode) {
      const root = this.getPrimitiveRoot();
      if (options.positions) {
        this.refreshPrimitiveGeometry(options.positions.map((pos) => this.toCartesian3(pos)!));
      }
      if (options.material !== undefined) {
        const fillColor = this.resolveMaterialColor(options.material);
        if (fillColor) {
          root._primitiveFillBaseColor = fillColor;
          if (this.borderEntity) {
            (this.borderEntity as any)._primitiveFillBaseColor = fillColor;
          }
        }
      }
      if (options.outlineColor !== undefined) {
        const borderColor = this.resolveColor(options.outlineColor, Cesium.Color.ORANGE);
        root._primitiveBorderBaseColor = borderColor;
        if (this.borderEntity) {
          (this.borderEntity as any)._primitiveBorderBaseColor = borderColor;
        }
      }
      if (options.outlineWidth !== undefined) {
        const borderWidth = Math.max(1, Number(options.outlineWidth) || 1);
        root._outlineWidth = borderWidth;
        this.primitiveManager?.setBorderWidth(root, borderWidth);
      }
      if (options.show !== undefined) {
        this.setVisible(options.show);
      }

      const fillColor = root._primitiveFillBaseColor ?? Cesium.Color.BLUE.withAlpha(0.5);
      const borderColor = root._primitiveBorderBaseColor ?? Cesium.Color.ORANGE;
      this.primitiveManager?.setColors(root, borderColor, fillColor);
      return;
    }

    if (!this.entity.polygon) {
      this.entity.polygon = this.createPolygonGraphics(this.polygonOptions);
      return;
    }

    if (options.positions !== undefined) {
      const positions = options.positions.map((pos) => this.toCartesian3(pos)!);
      const clampToGround = this.polygonOptions.clampToGround ?? true;
      const groundHeightEpsilon = clampToGround ? Math.max(0, Number(this.polygonOptions.groundHeightEpsilon ?? 0)) : 0;
      const surfacePositions = this.elevatePositions(positions, 0);
      this.entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(surfacePositions));

      if (clampToGround) {
        (this.entity.polygon as any).heightReference = new Cesium.ConstantProperty(
          groundHeightEpsilon > 0 ? Cesium.HeightReference.RELATIVE_TO_GROUND : Cesium.HeightReference.CLAMP_TO_GROUND,
        );
        (this.entity.polygon as any).height = groundHeightEpsilon > 0
          ? new Cesium.ConstantProperty(groundHeightEpsilon)
          : undefined;
      } else {
        (this.entity.polygon as any).heightReference = new Cesium.ConstantProperty(Cesium.HeightReference.NONE);
      }

      if (this.borderEntity?.polyline) {
        const baseHeight = clampToGround ? groundHeightEpsilon : (Cesium.Cartographic.fromCartesian(positions[0])?.height ?? 0);
        const borderPositions = this.elevatePositions(positions, baseHeight);
        const closedPositions = borderPositions.slice();
        if (closedPositions.length >= 2) closedPositions.push(borderPositions[0]);
        this.borderEntity.polyline.positions = new Cesium.ConstantProperty(closedPositions);
        (this.borderEntity.polyline as any).clampToGround = new Cesium.ConstantProperty(clampToGround);
      }
    }

    if (options.material !== undefined) {
      this.entity.polygon.material = this.resolveMaterial(options.material);
    }
    if (options.outline !== undefined) {
      this.entity.polygon.outline = new Cesium.ConstantProperty(options.outline);
    }
    if (options.outlineColor !== undefined) {
      this.entity.polygon.outlineColor = new Cesium.ConstantProperty(
        this.resolveColor(options.outlineColor, Cesium.Color.BLACK),
      );
      if (this.borderEntity?.polyline) {
        this.borderEntity.polyline.material = new Cesium.ColorMaterialProperty(
          this.resolveColor(options.outlineColor, Cesium.Color.ORANGE),
        );
      }
    }
    if (options.outlineWidth !== undefined) {
      this.entity.polygon.outlineWidth = new Cesium.ConstantProperty(options.outlineWidth);
      if (this.borderEntity?.polyline) {
        this.borderEntity.polyline.width = new Cesium.ConstantProperty(options.outlineWidth);
      }
    }
    if (options.extrudedHeight !== undefined) {
      this.entity.polygon.extrudedHeight = new Cesium.ConstantProperty(options.extrudedHeight);
    }
    if (options.show !== undefined) {
      this.entity.show = options.show;
      if (this.borderEntity) {
        this.borderEntity.show = options.show;
      }
    }
  }

  setPositions(positions: OverlayPosition[]): void {
    if (this.destroyed) return;
    this.polygonOptions.positions = positions.slice();
    const cartesianPositions = positions.map((pos) => this.toCartesian3(pos)!);

    if (this.primitiveMode) {
      this.refreshPrimitiveGeometry(cartesianPositions);
      return;
    }

    const clampToGround = this.polygonOptions.clampToGround ?? true;
    const groundHeightEpsilon = clampToGround ? Math.max(0, Number(this.polygonOptions.groundHeightEpsilon ?? 0)) : 0;
    const surfacePositions = this.elevatePositions(cartesianPositions, 0);
    if (this.entity.polygon) {
      this.entity.polygon.hierarchy = new Cesium.ConstantProperty(new Cesium.PolygonHierarchy(surfacePositions));
    }

    if (this.borderEntity?.polyline) {
      const baseHeight = clampToGround ? groundHeightEpsilon : (Cesium.Cartographic.fromCartesian(cartesianPositions[0])?.height ?? 0);
      const borderPositions = this.elevatePositions(cartesianPositions, baseHeight);
      const closedPositions = borderPositions.slice();
      if (closedPositions.length >= 2) closedPositions.push(borderPositions[0]);
      this.borderEntity.polyline.positions = new Cesium.ConstantProperty(closedPositions);
    }
  }

  getPositions(): [number, number][] {
    if (this.primitiveMode) {
      return this.polygonOptions.positions
        .map((position) => this.toCartesian3(position))
        .filter((position): position is Cesium.Cartesian3 => !!position)
        .map((position) => this.toLngLat(position));
    }

    const hierarchy = this.entity.polygon?.hierarchy?.getValue(Cesium.JulianDate.now());
    const positions = Array.isArray(hierarchy) ? hierarchy : hierarchy?.positions;
    if (Array.isArray(positions)) {
      return positions.map((position) => this.toLngLat(position));
    }
    return [];
  }

  getStyle(): Partial<PolygonOptions> {
    if (this.primitiveMode) {
      return {
        material: this.polygonOptions.material,
        outline: this.polygonOptions.outline,
        outlineColor: this.polygonOptions.outlineColor,
        outlineWidth: this.polygonOptions.outlineWidth,
        extrudedHeight: this.polygonOptions.extrudedHeight,
        renderMode: this.polygonOptions.renderMode,
        layerKey: this.polygonOptions.layerKey,
      };
    }

    const polygon = this.entity.polygon;
    if (!polygon) return {};
    const now = Cesium.JulianDate.now();
    return {
      material: polygon.material?.getValue(now),
      outline: polygon.outline?.getValue(now),
      outlineColor: polygon.outlineColor?.getValue(now),
      outlineWidth: polygon.outlineWidth?.getValue(now),
      extrudedHeight: polygon.extrudedHeight?.getValue(now),
    };
  }

  applyPrimitiveHighlight(entity: Entity, highlightColor: Cesium.Color, _fillAlpha: number): void {
    if (!this.primitiveMode || !this.primitiveManager) return;
    const root = this.getPrimitiveRoot();
    const rootEntity = entity === this.borderEntity ? root : this.getPrimitiveRoot();
    if (!rootEntity._primitiveBorderBaseColor) {
      rootEntity._primitiveBorderBaseColor = Cesium.Color.ORANGE;
    }
    if (!rootEntity._primitiveFillBaseColor) {
      rootEntity._primitiveFillBaseColor = Cesium.Color.BLUE.withAlpha(0.5);
    }
    this.primitiveManager.setColors(
      rootEntity,
      highlightColor.withAlpha(1),
      rootEntity._primitiveFillBaseColor,
    );
    (entity as any)._isHighlighted = true;
  }

  restorePrimitiveHighlight(entity: Entity): void {
    if (!this.primitiveMode || !this.primitiveManager) return;
    const root = this.getPrimitiveRoot();
    this.primitiveManager.setColors(
      root,
      root._primitiveBorderBaseColor ?? Cesium.Color.ORANGE,
      root._primitiveFillBaseColor ?? Cesium.Color.BLUE.withAlpha(0.5),
    );
    (entity as any)._isHighlighted = false;
  }

  setVisible(show: boolean): void {
    if (this.destroyed) return;
    if (this.primitiveMode) {
      this.entity.show = show;
      if (this.borderEntity) {
        this.borderEntity.show = show;
      }
      this.primitiveManager?.setVisible(this.getPrimitiveRoot(), show);
      return;
    }

    super.setVisible(show);
    if (this.borderEntity) {
      this.borderEntity.show = show;
    }
  }

  remove(): void {
    if (this.destroyed) return;

    if (this.primitiveMode) {
      try {
        this.primitiveManager?.remove(this.getPrimitiveRoot());
      } catch {
        // ignore
      }
      this.borderEntity = undefined;
      this.destroyed = true;
      return;
    }

    if (this.isViewerAvailable() && this.borderEntity) {
      this.viewer.entities.remove(this.borderEntity);
    }
    this.borderEntity = undefined;
    super.remove();
  }
}
