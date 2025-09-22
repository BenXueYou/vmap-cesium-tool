# VMap Cesium Toolbar 插件发布指南

## 构建插件

### 1. 安装依赖

```bash
npm install
```

### 2. 构建插件包

```bash
npm run build:plugin
```

这个命令会：

- 清理 dist 目录
- 构建库文件（ES模块格式）
- 复制类型定义文件
- 复制样式文件
- 复制文档
- 生成发布用的 package.json

### 3. 验证构建结果

构建完成后，`dist/` 目录应包含以下文件：

```
dist/
├── index.js          # 主入口文件（ES模块）
├── index.d.ts        # TypeScript 类型定义
├── style.css         # 样式文件
├── README.md         # 使用文档
└── package.json      # 发布配置
```

## 发布到 NPM

### 1. 登录 NPM

```bash
npm login
```

### 2. 进入 dist 目录

```bash
cd dist
```

### 3. 发布包

```bash
npm publish
```

### 4. 验证发布

```bash
npm view vmap-cesium-toolbar
```

## 本地测试

### 1. 创建测试项目

```bash
mkdir test-plugin
cd test-plugin
npm init -y
```

### 2. 安装插件（本地）

```bash
npm install file:../vmap-cesium-toolbar/dist
```

### 3. 创建测试文件

```javascript
// test.js
import { CesiumMapToolbar, initCesium } from 'vmap-cesium-toolbar';
import 'vmap-cesium-toolbar/style';

console.log('插件加载成功！');
```

### 4. 运行测试

```bash
node test.js
```

## 版本管理

### 1. 更新版本号

```bash
npm version patch   # 补丁版本 (1.0.0 -> 1.0.1)
npm version minor   # 次要版本 (1.0.0 -> 1.1.0)
npm version major   # 主要版本 (1.0.0 -> 2.0.0)
```

### 2. 发布新版本

```bash
npm run build:plugin
cd dist
npm publish
```

## 示例项目

### 基本使用示例

```bash
cd examples/basic-usage
# 在浏览器中打开 index.html
```

### Vue 3 示例

```bash
cd examples/vue3-usage
npm install
npm run dev
```

## 故障排除

### 1. 构建失败

- 检查 Node.js 版本（推荐 16+）
- 确保所有依赖已安装
- 检查 TypeScript 配置

### 2. 发布失败

- 检查 NPM 登录状态
- 确保包名唯一
- 检查版本号是否已存在

### 3. 类型定义问题

- 确保 `src/types/index.d.ts` 存在
- 检查类型定义语法
- 验证导出接口

## 开发工作流

1. **开发功能**：在 `src/` 目录下开发
2. **测试功能**：使用 `npm run dev` 测试
3. **构建插件**：使用 `npm run build:plugin`
4. **本地测试**：在示例项目中测试
5. **发布版本**：更新版本号并发布

## 注意事项

1. **依赖管理**：确保 peerDependencies 正确设置
2. **类型定义**：保持类型定义与实现同步
3. **文档更新**：功能变更时更新文档
4. **版本兼容**：重大变更时升级主版本号
5. **测试覆盖**：发布前充分测试所有功能
