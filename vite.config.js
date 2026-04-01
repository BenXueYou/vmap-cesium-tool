import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";
import { resolve } from "path";
import dts from "vite-plugin-dts";

/**
 * VMap Cesium Tool Vite 配置
 * 
 * 模式说明：
 * - 默认模式：开发/演示模式，运行完整的 Vue 应用（包含 App.vue, hooks 等测试代码）
 * - lib 模式：库模式，仅打包插件核心代码（core, components, services, entities 等），排除测试文件
 * 
 * 打包范围：
 * - ✅ 包含：core/, components/, adapters/, styles/, i18n/, utils/, libs/(过渡期)
 * - ❌ 排除：App.vue, main.ts, hooks/, assets/(测试用)
 */

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';
  
  if (isLib) {
    // 库模式配置 - 仅打包插件核心代码
    return {
      publicDir: false,
      plugins: [
        vue(),
        dts({
          // 明确指定包含的文件
          include: [
            'src/index.ts',
            'src/entry.ts',
            'src/core/**/*.{ts,d.ts}',
            'src/components/**/*.{ts,d.ts}',
            'src/adapters/**/*.{ts,d.ts}',
            'src/styles/**/*.{ts,d.ts}',
            'src/i18n/**/*.{ts,d.ts}',
            'src/utils/**/*.{ts,d.ts}',
            'src/libs/**/*.ts', // 过渡期：保留 libs 引用直到完全迁移
          ],
          // 明确排除测试相关文件
          exclude: [
            'src/main.ts',
            'src/App.vue',
            'src/hooks/**',
            'src/assets/**',
            '**/*.test.ts',
            '**/*.spec.ts',
            'node_modules'
          ],
          outDir: 'dist',
          insertTypesEntry: true
        })
        // 注意：GeoJSON 文件的复制由 build-plugin.js 处理
        // 因为 vite-plugin-static-copy 在库模式下可能不工作
      ],
      build: {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'VMapCesiumToolbar',
          fileName: (format) => `index.${format}.js`,
          formats: ['es']
        },
        rollupOptions: {
          external: ['vue', 'cesium'],
          output: {
            exports: 'named',
            globals: {
              vue: 'Vue',
              cesium: 'Cesium'
            }
          }
        },
        outDir: 'dist',
        sourcemap: true
      }
    };
  }
  
  // 开发模式配置
  return {
    plugins: [
      vue(),
      cesium(),
    ],
    optimizeDeps: {
      include: ["cesium"],
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      fs: {
        // 允许访问项目根目录以外的文件
        strict: false,
      },
    },
    // 确保 .geojson 文件被正确处理
    assetsInclude: ['**/*.geojson'],
  };
});
