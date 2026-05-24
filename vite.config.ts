import { defineConfig, loadEnv } from 'vite'
import type { UserConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /** 开发时把浏览器请求 /api 转发到真实后端（与 .env.development 中 VITE_DEV_PROXY_TARGET 一致） */
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://localhost:18080'

  return {
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || 'dev'),
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/api/**', 'src/utils/**'],
    },
  } satisfies UserConfig['test'],
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/types/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/types/components.d.ts',
    }),
    /**
     * PWA / Service Worker:
     * - 桌面快捷方式 + 移动端可"加到桌面"(已有 manifest.webmanifest)
     * - 静态资源 cache-first(版本化文件名,SW 自动刷新)
     * - API 不缓存(除 /meta/* 这类配置字典外,避免数据陈旧)
     * - registerType=autoUpdate:新部署自动接管,跳过用户手动 reload
     */
    VitePWA({
      registerType: 'autoUpdate',
      // 复用 public/manifest.webmanifest 现有配置,不让插件重生成
      manifest: false,
      // null = 不自动 inject,改由 SwUpdatePrompt.vue 通过 virtual:pwa-register
      // 手动 registerSW(),拿到 onNeedRefresh / onOfflineReady 回调驱动 UI 提示
      injectRegister: null,
      // dev 模式默认不注册 SW,避免拦截热更新;生产 build 才生成
      devOptions: { enabled: false },
      workbox: {
        // SPA fallback:offline 时所有路由 fallback 到 index.html
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/docs\//],
        // 静态资源 hash 命名,长期缓存 + SW 接管刷新
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // 排除大文件(echarts/x6 vendor chunk)避免预缓存膨胀
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // P7 Web Push:把自定义 push / notificationclick handler 注入生成的 SW
        importScripts: ['/push-handler.js'],
        runtimeCaching: [
          {
            // /meta/* 字典型接口缓存 1h,弱网时回退缓存值;失败不影响主流程
            urlPattern: /\/api\/console\/meta\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'meta-api-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 默认 esbuild minify（terser 慢 5-10x），显式写明防被覆盖
    minify: 'esbuild',
    // element-plus 1.06 MB（gzip 334 KB）是合理 vendor chunk，阈值拉到 1200 静默噪声
    // 超 1200 才告警，仍能提示"真的需要拆分"的新引入
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Vite 8 默认 Rolldown bundler 不支持 manualChunks 的 object form;
        // 改为 function 形式语义等价(element-plus / @element-plus/icons-vue → vendor-element-plus,
        // vue / vue-router / pinia → vendor-vue,其余依赖默认按路由 lazy 拆分,
        // echarts / x6 等不显式分块以保留路由级 lazy 加载)。
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('element-plus') || id.includes('@element-plus/icons-vue')) {
              return 'vendor-element-plus'
            }
            if (
              id.includes('/vue/') ||
              id.includes('/vue-router/') ||
              id.includes('/pinia/')
            ) {
              return 'vendor-vue'
            }
          }
        },
      },
    },
  },
  /**
   * 显式 pre-bundle：大依赖首启时一次性处理，避免用户第一次访问某条路由
   * 才触发 optimize dep，造成 2-3s HMR 卡顿。
   */
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'element-plus',
      '@element-plus/icons-vue',
      '@tanstack/vue-query',
      'axios',
      'echarts',
      'vue-echarts',
    ],
  },
  server: {
    port: 5173,
    // 允许任何 Host 头（dev only）。生产 build 不使用这段配置。
    // 场景：手机/其他设备通过 localtunnel / cloudflared / ngrok 等隧道访问本机 dev。
    allowedHosts: true,
    // 通过 cloudflared / ngrok 等 https 隧道访问时，page 在 :443，但 Vite HMR client
    // 默认尝试 wss://<同 host>:5173 → 端口被隧道拒，浏览器报错后 Vue mount 卡住白屏。
    // 仅当通过隧道访问时强制 wss/443;直接走 localhost:5173 时用默认 ws,
    // 否则浏览器去连 wss://localhost:443 没人监听报错(直接看控制台一堆 wss failed)。
    // VITE_HMR_TUNNEL=1 由用户在跑隧道命令时显式开启(.env.development.local 或临时 env)。
    hmr: env.VITE_HMR_TUNNEL === '1' ? { clientPort: 443, protocol: 'wss' } : true,
    /**
     * watch.ignored:把 vitepress build 产物挡在 chokidar 之外。
     *
     * 不加这个,`make dev-all` 期间 vitepress 把 ~200 个 html 写到
     * tools/docs-bridge/{backend,frontend}/.vitepress/{dist,cache} 时会触发 vite 上百次
     * full page reload(HMR 把 html 变更当成路由刷新),内存秒上 1GB 然后被 OOM-killer 干掉
     * (上次现象是 SPA exit code 137 + DOCS exit 143 几乎同时收到)。
     *
     * tools/docs-bridge 跟 SPA 源代码完全解耦,vite 没必要 watch 它。
     */
    watch: {
      ignored: ['**/tools/docs-bridge/**', '**/dist/**', '**/playwright-report/**'],
    },
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
      },
      // 不再代理 /docs 到 vitepress dev (5174):VitePress dev 在非根 base 下
      // 会从客户端拼出形如 `/docs.md` 的 module URL(漏 /docs/ 前缀),proxy
      // 透传后 vitepress 5174 也匹配不上 → 404。
      // dev 期请直接访问 http://localhost:5174/docs/ 看文档;
      // prod 由 nginx alias /var/www/batch-docs/ 兜住,无 base 计算问题。
    },
    /**
     * 预热：dev 启动时后台编译这些文件，用户首次导航立即到位。
     * 仅列高频公共路径，低频页面按需动态 import 不用预热。
     */
    warmup: {
      clientFiles: [
        './src/main.ts',
        './src/App.vue',
        './src/layout/DefaultLayout.vue',
        './src/layout/LayoutSidebar.vue',
        './src/layout/components/LayoutHeader.vue',
        './src/views/ops/OpsSummary.vue',
        './src/api/client.ts',
        './src/api/interceptors.ts',
      ],
    },
  },
  preview: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
      },
    },
  },
  }
})
