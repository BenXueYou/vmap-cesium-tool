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
 * 默认配置
 */
const DEFAULT_CONFIG: Required<GeoJSONLoaderConfig> = {
  basePath: '/geojson',
  silent: false
};

/**
 * 获取 GeoJSON 文件列表
 * 注意：这个方法需要服务器端支持目录列表功能，或者使用预定义的列表
 * 如果服务器不支持，需要手动维护文件列表
 * 
 * @param config 加载配置
 * @returns Promise<string[]> 文件名列表
 */
async function getGeoJSONFileList(config: GeoJSONLoaderConfig = {}): Promise<string[]> {
  const { basePath } = { ...DEFAULT_CONFIG, ...config };
  
  try {
    // 尝试加载文件列表（如果服务器支持）
    // 注意：大多数静态服务器不支持目录列表，所以这里返回空数组
    // 实际使用时，应该维护一个文件列表或使用其他方式获取
    const response = await fetch(`${basePath}/file-list.json`);
    if (response.ok) {
      const fileList = await response.json();
      return Array.isArray(fileList) ? fileList : [];
    }
  } catch (error) {
    // 忽略错误，使用备用方案
    console.error('获取 GeoJSON 文件列表失败:', error);
  }
  
  // 备用方案：返回空数组，由调用方提供文件列表
  return [];
}

/**
 * 加载单个 GeoJSON 文件
 * @param fileName 文件名（不含扩展名，如 '珠海_金湾机场'）
 * @param config 加载配置
 * @returns Promise<GeoJSONFeatureCollection | null>
 */
async function loadGeoJSONFile(
  fileName: string,
  config: GeoJSONLoaderConfig = {}
): Promise<GeoJSONFeatureCollection | null> {
  const { basePath, silent } = { ...DEFAULT_CONFIG, ...config };
  
  try {
    // 构建文件路径，路径以 / 开头，指向 public 目录
    const filePath = `${basePath}/${fileName}.geojson`;
    const response = await fetch(filePath);
    
    if (!response.ok) {
      if (!silent) {
        console.warn(`无法加载 GeoJSON 文件: ${filePath} (状态码: ${response.status})`);
      }
      return null;
    }
    
    const geojsonData = await response.json() as GeoJSONFeatureCollection;
    
    if (!geojsonData || geojsonData.type !== 'FeatureCollection') {
      if (!silent) {
        console.warn(`GeoJSON 文件格式不正确: ${filePath}`);
      }
      return null;
    }
    
    return geojsonData;
  } catch (error) {
    if (!silent) {
      console.error(`加载 GeoJSON 文件失败: ${fileName}`, error);
    }
    return null;
  }
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
export async function loadAllAirportNoFlyZones(
  fileList?: string[],
  config: GeoJSONLoaderConfig = {}
): Promise<AirportNoFlyZone[]> {
  const { basePath, silent } = { ...DEFAULT_CONFIG, ...config };
  // 如果没有提供文件列表，尝试获取
  let fileNameList = fileList;
  if (!fileNameList || fileNameList.length === 0) {
    fileNameList = await getGeoJSONFileList(config);
  }
  
  // 如果仍然没有文件列表，返回空数组
  if (!fileNameList || fileNameList.length === 0) {
    if (!silent) {
      console.warn('未提供 GeoJSON 文件列表，无法加载数据');
      console.warn('请使用 loadAllAirportNoFlyZones(fileList) 提供文件列表，');
      console.warn('或在 public/geojson 目录下创建 file-list.json 文件');
    }
    return [];
  }
  
  const results: AirportNoFlyZone[] = [];
  
  // 并行加载所有文件
  const loadPromises = fileNameList.map(async (fileName) => {
    try {
      const geojsonData = await loadGeoJSONFile(fileName, config);
      
      if (!geojsonData || !geojsonData.features) {
        return;
      }
      
      // 处理每个 feature
      geojsonData.features.forEach((feature: GeoJSONFeature, index: number) => {
        if (feature.geometry.type === 'Polygon') {
          // 从 properties 或 name 字段获取名称
          const name = 
            (feature.properties as any)?.name || 
            (geojsonData as any).name || 
            fileName || 
            `机场禁飞区_${index + 1}`;
          
          results.push({
            name,
            feature: feature as GeoJSONFeature<GeoJSONPolygon>,
            fileName
          });
        }
      });
    } catch (error) {
      if (!silent) {
        console.error(`处理 GeoJSON 文件失败: ${fileName}`, error);
      }
    }
  });
  
  await Promise.all(loadPromises);
  
  return results;
}

/**
 * 读取单个机场禁飞区 GeoJSON 文件
 * @param fileName 文件名（不含扩展名，如 '珠海_金湾机场'）
 * @param config 加载配置
 * @returns Promise<AirportNoFlyZone | null> 机场禁飞区数据或 null
 */
export async function loadAirportNoFlyZone(
  fileName: string,
  config: GeoJSONLoaderConfig = {}
): Promise<AirportNoFlyZone | null> {
  const { basePath, silent } = { ...DEFAULT_CONFIG, ...config };
  
  try {
    const geojsonData = await loadGeoJSONFile(fileName, config);
    
    if (!geojsonData || !geojsonData.features) {
      return null;
    }
    
    // 查找第一个 Polygon 类型的 feature
    const feature = geojsonData.features.find(
      (f: GeoJSONFeature) => f.geometry.type === 'Polygon'
    );
    
    if (!feature) {
      if (!silent) {
        console.warn(`GeoJSON 文件中未找到 Polygon 类型的 feature: ${fileName}`);
      }
      return null;
    }
    
    const name = 
      (feature.properties as any)?.name || 
      (geojsonData as any).name || 
      fileName;
    
    return {
      name,
      feature: feature as GeoJSONFeature<GeoJSONPolygon>,
      fileName
    };
  } catch (error) {
    if (!silent) {
      console.error(`加载 GeoJSON 文件失败: ${fileName}`, error);
    }
    return null;
  }
}

/**
 * 将 GeoJSON 坐标转换为 Cesium Cartesian3 数组
 * @param coordinates GeoJSON 多边形坐标数组
 * @param height 高度偏移（米），默认为 0
 * @returns 包含 longitude, latitude, height 的对象数组
 */
export function geojsonCoordinatesToCartesian3(
  coordinates: number[][],
  height: number = 0
): Array<{ longitude: number; latitude: number; height: number }> {
  return coordinates.map(([longitude, latitude]) => {
    return {
      longitude: longitude,
      latitude: latitude,
      height: height
    };
  });
}

/**
 * 从文件名列表生成 file-list.json
 * 这个函数可以在构建时使用，生成文件列表
 * 
 * @param fileNames 文件名列表（不含扩展名）
 * @returns JSON 字符串
 */
export function generateFileListJson(fileNames: string[]): string {
  return JSON.stringify(fileNames, null, 2);
}
