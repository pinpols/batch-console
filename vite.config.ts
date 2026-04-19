import { defineConfig, loadEnv } from 'vite'
import type { UserConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
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
        manualChunks: {
          'vendor-element-plus': ['element-plus', '@element-plus/icons-vue'],
          'vendor-echarts': ['echarts', 'vue-echarts'],
          'vendor-x6': ['@antv/x6'],
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
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
    proxy: {
      '/api': {
        target: devProxyTarget,
        changeOrigin: true,
      },
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
  }
})
