#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 开始构建 VMap Cesium Toolbar 插件...');

try {
  // 清理 dist 目录
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
    console.log('✅ 清理 dist 目录');
  }

  // 构建库
  console.log('📦 构建库文件...');
  execSync('npm run build:lib', { stdio: 'inherit' });

  // 复制类型定义文件
  console.log('📝 复制类型定义文件...');
  if (fs.existsSync('src/types/index.d.ts')) {
    fs.copyFileSync('src/types/index.d.ts', 'dist/index.d.ts');
  }

  // 重命名构建文件
  console.log('🔄 重命名构建文件...');
  if (fs.existsSync('dist/index.es.js')) {
    fs.renameSync('dist/index.es.js', 'dist/index.js');
  }
  if (fs.existsSync('dist/index.es.js.map')) {
    fs.renameSync('dist/index.es.js.map', 'dist/index.js.map');
  }

  // 复制样式文件
  console.log('🎨 复制样式文件...');
  if (fs.existsSync('src/style.css')) {
    fs.copyFileSync('src/style.css', 'dist/style.css');
  }

  // 复制 README
  console.log('📖 复制文档...');
  if (fs.existsSync('PLUGIN_README.md')) {
    fs.copyFileSync('PLUGIN_README.md', 'dist/README.md');
  }

  // 生成 package.json for dist
  console.log('📋 生成发布包配置...');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const distPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    type: packageJson.type,
    main: 'index.js',
    module: 'index.js',
    types: 'index.d.ts',
    files: ['index.js', 'index.d.ts', 'style.css', 'README.md'],
    exports: {
      ".": {
        "import": "./index.js",
        "types": "./index.d.ts"
      },
      "./style": "./style.css"
    },
    peerDependencies: packageJson.peerDependencies,
    keywords: packageJson.keywords,
    author: packageJson.author,
    license: packageJson.license,
    repository: packageJson.repository,
    bugs: packageJson.bugs,
    homepage: packageJson.homepage
  };

  fs.writeFileSync('dist/package.json', JSON.stringify(distPackageJson, null, 2));

  console.log('✅ 插件构建完成！');
  console.log('📁 输出目录: dist/');
  console.log('📦 发布文件:');
  console.log('   - index.js (ES模块)');
  console.log('   - index.d.ts (类型定义)');
  console.log('   - style.css (样式文件)');
  console.log('   - README.md (使用文档)');
  console.log('   - package.json (发布配置)');

} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}
