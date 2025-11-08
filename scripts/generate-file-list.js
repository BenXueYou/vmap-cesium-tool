#!/usr/bin/env node

/**
 * 生成 GeoJSON 文件列表脚本
 * 用于在 public/geojson 目录下生成 file-list.json 文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicGeojsonDir = path.join(__dirname, '../public/geojson');

console.log('📋 生成 GeoJSON 文件列表...');

try {
  // 检查目录是否存在
  if (!fs.existsSync(publicGeojsonDir)) {
    console.log(`⚠️  目录不存在: ${publicGeojsonDir}`);
    console.log('   请先创建 public/geojson 目录并放入 GeoJSON 文件');
    process.exit(1);
  }

  // 读取所有 geojson 文件
  const files = fs.readdirSync(publicGeojsonDir).filter(file => file.endsWith('.geojson'));
  
  if (files.length === 0) {
    console.log('⚠️  未找到任何 GeoJSON 文件');
    process.exit(1);
  }

  // 生成文件列表（不含扩展名）
  const fileList = files.map(file => file.replace('.geojson', '')).sort();

  // 生成 file-list.json
  const fileListPath = path.join(publicGeojsonDir, 'file-list.json');
  fs.writeFileSync(fileListPath, JSON.stringify(fileList, null, 2));

  console.log(`✅ 成功生成文件列表: ${fileList.length} 个文件`);
  console.log(`📄 文件路径: ${fileListPath}`);
  console.log(`📝 文件列表预览（前10个）:`);
  fileList.slice(0, 10).forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  if (fileList.length > 10) {
    console.log(`   ... 还有 ${fileList.length - 10} 个文件`);
  }

} catch (error) {
  console.error('❌ 生成文件列表失败:', error.message);
  process.exit(1);
}

