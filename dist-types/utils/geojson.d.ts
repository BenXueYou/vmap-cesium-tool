/**
 * GeoJSON 类型定义
 */
export interface GeoJSONPoint {
    type: 'Point';
    coordinates: [number, number];
}
export interface GeoJSONPolygon {
    type: 'Polygon';
    coordinates: number[][][];
}
export interface GeoJSONFeature<T = GeoJSONPolygon> {
    type: 'Feature';
    geometry: T;
    properties?: Record<string, any>;
}
export interface GeoJSONFeatureCollection<T = GeoJSONPolygon> {
    type: 'FeatureCollection';
    features: GeoJSONFeature<T>[];
    name?: string;
}
/**
 * 机场禁飞区数据接口
 */
export interface AirportNoFlyZone {
    name: string;
    feature: GeoJSONFeature<GeoJSONPolygon>;
    fileName: string;
}
/**
 * GeoJSON 加载配置
 */
export interface GeoJSONLoaderConfig {
    /**
     * GeoJSON 文件的基础路径
     * 开发环境: '/geojson' (指向 public/geojson)
     * 生产环境: 可以是 '/geojson' 或用户自定义路径
     * @default '/geojson'
     */
    basePath?: string;
    /**
     * 是否在加载失败时静默处理（不抛出错误）
     * @default false
     */
    silent?: boolean;
}
/**
 * 读取所有机场禁飞区 GeoJSON 文件
 *
 * 注意：由于无法直接获取目录文件列表，需要提供文件列表
 * 可以通过以下方式之一：
 * 1. 提供 fileList 参数
 * 2. 在 public/geojson 目录下放置 file-list.json 文件
 * 3. 使用 getAllAirportNoFlyZonesWithList 方法
 *
 * @param fileList 可选的文件名列表（不含扩展名）
 * @param config 加载配置
 * @returns Promise<AirportNoFlyZone[]> 机场禁飞区数据数组
 */
export declare function loadAllAirportNoFlyZones(fileList?: string[], config?: GeoJSONLoaderConfig): Promise<AirportNoFlyZone[]>;
/**
 * 读取单个机场禁飞区 GeoJSON 文件
 * @param fileName 文件名（不含扩展名，如 '珠海_金湾机场'）
 * @param config 加载配置
 * @returns Promise<AirportNoFlyZone | null> 机场禁飞区数据或 null
 */
export declare function loadAirportNoFlyZone(fileName: string, config?: GeoJSONLoaderConfig): Promise<AirportNoFlyZone | null>;
/**
 * 将 GeoJSON 坐标转换为 Cesium Cartesian3 数组
 * @param coordinates GeoJSON 多边形坐标数组
 * @param height 高度偏移（米），默认为 0
 * @returns 包含 longitude, latitude, height 的对象数组
 */
export declare function geojsonCoordinatesToCartesian3(coordinates: number[][], height?: number): Array<{
    longitude: number;
    latitude: number;
    height: number;
}>;
/**
 * 从文件名列表生成 file-list.json
 * 这个函数可以在构建时使用，生成文件列表
 *
 * @param fileNames 文件名列表（不含扩展名）
 * @returns JSON 字符串
 */
export declare function generateFileListJson(fileNames: string[]): string;
