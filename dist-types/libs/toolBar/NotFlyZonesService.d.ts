import type { Viewer } from 'cesium';
/**
 * 禁飞区服务 - 存根实现
 * 为了保持向后兼容性
 */
export declare class NotFlyZonesService {
    private viewer;
    private visible;
    constructor(viewer: Viewer, config?: any);
    showNoFlyZones(): Promise<void>;
    hideNoFlyZones(): void;
    toggleVisibility(): void;
    getNoFlyZoneVisible(): boolean;
    toggleNoFlyZones(): Promise<void>;
    destroy(): void;
}
