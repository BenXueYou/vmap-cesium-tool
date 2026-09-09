# GeoJSON 文件使用说明

## 概述

本组件库支持从 `public/geojson` 目录加载 GeoJSON 文件，用于显示机场禁飞区等地理数据。

## 目录结构

```
项目根目录/
├── public/
│   └── geojson/
│       ├── 珠海_金湾机场.geojson
│       ├── 北京_首都机场.geojson
│       ├── ... (其他 geojson 文件)
│       └── file-list.json (文件列表，自动生成)
├── dist/
│   └── geojson/ (打包后自动生成)
│       ├── *.geojson
│       └── file-list.json
└── src/
    └── utils/
        └── geojson.ts (GeoJSON 加载工具)
```

## 使用步骤

### 1. 准备 GeoJSON 文件

将所有的 `.geojson` 文件放入 `public/geojson` 目录：

```bash
# 如果文件在 src/assets/geojson 目录
cp -r src/assets/geojson/*.geojson public/geojson/
```

### 2. 生成文件列表

运行以下命令生成 `file-list.json`：

```bash
npm run generate:file-list
```

这个命令会：
- 扫描 `public/geojson` 目录下的所有 `.geojson` 文件
- 生成 `public/geojson/file-list.json` 文件，包含所有文件名（不含扩展名）

### 3. 在代码中使用

#### 方式一：自动加载（推荐）

如果已经生成了 `file-list.json`，可以直接调用：

```typescript
import { loadAllAirportNoFlyZones } from '@xingm/vmap-cesium-toolbar';

// 自动从 file-list.json 读取文件列表
const noFlyZones = await loadAllAirportNoFlyZones();
```

#### 方式二：手动提供文件列表

如果不想使用 `file-list.json`，可以手动提供文件列表：

```typescript
import { loadAllAirportNoFlyZones } from '@xingm/vmap-cesium-toolbar';

const fileList = [
  '珠海_金湾机场',
  '北京_首都机场',
  '上海_浦东机场',
  // ... 其他文件名
];

const noFlyZones = await loadAllAirportNoFlyZones(fileList);
```

#### 方式三：加载单个文件

```typescript
import { loadAirportNoFlyZone } from '@xingm/vmap-cesium-toolbar';

const zone = await loadAirportNoFlyZone('珠海_金湾机场');
if (zone) {
  console.log('机场名称:', zone.name);
  console.log('GeoJSON 数据:', zone.feature);
}
```

#### 方式四：自定义配置

```typescript
import { loadAllAirportNoFlyZones } from '@xingm/vmap-cesium-toolbar';

// 自定义基础路径和错误处理
const noFlyZones = await loadAllAirportNoFlyZones(undefined, {
  basePath: '/custom/path',  // 自定义路径，默认为 '/geojson'
  silent: true               // 静默处理错误，不输出警告
});
```

### 4. 在 CesiumMapToolbar 中使用

```typescript
import { CesiumMapToolbar } from '@xingm/vmap-cesium-toolbar';

// 创建工具栏实例
const toolbar = new CesiumMapToolbar(viewer, container);

// 显示禁飞区（内部会自动调用 loadAllAirportNoFlyZones）
await toolbar.showNoFlyZones();
```

## 打包配置

### 开发环境

开发环境下，GeoJSON 文件从 `public/geojson` 目录加载，路径为 `/geojson/*.geojson`。

### 生产环境（组件库打包）

运行 `npm run build:lib` 或 `npm run build:plugin` 时：

1. **自动复制文件**：`build-plugin.js` 会自动：
   - 将 `public/geojson/*.geojson` 复制到 `dist/geojson/`
   - 生成 `dist/geojson/file-list.json`

2. **发布包结构**：
   ```
   dist/
   ├── index.js
   ├── index.d.ts
   ├── style.css
   ├── package.json
   └── geojson/
       ├── *.geojson
       └── file-list.json
   ```

3. **使用者的配置**：
   
   当组件库被安装到其他项目时，使用者需要：
   
   - 将 `dist/geojson` 目录复制到项目的 `public` 目录
   - 或者配置正确的 `basePath`：
   
   ```typescript
   // 如果数据在项目的 public/custom-geojson 目录
   const noFlyZones = await loadAllAirportNoFlyZones(undefined, {
     basePath: '/custom-geojson'
   });
   ```

## API 参考

### `loadAllAirportNoFlyZones(fileList?, config?)`

加载所有机场禁飞区数据。

**参数：**
- `fileList?: string[]` - 可选的文件名列表（不含扩展名）。如果不提供，会尝试从 `file-list.json` 读取
- `config?: GeoJSONLoaderConfig` - 可选配置
  - `basePath?: string` - 基础路径，默认为 `'/geojson'`
  - `silent?: boolean` - 是否静默处理错误，默认为 `false`

**返回：** `Promise<AirportNoFlyZone[]>`

### `loadAirportNoFlyZone(fileName, config?)`

加载单个机场禁飞区数据。

**参数：**
- `fileName: string` - 文件名（不含扩展名）
- `config?: GeoJSONLoaderConfig` - 可选配置

**返回：** `Promise<AirportNoFlyZone | null>`

### `geojsonCoordinatesToCartesian3(coordinates, height?)`

将 GeoJSON 坐标转换为 Cesium 坐标格式。

**参数：**
- `coordinates: number[][]` - GeoJSON 坐标数组
- `height?: number` - 高度偏移（米），默认为 0

**返回：** `Array<{ longitude: number; latitude: number; height: number }>`

## 注意事项

1. **文件路径**：所有路径都以 `/` 开头，指向 `public` 目录
2. **文件列表**：建议使用 `npm run generate:file-list` 生成文件列表，避免手动维护
3. **打包时**：`build-plugin.js` 会自动处理文件复制，无需手动操作
4. **跨域问题**：如果 GeoJSON 文件在不同域名下，需要配置 CORS
5. **文件大小**：大量 GeoJSON 文件可能影响加载性能，建议按需加载

## 故障排除

### 问题：无法加载 GeoJSON 文件

**可能原因：**
1. 文件不在 `public/geojson` 目录
2. 路径配置不正确
3. 服务器未正确配置静态文件服务

**解决方案：**
1. 检查文件是否在正确位置
2. 检查浏览器控制台的网络请求，确认路径是否正确
3. 确认服务器配置支持静态文件访问

### 问题：打包后无法加载文件

**可能原因：**
1. `dist/geojson` 目录未正确生成
2. 使用者未将 `geojson` 目录复制到项目的 `public` 目录

**解决方案：**
1. 检查 `build-plugin.js` 是否正常运行
2. 确认 `dist/geojson` 目录存在
3. 使用者需要将 `dist/geojson` 复制到项目的 `public` 目录

