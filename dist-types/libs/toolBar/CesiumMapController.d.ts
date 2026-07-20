import type { Viewer } from 'cesium';
interface MapControllerConfig {
    initialCenter?: {
        longitude: number;
        latitude: number;
        height: number;
    };
    getMapTypes?: () => unknown[];
    getCurrentMapTypeId?: () => string;
    getToken?: () => string;
    zoomCallback?: {
        onZoomIn?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
        onZoomOut?: (beforeHeight: number, afterHeight: number, currentLevel: number) => void;
    };
    onSceneModeChanged?: () => void;
    fullscreenCallback?: (isFullscreen: boolean) => void;
    resetLocationCallback?: () => void;
}
/**
 * 地图控制器 - 存根实现
 * 为了保持向后兼容性
 */
export declare class CesiumMapController {
    private viewer;
    private config?;
    private initialCenter;
    constructor(viewer: Viewer, config?: MapControllerConfig);
    /**
     * 缩放到指定位置
     */
    zoomTo(longitude: number, latitude: number, height: number): void;
    /**
     * 获取当前相机位置
     */
    getCurrentPosition(): {
        longitude: number;
        latitude: number;
        height: number;
    } | null;
    toggle2D3D(buttonElement?: HTMLElement): void;
    zoomIn(): void;
    zoomOut(): void;
    toggleFullscreen(): void;
    setInitialCenter(center: {
        longitude: number;
        latitude: number;
        height: number;
    }): void;
    getInitialCenter(): {
        longitude: number;
        latitude: number;
        height: number;
    } | undefined;
    resetLocation(): void;
    setupCameraZoomLimitListener(): void;
    private getZoomLevel;
}
export {};
