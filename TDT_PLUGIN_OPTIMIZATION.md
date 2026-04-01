# 天地图插件依赖优化说明

## 概述

本次优化主要解决了 `tdt-cesium-plugin`（天地图插件）与主项目的依赖关系问题，实现了真正的插件化依赖。

## 问题分析

### 原有问题

1. **强耦合依赖**：主项目通过相对路径直接引用插件源码
   ```javascript
   // 原代码（问题）
   import TdtPlug from '../../../plugin/tdt-cesium-plugin/dist/tdtplug.es.js';
   ```

2. **无法独立发布**：插件不能作为独立 npm 包使用
3. **构建复杂**：主项目构建时需要处理插件的相对路径
4. **维护困难**：插件更新需要同步多个项目

## 优化方案

### 1. package.json 配置

在主项目的 `package.json` 中添加可选的 peerDependencies：

```json
{
  "peerDependenciesMeta": {
    "tdt-terrain-cesium-plugin": {
      "optional": true
    }
  }
}
```

### 2. Vite/Rollup 构建配置

在 `vite.config.js` 中，将插件添加到 external 依赖：

```javascript
rollupOptions: {
  external: ['vue', 'cesium', 'tdt-terrain-cesium-plugin'],
  output: {
    globals: {
      vue: 'Vue',
      cesium: 'Cesium',
      'tdt-terrain-cesium-plugin': 'Tdt3dPlug'
    }
  }
}
```

### 3. 灵活的插件加载机制

在 `TDTMapLayer.ts` 中实现了：

- **动态导入**：尝试通过 ESM 动态导入插件
- **手动注入**：提供 `setTDTPlugin()` API 供用户手动注入
- **优雅降级**：插件缺失时只打印警告，不影响主功能使用

## 使用方式

### 方式一：通过 npm 安装插件（推荐）

1. 安装插件：

```bash
npm install tdt-terrain-cesium-plugin
# 或者
yarn add tdt-terrain-cesium-plugin
```

2. 在代码中使用：

**自动加载（推荐）**：
```javascript
import { createMapPlugin } from '@xingm/vmap-cesium-toolbar';

// 插件已安装，会自动加载，无需手动注入
const map = createMapPlugin('map-container', {
  layers: {
    type: 'tdt',
    tdt: {
      mapTypeId: 'tdt3d',
      token: 'your-token'
    }
  }
});
```

**手动注入（可选）**：
```javascript
import { createMapPlugin, setTDTPlugin } from '@xingm/vmap-cesium-toolbar';
import TdtPlug from 'tdt-terrain-cesium-plugin';

// 手动注入插件
setTDTPlugin(TdtPlug);

// 创建地图实例
const map = createMapPlugin('map-container', {
  layers: {
    type: 'tdt',
    tdt: {
      mapTypeId: 'tdt3d',
      token: 'your-token'
    }
  }
});
```

### 方式二：使用本地插件（开发环境）

保持原有方式，使用本地插件：

```javascript
import { createMapPlugin, setTDTPlugin } from '@xingm/vmap-cesium-toolbar';
// 从本地路径导入
import TdtPlug from './path/to/plugin/dist/tdtplug.es.js';

setTDTPlugin(TdtPlug);
```

### 方式三：不使用插件（基础功能）

如果不需要天地图三维功能，可以不安装插件，主项目仍可正常使用其他图层。

## API 说明

### `setTDTPlugin(plugin: any)`

手动注入天地图插件。

**参数：**
- `plugin` - 天地图插件模块对象

**示例：**
```javascript
import TdtPlug from 'tdt-terrain-cesium-plugin';
setTDTPlugin(TdtPlug);
```

### `hasTDT3DExtension(Cesium): boolean`

检查天地图三维插件是否可用。

### 天地图配置函数

- `createTDTImageryConfig(token)` - 创建影像图层配置
- `createTDTVectorConfig(token)` - 创建矢量图层配置
- `createTDTTerrainConfig(token)` - 创建地形图层配置
- `createTDT3DImageryConfig(token)` - 创建三维影像图层配置
- `createTDT3DTerrainProvider(token)` - 创建三维地形 Provider
- `createTDT3DGeoWTFS(token, viewer)` - 创建三维路网服务

## 向后兼容性

本次优化保持了完全的向后兼容性：

1. 现有代码无需修改即可继续工作
2. 本地插件路径仍然支持
3. 插件缺失时只影响天地图三维功能，其他功能正常

## 发布流程

### 插件独立发布

天地图插件可以独立发布到 npm：

```bash
cd plugin/tdt-cesium-plugin
npm version patch  # 或 minor/major
npm publish
```

### 主项目发布

主项目发布时不再包含天地图插件代码：

```bash
npm run build
npm publish
```

## 项目结构

```
vmap-cesium-tool/
├── plugin/
│   └── tdt-cesium-plugin/          # 独立的天地图插件（可单独发布）
│       ├── src/
│       ├── dist/
│       └── package.json
├── src/
│   ├── core/
│   │   └── layers/
│   │       └── TDTMapLayer.ts     # 集成天地图的核心代码
│   └── index.ts                    # 主入口，导出 setTDTPlugin
├── package.json
└── vite.config.js
```

## 优势

1. **解耦**：主项目和插件独立维护和发布
2. **灵活**：用户可以选择是否安装天地图插件
3. **标准化**：遵循 npm 包管理规范
4. **可扩展**：为未来添加更多类似插件提供了模板
5. **轻量**：主项目不包含不需要的代码

## 注意事项

1. 天地图插件的 peerDependencies 需要同时安装：`cesium`、`pako`、`protobufjs`
2. 如果使用 TypeScript，可能需要为插件添加类型声明
3. 动态导入在某些构建环境中可能需要额外配置

## 总结

通过本次优化，我们实现了：

✅ 天地图插件作为可选的 peerDependency
✅ 提供 setTDTPlugin() API 手动注入
✅ 支持动态导入和本地路径两种方式
✅ 保持完全的向后兼容性
✅ 插件可以独立发布到 npm

这样，用户可以根据需要选择是否使用天地图三维功能，而不会增加不必要的依赖负担。
