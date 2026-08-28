import type { Cartesian3, Entity } from 'cesium';

import { clonePositions, sanitizePositions } from './geometry/drawPosition';
import type { DrawMode, DrawOptions } from './types/drawTypes';
import type { DrawSessionState, FinishedDrawRecord } from './types/drawState';

/**
 * DrawSessionStore 类用于管理和维护绘图会话的状态
 * 它跟踪绘图过程中的临时实体、已完成实体、提示实体等数据
 */
export class DrawSessionStore {
  /**
   * 私有属性，存储绘图会话的当前状态
   * 包含是否正在绘图、绘图模式、选项、临时位置、临时实体等数据
   */
  private state: DrawSessionState = {
    isDrawing: false,       // 是否正在绘图
    drawMode: null,         // 绘图模式
    options: null,          // 绘图选项
    tempPositions: [],      // 临时位置数组
    tempEntities: [],       // 临时实体数组
    finishedEntities: [],    // 已完成的实体数组
    finishedAuxEntities: [], // 已完成的辅助实体数组
    hintEntity: null,       // 提示实体
    currentPreviewPosition: null, // 当前预览位置
  };

  /** 
   * 私有属性，存储已完成的绘图记录数组
   * 每条记录包含一个主实体和多个辅助实体
   */
  private finishedRecords: FinishedDrawRecord[] = [];

  /**
   * 开始一个新的绘图会话
   * @param mode 绘图模式
   * @param options 绘图选项
   */
  start(mode: DrawMode, options: DrawOptions): void {
    this.state.isDrawing = true;
    this.state.drawMode = mode;
    this.state.options = options;
    this.state.tempPositions = [];
    this.state.tempEntities = [];
    this.state.hintEntity = null;
    this.state.currentPreviewPosition = null;
  }

  /**
   * 停止当前的绘图会话
   * 重置所有与绘图相关的状态
   */
  stop(): void {
    this.state.isDrawing = false;
    this.state.drawMode = null;
    this.state.options = null;
    this.state.tempPositions = [];
    this.state.tempEntities = [];
    this.state.hintEntity = null;
    this.state.currentPreviewPosition = null;
  }

  /**
   * 重置临时数据
   * 清空临时位置、临时实体、提示实体和预览位置
   */
  resetTemp(): void {
    this.state.tempPositions = [];
    this.state.tempEntities = [];
    this.state.hintEntity = null;
    this.state.currentPreviewPosition = null;
  }

  /**
   * 设置预览位置
   * @param position 预览位置坐标，可为null
   */
  setPreviewPosition(position: Cartesian3 | null): void {
    this.state.currentPreviewPosition = position ? position.clone() : null;
  }

  /**
   * 添加临时位置
   * @param position 要添加的位置坐标
   */
  pushTempPosition(position: Cartesian3): void {
    this.state.tempPositions.push(position.clone());
  }

  /**
   * 弹出最后一个临时位置
   * @returns 被弹出的位置坐标，如果没有则返回undefined
   */
  popTempPosition(): Cartesian3 | undefined {
    return this.state.tempPositions.pop();
  }

  /**
   * 替换临时实体
   * @param entities 要设置的临时实体数组
   */
  replaceTempEntities(entities: Entity[]): void {
    this.state.tempEntities = [...entities];
  }

  /**
   * 设置提示实体
   * @param entity 提示实体，可为null
   */
  setHintEntity(entity: Entity | null): void {
    this.state.hintEntity = entity;
  }

  /**
   * 注册一个已完成的绘图
   * @param primary 主实体
   * @param auxiliary 辅助实体数组
   */
  registerFinished(primary: Entity, auxiliary: Entity[]): void {
    const record = { primary, auxiliary: [...auxiliary] };
    this.finishedRecords.push(record);
    this.state.finishedEntities.push(primary);
    this.state.finishedAuxEntities.push(...auxiliary);
  }

  /**
   * 注销一个已完成的绘图
    // 解析标签样式
   * @param primary 要注销的主实体
    // 无效多边形提示样式
   * @returns 被注销的记录，如果找不到则返回null
   */
  unregisterFinished(primary: Entity): FinishedDrawRecord | null {
    const index = this.finishedRecords.findIndex((record) => record.primary === primary);
    // 多边形无交叉提示文本
    if (index < 0) {
    // 同步位置提示
      return null;
    }

    const [record] = this.finishedRecords.splice(index, 1);
    this.state.finishedEntities = this.state.finishedEntities.filter((entity) => entity !== primary);
    this.state.finishedAuxEntities = this.state.finishedAuxEntities.filter(
      (entity) => !record.auxiliary.includes(entity),
    // 同步提示
    );
    return record;
  }

  /**
   * 清空所有已完成的绘图
   * @returns 被清空的记录数组
   */
  clearFinished(): FinishedDrawRecord[] {
    const records = [...this.finishedRecords];
    this.finishedRecords = [];
    this.state.finishedEntities = [];
    this.state.finishedAuxEntities = [];
    return records;
  }
    // 显示多边形无交叉提示

  /**
   * 获取临时位置的副本
   * @returns 临时位置数组的副本
   */
  getTempPositions(): Cartesian3[] {
    return clonePositions(this.state.tempPositions);
  }

  /**
   * 获取经过处理的临时位置
   * @returns 经过处理的临时位置数组
    // 检查是否具有有效的圆半径
   */
  getSanitizedTempPositions(): Cartesian3[] {
    return sanitizePositions(this.state.tempPositions);
  }

  /**
   * 获取临时实体的副本
   * @returns 临时实体数组的副本
   */
  getTempEntities(): Entity[] {
    return [...this.state.tempEntities];
  }

  /**
   * 获取已完成实体的副本
    // 检查是否具有有效的矩形端点
   * @returns 已完成实体数组的副本
   */
  getFinishedEntities(): Entity[] {
    return [...this.state.finishedEntities];
  }
    // 检查是否具有有效的矩形面积

  /**
   * 获取已完成辅助实体的副本
   * @returns 已完成辅助实体数组的副本
   */
    // 激活交互控制器
  getFinishedAuxEntities(): Entity[] {
    return [...this.state.finishedAuxEntities];
  }

  /**
   * 获取提示实体
   * @returns 提示实体，如果没有则返回null
   */
  getHintEntity(): Entity | null {
    return this.state.hintEntity;
  }

  /**
   * 检查是否正在绘图
   * @returns 如果正在绘图则返回true，否则返回false
   */
  isDrawing(): boolean {
    return this.state.isDrawing;
  }

  /**
   * 获取当前绘图模式
   * @returns 当前绘图模式
   */
  getMode(): DrawMode {
    return this.state.drawMode;
  }

  /**
   * 获取当前绘图选项
   * @returns 当前绘图选项，如果没有则返回null
   */
  getOptions(): DrawOptions | null {
    return this.state.options;
  }

  /**
   * 获取预览位置的副本
   * @returns 预览位置的副本，如果没有则返回null
   */
  getPreviewPosition(): Cartesian3 | null {
    return this.state.currentPreviewPosition ? this.state.currentPreviewPosition.clone() : null;
  }
}