import type { Cartesian3, Entity } from 'cesium';
import type { DrawMode, DrawOptions } from './types/drawTypes';
import type { FinishedDrawRecord } from './types/drawState';
/**
 * DrawSessionStore 类用于管理和维护绘图会话的状态
 * 它跟踪绘图过程中的临时实体、已完成实体、提示实体等数据
 */
export declare class DrawSessionStore {
    /**
     * 私有属性，存储绘图会话的当前状态
     * 包含是否正在绘图、绘图模式、选项、临时位置、临时实体等数据
     */
    private state;
    /**
     * 私有属性，存储已完成的绘图记录数组
     * 每条记录包含一个主实体和多个辅助实体
     */
    private finishedRecords;
    /**
     * 开始一个新的绘图会话
     * @param mode 绘图模式
     * @param options 绘图选项
     */
    start(mode: DrawMode, options: DrawOptions): void;
    /**
     * 停止当前的绘图会话
     * 重置所有与绘图相关的状态
     */
    stop(): void;
    /**
     * 重置临时数据
     * 清空临时位置、临时实体、提示实体和预览位置
     */
    resetTemp(): void;
    /**
     * 设置预览位置
     * @param position 预览位置坐标，可为null
     */
    setPreviewPosition(position: Cartesian3 | null): void;
    /**
     * 添加临时位置
     * @param position 要添加的位置坐标
     */
    pushTempPosition(position: Cartesian3): void;
    /**
     * 弹出最后一个临时位置
     * @returns 被弹出的位置坐标，如果没有则返回undefined
     */
    popTempPosition(): Cartesian3 | undefined;
    /**
     * 替换临时实体
     * @param entities 要设置的临时实体数组
     */
    replaceTempEntities(entities: Entity[]): void;
    /**
     * 设置提示实体
     * @param entity 提示实体，可为null
     */
    setHintEntity(entity: Entity | null): void;
    /**
     * 注册一个已完成的绘图
     * @param primary 主实体
     * @param auxiliary 辅助实体数组
     */
    registerFinished(primary: Entity, auxiliary: Entity[]): void;
    /**
     * 注销一个已完成的绘图
     * @param primary 要注销的主实体
     * @returns 被注销的记录，如果找不到则返回null
     */
    unregisterFinished(primary: Entity): FinishedDrawRecord | null;
    /**
     * 清空所有已完成的绘图
     * @returns 被清空的记录数组
     */
    clearFinished(): FinishedDrawRecord[];
    /**
     * 获取临时位置的副本
     * @returns 临时位置数组的副本
     */
    getTempPositions(): Cartesian3[];
    /**
     * 获取经过处理的临时位置
     * @returns 经过处理的临时位置数组
     */
    getSanitizedTempPositions(): Cartesian3[];
    /**
     * 获取临时实体的副本
     * @returns 临时实体数组的副本
     */
    getTempEntities(): Entity[];
    /**
     * 获取已完成实体的副本
     * @returns 已完成实体数组的副本
     */
    getFinishedEntities(): Entity[];
    /**
     * 获取已完成辅助实体的副本
     * @returns 已完成辅助实体数组的副本
     */
    getFinishedAuxEntities(): Entity[];
    /**
     * 获取提示实体
     * @returns 提示实体，如果没有则返回null
     */
    getHintEntity(): Entity | null;
    /**
     * 检查是否正在绘图
     * @returns 如果正在绘图则返回true，否则返回false
     */
    isDrawing(): boolean;
    /**
     * 获取当前绘图模式
     * @returns 当前绘图模式
     */
    getMode(): DrawMode;
    /**
     * 获取当前绘图选项
     * @returns 当前绘图选项，如果没有则返回null
     */
    getOptions(): DrawOptions | null;
    /**
     * 获取预览位置的副本
     * @returns 预览位置的副本，如果没有则返回null
     */
    getPreviewPosition(): Cartesian3 | null;
}
