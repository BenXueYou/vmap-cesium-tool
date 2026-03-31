# Layer Constants 拆分计划

## 问题分析
当前 `src/core/constants.ts` 文件包含大量图层相关的配置代码，导致文件过于冗余（367行）。这些代码应该按照 `/core/layers` 目录下的文件结构进行拆分。

## 需要拆分的代码

### 1. 天地图相关配置 (第27-112行)
- `DEFAULT_TDT_CONFIG: TDTLayerConfig`
- `createTDTImageryConfig(token: string): Cesium.ImageryProvider[]`
- `createTDTVectorConfig(token: string): Cesium.ImageryProvider[]`
- `createTDTTerrainConfig(token: string): Cesium.ImageryProvider[]`

**目标文件**: `src/core/layers/TDTMapLayer.ts`

### 2. 高德地图相关配置 (第117-154行)
- `createGaodeImageryConfig(token?: string): Cesium.ImageryProvider[]`
- `createGaodeVectorConfig(token?: string): Cesium.ImageryProvider[]`

**目标文件**: `src/core/layers/GaodeMapLayer.ts`

### 3. 百度地图相关配置 (第159-173行)
- `createBaiduImageryConfig(token?: string): Cesium.ImageryProvider[]`

**目标文件**: `src/core/layers/BaiduMapLayer.ts`

### 4. OSM地图相关配置 (第178-187行)
- `createOSMConfig(): Cesium.ImageryProvider[]`

**目标文件**: `src/core/layers/OSMMapLayer.ts`

### 5. 默认地图类型配置 (第238-288行)
- `DEFAULT_MAP_TYPES` - 这个配置引用了天地图配置函数，需要重新设计

## 实施步骤

### 阶段1：更新图层文件
1. **TDTMapLayer.ts**
   - 将天地图配置函数移动到文件顶部
   - 移除从constants.ts的导入
   - 更新类内部对配置函数的引用

2. **GaodeMapLayer.ts**
   - 将高德地图配置函数移动到文件顶部
   - 移除从constants.ts的导入
   - 更新类内部对配置函数的引用

3. **BaiduMapLayer.ts**
   - 将百度地图配置函数移动到文件顶部
   - 移除从constants.ts的导入
   - 更新类内部对配置函数的引用

4. **OSMMapLayer.ts**
   - 将OSM配置函数移动到文件顶部
   - 移除从constants.ts的导入
   - 更新类内部对配置函数的引用

### 阶段2：清理constants.ts
1. 移除已拆分的图层配置函数
2. 更新 `DEFAULT_MAP_TYPES` 配置，使其引用新的图层类而不是配置函数
3. 确保其他非图层相关的常量保持不变

### 阶段3：更新依赖
1. 检查是否有其他文件导入这些被移动的配置函数
2. 更新这些文件的导入路径

## 代码结构示例

### TDTMapLayer.ts 更新后结构
```typescript
import * as Cesium from 'cesium';
import type { TDTLayerConfig } from '../types';
import { MapLayer } from './MapLayer';

// 配置函数移动到本地
export const createTDTImageryConfig = (token: string): Cesium.ImageryProvider[] => {
  // ... 实现
};

export const createTDTVectorConfig = (token: string): Cesium.ImageryProvider[] => {
  // ... 实现
};

export const createTDTTerrainConfig = (token: string): Cesium.ImageryProvider[] => {
  // ... 实现
};

export class TDTMapLayer extends MapLayer {
  // ... 类实现
}
```

### constants.ts 清理后
移除第27-187行的所有图层配置函数，只保留：
- 默认相机配置
- 默认按钮配置
- 默认工具栏样式
- 其他通用常量

## 向后兼容性考虑
1. 如果其他文件直接导入这些配置函数，需要更新导入路径
2. 可以考虑在constants.ts中提供向后兼容的导出（不推荐，会增加复杂性）
3. 更新文档说明新的导入方式

## 测试计划
1. 编译测试：确保TypeScript编译通过
2. 功能测试：测试每个图层类仍然正常工作
3. 集成测试：测试MapPlugin等集成组件正常工作

## 时间估计
- 阶段1：30分钟
- 阶段2：15分钟  
- 阶段3：15分钟
- 测试：20分钟

**总计：约80分钟**

## 风险与缓解
1. **风险**：其他文件依赖被移动的配置函数
   **缓解**：使用全局搜索查找所有导入，提前更新

2. **风险**：配置函数有外部依赖
   **缓解**：确保移动时包含所有必要的导入

3. **风险**：TypeScript类型错误
   **缓解**：逐步实施，每一步都进行编译测试