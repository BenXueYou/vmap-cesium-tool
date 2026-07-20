import * as Cesium from "cesium";
import { type DrawOptions } from './drawHelper';
/**
 * Cesium 绘图辅助工具类
 * 支持绘制点、线、多边形、矩形，并提供编辑和删除功能
 * 适用于 Cesium 1.132.0
 */
declare class DrawHelper {
    private viewer;
    private scene;
    private entities;
    private drawMode;
    private isDrawing;
    private tempPositions;
    private tempEntities;
    private tempLabelEntities;
    private finishedEntities;
    private finishedLabelEntities;
    private finishedPointEntities;
    private publicEntities;
    private _doubleClickPending;
    private lastPreviewPosition;
    private drawHintHelper;
    private lastLeftClickDebug;
    private static activeDrawingHelper;
    private drawLine;
    private drawPolygon;
    private drawRectangle;
    private drawCircle;
    private currentDrawer;
    private screenSpaceEventHandler;
    private entityClickHandler;
    private readonly pickGovernor;
    private terrainRefineQueue;
    private terrainRefineInFlight;
    private terrainRefineLastTick;
    private terrainRefineListener;
    private originalEntityCollectionAdd;
    private entityCollectionAddHookInstalled;
    private onDrawStartCallback;
    private onDrawEndCallback;
    private onEntityRemovedCallback;
    private onMeasureCompleteCallback;
    private offsetHeight;
    /** 当前绘制配置（用于调度器侧做快速校验/提示） */
    private currentDrawOptions?;
    private originalDepthTestAgainstTerrain;
    private isFiniteCartesian3;
    private findEntityById;
    private removeEntityById;
    /**
     * 在绘制/结束绘制的临界时刻短暂屏蔽 scene.pick 等交互，避免同一点击事件链中
     * 其它模块（如覆盖物服务）继续触发 pick，引发 ground/worker 相关异常。
     */
    private setPickCooldown;
    /**
     * 检查当前是否处于拾取(blocked)状态
     * @returns {boolean} 如果当前时间小于设定的阻塞时间，则返回true表示拾取被阻塞，否则返回false
     */
    private isPickBlocked;
    /**
     * 在实体被加入场景后、渲染循环更新前做一次快速校验。
     * 避免某些极端情况下（例如 height 为 Infinity 等）构造出 NaN Cartesian3，导致下一帧渲染直接停止。
     */
    private validateEntityPositionsOrRemove;
    /**
     * 防御性清理：移除包含 NaN/Infinity 坐标的实体。
     * 这类实体会在 Cesium 的 GeometryUpdater/TerrainOffsetProperty 更新阶段持续抛错，
     * 即使后续代码已修复输入，也会因旧实体仍存在而反复报错。
     */
    private removeEntitiesWithInvalidPositions;
    /**
     * 构造函数
     * @param viewer Cesium Viewer 实例
     */
    constructor(viewer: Cesium.Viewer);
    /**
     * 检测并输出可能存在高度限制问题的实体信息
     * @param tag 标识本次检测的唯一标签
     * @returns 返回包含检测结果的报告对象
     */
    private dumpPotentialClampingEntities;
    /**
     * 对新创建的实体进行净化处理，确保其符合渲染要求
     * @param entity - 需要净化的 Cesium.Entity 对象
     * @param tag - 用于标识来源的标签，会在控制台警告时显示
     */
    private sanitizeNewEntity;
    /**
     * 安装实体添加钩子函数，用于在实体被添加到EntityCollection时进行安全检查和处理
     * 这是一个私有方法，主要用于拦截和修改Cesium中EntityCollection的add方法
     */
    private installEntitiesAddHook;
    /**
     * 卸载实体集合添加钩子函数
     * 该方法用于移除之前添加到EntityCollection原型中的自定义add方法
     * 恢复原始的add方法实现
     */
    private uninstallEntitiesAddHook;
    /**
     * 安装地面几何更新器调试钩子
     * 此方法用于在Cesium GroundGeometryUpdater中安装一个调试钩子，用于捕获和处理渲染错误
     */
    private installGroundGeometryUpdaterDebugHook;
    /**
     * 外部调用：在场景模式（2D/3D）切换后，更新偏移高度并重算已完成实体
     */
    handleSceneModeChanged(): void;
    /**
     * 根据场景模式更新偏移高度
     */
    private updateOffsetHeight;
    /**
     * 开始绘制线条
     */
    startDrawingLine(options?: DrawOptions): void;
    /**
     * 开始绘制多边形（仅边线）
     */
    startDrawingPolygon(options?: DrawOptions): void;
    /**
     * 开始绘制矩形
     */
    startDrawingRectangle(options?: DrawOptions): void;
    /**
     * 开始绘制圆形
     */
    startDrawingCircle(options?: DrawOptions): void;
    /**
     * 内部统一的开始绘制方法
     * @param mode 绘制模式
     */
    private startDrawing;
    /**
     * 激活屏幕空间事件处理器
     */
    private activateDrawingHandlers;
    /**
     * 拾取地形或椭球体上的位置
     * @param windowPosition 屏幕坐标
     * @returns 世界坐标 Cartesian3 或 null
     */
    private pickGlobePosition;
    /**
     * 添加一个点到临时位置数组并创建点实体
     * @param position 世界坐标
     */
    private addPoint;
    /**
     * 删除最后一个添加的点及其相关的临时实体
     */
    private removeLastPoint;
    /**
     * 更新预览线/面
     * @param currentMousePosition 当前鼠标位置世界坐标
     */
    private updatePreview;
    /**
     * 核心方法：根据当前点序列更新或创建临时的线/面实体
     * @param previewPoint 可选的预览点，用于显示动态效果
     */
    private updateDrawingEntity;
    /**
     * 完成当前绘制操作
     */
    private finishDrawing;
    /**
     * 内部方法：重置绘图状态和清理临时数据
     * @param resetMode 是否重置绘图模式和状态标志
     */
    private endDrawingInternal;
    /**
     * 公共方法：结束当前绘制（如果正在进行）
     */
    endDrawing(): void;
    /**
     * 公共方法：取消当前正在进行的绘制（不触发完成回调，不生成实体）
     * 主要用于在外部开启新的绘制前，保证旧的未完成绘制被安全终止，
     * 避免同时存在多个绘制事件处理器。
     */
    cancelDrawing(): void;
    /**
     * 销毁事件处理器
     */
    private deactivateDrawingHandlers;
    /**
     * 清除所有已绘制的实体
     */
    clearAll(): void;
    /**
     * 清除所有实体（包括未跟踪的实体）
     * 这是一个更彻底的清理方法，会清除场景中的所有实体
     */
    clearAllEntities(): void;
    /**
     * 强制清除所有点实体
     * 用于解决点实体无法删除的问题
     */
    clearAllPoints(): void;
    /**
     * 删除一个指定的已完成实体
     * @param entity 要删除的实体
     */
    removeEntity(entity: Cesium.Entity): void;
    /**
     * 获取某个绘制实体关联的标签实体（例如面积标签）
     */
    getEntityLabelEntities(entity: Cesium.Entity): Cesium.Entity[];
    /**
     * 获取所有已完成的实体
     * @returns 实体数组
     */
    getFinishedEntities(): Cesium.Entity[];
    onMeasureComplete(callback: (result: {
        type: "line" | "polygon" | "rectangle" | "circle";
        positions: Cesium.Cartesian3[];
        distance?: number;
        areaKm2?: number;
    }) => void): void;
    /**
     * 设置开始绘制时的回调函数
     * @param callback 回调函数
     */
    onDrawStart(callback: () => void): void;
    /**
     * 设置结束绘制时的回调函数
     * @param callback 回调函数，参数为完成的实体或null
     */
    onDrawEnd(callback: (entity: Cesium.Entity | null) => void): void;
    /**
     * 设置实体被移除时的回调函数
     * @param callback 回调函数，参数为被移除的实体
     */
    onEntityRemoved(callback: (entity: Cesium.Entity) => void): void;
    /**
     * 更新所有已完成实体以适应场景模式变化
     * 当从2D切换到3D或从3D切换到2D时，需要更新实体的高度参考和位置
     */
    private updateFinishedEntitiesForModeChange;
    /**
     * 加入“两阶段地形适配”队列：先 NONE 安全显示，tilesLoaded 后再采样/切换。
     */
    private scheduleTerrainRefine;
    private processTerrainRefineQueue;
    private refineEntityToTerrain;
    /**
     * 销毁工具，清理所有事件监听器
     */
    destroy(): void;
}
export default DrawHelper;
