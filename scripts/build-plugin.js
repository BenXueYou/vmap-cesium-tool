#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  fs.readdirSync(sourceDir, { withFileTypes: true }).forEach((entry) => {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      return;
    }

    fs.copyFileSync(sourcePath, targetPath);
  });
}

function getDistTopLevelEntries() {
  if (!fs.existsSync(distRoot)) {
    return [];
  }

  return fs.readdirSync(distRoot, { withFileTypes: true })
    .filter((entry) => entry.name !== 'package.json')
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

console.log('🚀 开始构建 VMap Cesium Toolbar 插件...');

try {
  // 清理 dist 目录
  if (fs.existsSync(distRoot)) {
    fs.rmSync(distRoot, { recursive: true });
    console.log('✅ 清理 dist 目录');
  }

  // 构建库
  console.log('📦 构建库文件...');
  execSync('pnpm run build', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // 保持 Vite lib 模式默认命名（index.es.js / index.umd.js），不再强行重命名

  // 复制样式文件
  console.log('🎨 复制样式文件...');
  const sourceStylePath = path.join(projectRoot, 'src/style.css');
  const distStylePath = path.join(distRoot, 'style.css');
  if (fs.existsSync(sourceStylePath)) {
    fs.copyFileSync(sourceStylePath, distStylePath);
  }

  // 处理 GeoJSON 文件
  console.log('🗺️ 处理 GeoJSON 文件...');
  const publicGeojsonDir = path.join(projectRoot, 'public/geojson');
  const distGeojsonDir = path.join(distRoot, 'geojson');
  
  if (fs.existsSync(publicGeojsonDir)) {
    // 确保 dist/geojson 目录存在
    if (!fs.existsSync(distGeojsonDir)) {
      fs.mkdirSync(distGeojsonDir, { recursive: true });
    }
    
    // 读取所有 geojson 文件
    const files = fs.readdirSync(publicGeojsonDir).filter(file => file.endsWith('.geojson'));
    const fileList = files.map(file => file.replace('.geojson', ''));
    
    // 生成 file-list.json
    const fileListPath = path.join(distGeojsonDir, 'file-list.json');
    fs.writeFileSync(fileListPath, JSON.stringify(fileList, null, 2));
    console.log(`   ✅ 生成文件列表: ${fileList.length} 个文件`);
    
    // 复制所有 geojson 文件
    files.forEach(file => {
      const srcPath = path.join(publicGeojsonDir, file);
      const destPath = path.join(distGeojsonDir, file);
      fs.copyFileSync(srcPath, destPath);
    });
    console.log(`   ✅ 复制 ${files.length} 个 GeoJSON 文件`);
  } else {
    console.log('   ⚠️  public/geojson 目录不存在，跳过 GeoJSON 文件处理');
  }

  // 复制 README
  console.log('📖 复制文档...');
  const sourceReadmePath = path.join(projectRoot, 'README.md');
  const distReadmePath = path.join(distRoot, 'README.md');
  if (fs.existsSync(sourceReadmePath)) {
    fs.copyFileSync(sourceReadmePath, distReadmePath);
  }

  // 生成 package.json for dist
  console.log('📋 生成发布包配置...');
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const publishFiles = getDistTopLevelEntries();
  const distPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    type: packageJson.type,
    main: 'index.es.js',
    module: 'index.es.js',
    types: 'index.d.ts',
    files: publishFiles,
    exports: {
      ".": {
        "types": "./index.d.ts",
        "import": "./index.es.js",
        "default": "./index.es.js"
      },
      "./style": "./style.css",
      "./package.json": "./package.json"
    },
    peerDependencies: packageJson.peerDependencies,
    dependencies: packageJson.dependencies,
    keywords: packageJson.keywords,
    author: packageJson.author,
    license: packageJson.license,
    repository: packageJson.repository,
    bugs: packageJson.bugs,
    homepage: packageJson.homepage
  };

  fs.writeFileSync(path.join(distRoot, 'package.json'), JSON.stringify(distPackageJson, null, 2));

  console.log('✅ 插件构建完成！');
  console.log('📁 输出目录: dist/');
  console.log('📦 发布文件:');
  publishFiles.forEach((file) => {
    console.log(`   - ${file}`);
  });
  console.log('   - package.json (发布配置)');

} catch (error) {
  console.error('❌ 构建失败:', error.message);
  process.exit(1);
}
