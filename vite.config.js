import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import cesium from "vite-plugin-cesium";
import { resolve } from "path";
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';
  
  if (isLib) {
    // 库模式配置
    return {
      plugins: [
        vue(),
        dts({
          include: ['src/**/*.ts', 'src/**/*.d.ts', 'src/**/*.vue'],
          exclude: ['src/main.ts', 'src/App.vue' ,'**/*.test.ts', '**/*.spec.ts', 'node_modules'],
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
          formats: ['es', 'umd']
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
