# MapPlugin.ts 更新计划

## 问题分析
MapPlugin.ts 仍然直接使用从 constants.ts 导入的图层配置函数，但这些函数已经被移动到各自的图层文件中。需要更新 MapPlugin.ts 以使用新的架构。

## 需要更新的部分

### 1. 导入更新
当前导入：
```typescript
import { 
  DEFAULT_TOOLBAR_STYLE, 
  DEFAULT_MAP_TYPES, 
  DEFAULT_CAMERA_CONFIG,
  DEFAULT_PROVIDER_TYPE,
} from './constants';
```

需要添加：
```typescript
import { 
  createTDTImageryConfig,
  createTDTVectorConfig,
  createTDTTerrainConfig 
} from './layers/TDTMapLayer';

import {
  createGaodeImageryConfig,
  createGaodeVectorConfig
} from './layers/GaodeMapLayer';

import {
  createBaiduImageryConfig
} from './layers/BaiduMapLayer';

import {
  createOSMConfig
} from './layers/OSMMapLayer';
```

### 2. 图层添加方法更新
当前方法直接使用配置函数，需要更新为从新位置导入。

#### 2.1 `addTDTLayers` 方法
- 第266、269、272、275行使用 `createTDTVectorConfig`、`createTDTImageryConfig`、`createTDTTerrainConfig`
- 需要更新导入路径

#### 2.2 `addGaodeLayers` 方法
- 第302、305、308行使用 `createGaodeVectorConfig`、`createGaodeImageryConfig`
- 需要更新导入路径

#### 2.3 `addBaiduLayers` 方法
- 第331行使用 `createBaiduImageryConfig`
- 需要更新导入路径

#### 2.4 `addOSMLayers` 方法
- 第343行使用 `createOSMConfig`
- 需要更新导入路径

### 3. 架构改进建议（可选）
可以考虑使用图层类而不是直接使用配置函数，但为了保持向后兼容性，暂时只更新导入路径。

## 实施步骤

### 阶段1：更新导入
1. 添加新的导入语句
2. 保持现有导入不变

### 阶段2：验证代码
1. 检查TypeScript编译是否通过
2. 确保没有其他文件依赖旧的导入

### 阶段3：测试
1. 测试地图初始化功能
2. 测试各图层类型

## 风险与缓解

### 风险1：循环依赖
- **风险**：MapPlugin导入图层文件，图层文件可能导入MapPlugin
- **缓解**：检查图层文件，确保它们不导入MapPlugin

### 风险2：类型错误
- **风险**：配置函数签名可能发生变化
- **缓解**：保持函数签名一致，只移动位置不修改实现

### 风险3：性能影响
- **风险**：导入多个文件可能增加打包体积
- **缓解**：使用tree-shaking，实际影响很小

## 时间估计
- 阶段1：15分钟
- 阶段2：10分钟
- 阶段3：15分钟

**总计：约40分钟**

## 预期结果
1. MapPlugin.ts 编译通过
2. 所有图层功能正常工作
3. 代码结构更清晰，符合新的架构设计