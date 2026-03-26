import type { Cartesian3, Entity } from 'cesium';

import { clonePositions, sanitizePositions } from './geometry/drawPosition';
import type { DrawMode, DrawOptions } from './types/drawTypes';
import type { DrawSessionState, FinishedDrawRecord } from './types/drawState';

export class DrawSessionStore {
  private state: DrawSessionState = {
    isDrawing: false,
    drawMode: null,
    options: null,
    tempPositions: [],
    tempEntities: [],
    finishedEntities: [],
    finishedAuxEntities: [],
    hintEntity: null,
    currentPreviewPosition: null,
  };

  private finishedRecords: FinishedDrawRecord[] = [];

  start(mode: DrawMode, options: DrawOptions): void {
    this.state.isDrawing = true;
    this.state.drawMode = mode;
    this.state.options = options;
    this.state.tempPositions = [];
    this.state.tempEntities = [];
    this.state.hintEntity = null;
    this.state.currentPreviewPosition = null;
  }

  stop(): void {
    this.state.isDrawing = false;
    this.state.drawMode = null;
    this.state.options = null;
    this.state.tempPositions = [];
    this.state.tempEntities = [];
    this.state.hintEntity = null;
    this.state.currentPreviewPosition = null;
  }

  resetTemp(): void {
    this.state.tempPositions = [];
    this.state.tempEntities = [];
    this.state.hintEntity = null;
    this.state.currentPreviewPosition = null;
  }

  setPreviewPosition(position: Cartesian3 | null): void {
    this.state.currentPreviewPosition = position ? position.clone() : null;
  }

  pushTempPosition(position: Cartesian3): void {
    this.state.tempPositions.push(position.clone());
  }

  popTempPosition(): Cartesian3 | undefined {
    return this.state.tempPositions.pop();
  }

  replaceTempEntities(entities: Entity[]): void {
    this.state.tempEntities = [...entities];
  }

  setHintEntity(entity: Entity | null): void {
    this.state.hintEntity = entity;
  }

  registerFinished(primary: Entity, auxiliary: Entity[]): void {
    const record = { primary, auxiliary: [...auxiliary] };
    this.finishedRecords.push(record);
    this.state.finishedEntities.push(primary);
    this.state.finishedAuxEntities.push(...auxiliary);
  }

  unregisterFinished(primary: Entity): FinishedDrawRecord | null {
    const index = this.finishedRecords.findIndex((record) => record.primary === primary);
    if (index < 0) {
      return null;
    }

    const [record] = this.finishedRecords.splice(index, 1);
    this.state.finishedEntities = this.state.finishedEntities.filter((entity) => entity !== primary);
    this.state.finishedAuxEntities = this.state.finishedAuxEntities.filter(
      (entity) => !record.auxiliary.includes(entity),
    );
    return record;
  }

  clearFinished(): FinishedDrawRecord[] {
    const records = [...this.finishedRecords];
    this.finishedRecords = [];
    this.state.finishedEntities = [];
    this.state.finishedAuxEntities = [];
    return records;
  }

  getTempPositions(): Cartesian3[] {
    return clonePositions(this.state.tempPositions);
  }

  getSanitizedTempPositions(): Cartesian3[] {
    return sanitizePositions(this.state.tempPositions);
  }

  getTempEntities(): Entity[] {
    return [...this.state.tempEntities];
  }

  getFinishedEntities(): Entity[] {
    return [...this.state.finishedEntities];
  }

  getFinishedAuxEntities(): Entity[] {
    return [...this.state.finishedAuxEntities];
  }

  getHintEntity(): Entity | null {
    return this.state.hintEntity;
  }

  isDrawing(): boolean {
    return this.state.isDrawing;
  }

  getMode(): DrawMode {
    return this.state.drawMode;
  }

  getOptions(): DrawOptions | null {
    return this.state.options;
  }

  getPreviewPosition(): Cartesian3 | null {
    return this.state.currentPreviewPosition ? this.state.currentPreviewPosition.clone() : null;
  }
}