import { defineConfig } from 'vitepress';

const base = process.env.DOCS_BASE ?? '/';

export default defineConfig({
  base,
  lang: 'zh-CN',
  title: 'vmap-cesium-tool',
  description: 'Cesium 地图工具栏与覆盖物/绘制工具文档',

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: 'CesiumMapToolbar', link: '/CesiumMapToolbar_API' },
      { text: 'DrawHelper', link: '/CesiumMapHelper_API' },
      { text: 'CesiumMapLoader', link: '/CesiumMapLoader_API' },
      { text: 'CesiumOverlayService', link: '/CesiumOverlayService_API' },
      { text: 'GeoJSON', link: '/GeoJSON_Usage' },
    ],

    sidebar: [
      {
        text: 'API',
        items: [
          { text: 'CesiumMapToolbar', link: '/CesiumMapToolbar_API' },
          { text: 'DrawHelper（CesiumMapHelper）', link: '/CesiumMapHelper_API' },
          { text: 'CesiumMapLoader', link: '/CesiumMapLoader_API' },
          { text: 'CesiumOverlayService', link: '/CesiumOverlayService_API' },
        ],
      },
      {
        text: '使用说明',
        items: [{ text: 'GeoJSON', link: '/GeoJSON_Usage' }],
      },
    ],

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/BenXueYou/vmap-cesium-tool',
      },
    ],
  },
});
