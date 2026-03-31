import { defineConfig } from 'vitepress';

// When deploying under nginx subpath (/cesium-map/), VitePress client router
// must know the base, otherwise hydration can fall back to 404 after the
// initial SSR HTML flashes.
const base = process.env.DOCS_BASE ?? '/cesium-map/';

export default defineConfig({
  base,
  lang: 'zh-CN',
  title: 'vmap-cesium-tool',
  description: '重构后的 Cesium 地图插件与兼容迁移文档',

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: 'API', link: '/api/' },
      { text: '使用说明', link: '/guide/' },
      { text: '插件', link: '/plugins/' },
    ],

    sidebar: {
      '/api/': [
        {
          text: 'API',
          items: [
            { text: 'API 目录', link: '/api/' },
            { text: '架构说明', link: '/guide/Architecture' },
            { text: '迁移指南', link: '/guide/Migration_Guide' },
            { text: 'MapPlugin', link: '/api/MapPlugin_API' },
            { text: 'i18n', link: '/api/I18n_API' },
            { text: 'ToolbarService', link: '/api/ToolbarService_API' },
            { text: 'OverlayService', link: '/api/OverlayService_API' },
            { text: 'DrawService', link: '/api/DrawService_API' },
            { text: 'CesiumMapLoader', link: '/api/CesiumMapLoader_API' },
            { text: 'CesiumMapToolbar', link: '/api/CesiumMapToolbar_API' },
            { text: 'DrawHelper/CesiumMapHelper', link: '/api/CesiumMapHelper_API' },
            { text: 'CesiumOverlayService', link: '/api/CesiumOverlayService_API' },
            { text: 'PointClusterLayer（点聚合）', link: '/api/CesiumPointClusterLayer_API' },
          ],
        },
      ],
      '/guide/': [
        {
          text: '使用说明',
          items: [
            { text: '使用说明目录', link: '/guide/' },
            { text: '架构说明', link: '/guide/Architecture' },
            { text: '迁移指南', link: '/guide/Migration_Guide' },
            { text: 'GeoJSON', link: '/guide/GeoJSON_Usage' },
            { text: '多语言（i18n）', link: '/guide/I18n_Usage' },
          ],
        },
      ],
      '/plugins/': [
        {
          text: '插件',
          items: [{ text: '插件目录', link: '/plugins/' }],
        },
      ],
    },

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/BenXueYou/vmap-cesium-tool',
      },
    ],
  },
});
