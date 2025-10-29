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
      port: 3000,
    },
  };
});
