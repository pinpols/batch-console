import { withMermaid } from 'vitepress-plugin-mermaid'
import { fileURLToPath, URL } from 'node:url'

/**
 * 内嵌文档中心 VitePress 配置(P0 MVP)。
 *
 * - srcDir 跨仓引用 `../file-batch-system/docs`(不复制、不 submodule)
 * - base '/docs/' 对齐 nginx `location /docs/`
 * - dev:`npm run docs:dev` → http://localhost:5174/docs/
 * - build:产物 → `dist-docs/`,nginx alias 指过去
 *
 * 设计文档:`docs/design/内嵌文档中心方案.md`
 * 后端契约:`GET /api/console/auth/check`(204/401)
 */
export default withMermaid({
  // 跨仓 srcDir:相对 .vitepress/ 上推两级到 batch-console/,再 ../ 到 Downloads/,
  // 然后到 file-batch-system/docs。本地约束:两仓必须放同一父目录(AGENTS.md)。
  srcDir: '../../file-batch-system/docs',
  // outDir 默认在 docs-site/.vitepress/dist;不绕到外层防止 rollup 跨包resolve 异常
  base: '/docs/',

  title: '批量调度平台 文档中心',
  description: 'ADR / 架构 / 运维 / 操作手册',
  lang: 'zh-CN',
  cleanUrls: true,

  // 后端文档根目录是 README.md(GitHub 习惯)而非 VitePress 默认的 index.md。
  // rewrite 让 /docs/ 的入口直接命中 README.md,避免 root 路径 404。
  // 同时各子目录 README.md 也映射到目录根,跟 GitHub 浏览体验一致。
  rewrites: {
    'README.md': 'index.md',
    ':dir/README.md': ':dir/index.md',
    ':parent/:dir/README.md': ':parent/:dir/index.md',
  },

  // 后端文档体例不一,build 阶段死链先告警不阻断,P1 再逐条修
  ignoreDeadLinks: true,

  // 后端 .md 大量裸写 `CommonResponse<T>` / `<jwt>` / `Map<String, Object>` 这种
  // 类型/占位符,Vue 编译器会当成未闭合 HTML 标签报错。关掉 markdown 内嵌 HTML
  // 让 markdown-it 自动 escape 这类 `<` 字符;后端文档不需要嵌 HTML。
  markdown: {
    html: false,
  },

  // 跨仓引用时禁用 vitepress 的 git lastUpdated(读不到对仓 git 信息)
  lastUpdated: false,

  // srcDir 在 batch-console 仓外(file-batch-system/docs/),Rollup 从那里 resolve
  // 不到本仓 node_modules 的 vue。显式 alias 避免 SSR build 时 vue/server-renderer
  // 解析失败。
  vite: {
    // 跨仓 srcDir 时,Vite 的 root 默认会跑去 srcDir(file-batch-system/docs/),
    // 那边没 node_modules,导致 optimizeDeps 找不到 vitepress 子依赖 → dev 白屏。
    // 显式 root 锚定到 docs-site/.vitepress 同级,确保依赖解析正确。
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [
      {
        // base 是 /docs/,vitepress dev server 严格要求尾斜杠 → /docs(无斜杠) 直接 404
        // 这里在 vite 的 connect middleware 链路上拦截一次,302 跳到 /docs/
        name: 'docs-base-trailing-slash-redirect',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/docs') {
              res.statusCode = 302
              res.setHeader('Location', '/docs/')
              res.end()
              return
            }
            next()
          })
        },
      },
    ],
    resolve: {
      // 跨仓 srcDir 下,Rollup 从 markdown 文件位置(file-batch-system/docs/...)
      // 反向解析 vue / vue/server-renderer 找不到本仓 node_modules。
      // 显式 alias 保 build 不挂(dev 走 root 已 OK)。
      // alias 指 vue 包目录(含 package.json),让 import 'vue' / 'vue/server-renderer'
      // / 'vue/jsx-runtime' 等 sub-path 都走 vue 自己的 exports map 解析。
      // 别 alias 到具体 entry 文件(否则 sub-path 会拼成 <file>/server-renderer 报错)。
      alias: {
        vue: fileURLToPath(new URL('../../node_modules/vue', import.meta.url)),
      },
    },
  },

  themeConfig: {
    siteTitle: '批量调度平台 · 文档',
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '语言',
    externalLinkIcon: true,

    // 顶部导航 — 按 build 产物 URL 写
    // rewrites 把每个目录的 README.md 重命名输出为 index.md,所以子目录入口 = /xxx/
    // ADR 在 architecture/adr/ 目录,目前没 README.md → 跳第一篇 ADR-001
    nav: [
      { text: '架构', link: '/architecture/' },
      { text: 'ADR', link: '/architecture/adr/ADR-001-dual-orm' },
      { text: '设计', link: '/design/' },
      { text: '运维', link: '/runbook/' },
      { text: '规范', link: '/coding-conventions' },
      { text: 'API', link: '/api/' },
      {
        text: '更多',
        items: [
          { text: '分析(analysis)', link: '/analysis/' },
          { text: '合规(compliance)', link: '/compliance/' },
          { text: '字典(dict)', link: '/dict/' },
          { text: '测试(testing)', link: '/testing/' },
          { text: '归档(archive)', link: '/archive/' },
        ],
      },
    ],

    // 侧边栏按一级目录组装,每个分类指向其根入口(rewrites 后的 index.md)
    sidebar: {
      '/architecture/': [{ text: '架构', items: [{ text: '总览', link: '/architecture/' }] }],
      '/design/': [{ text: '设计', items: [{ text: '总览', link: '/design/' }] }],
      '/runbook/': [{ text: '运维', items: [{ text: '总览', link: '/runbook/' }] }],
      '/api/': [{ text: 'API', items: [{ text: '总览', link: '/api/' }] }],
      '/analysis/': [{ text: '分析', items: [{ text: '总览', link: '/analysis/' }] }],
      '/compliance/': [{ text: '合规', items: [{ text: '总览', link: '/compliance/' }] }],
      '/dict/': [{ text: '字典', items: [{ text: '总览', link: '/dict/' }] }],
      '/testing/': [{ text: '测试', items: [{ text: '总览', link: '/testing/' }] }],
      '/archive/': [{ text: '归档', items: [{ text: '总览', link: '/archive/' }] }],
    },

    editLink: {
      pattern: 'https://github.com/pinpols/file-batch-system/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/pinpols/file-batch-system' },
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            displayDetails: '显示详细列表',
            resetButtonTitle: '清除查询条件',
            backButtonTitle: '关闭搜索',
            noResultsText: '无相关结果',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭',
            },
          },
        },
      },
    },
  },
})
