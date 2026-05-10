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
    resolve: {
      alias: {
        vue: fileURLToPath(new URL('../../node_modules/vue', import.meta.url)),
        'vue/server-renderer': fileURLToPath(
          new URL('../../node_modules/vue/server-renderer/index.mjs', import.meta.url),
        ),
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

    // 顶部导航按一级目录分组(对应文档原始目录)
    nav: [
      { text: '架构', link: '/architecture/' },
      { text: 'ADR', link: '/architecture/adrs' },
      { text: '设计', link: '/design/' },
      { text: '运维', link: '/runbook/' },
      { text: '规范', link: '/coding-conventions' },
      { text: 'API', link: '/api/' },
      { text: '更多', items: [
        { text: '分析(analysis)', link: '/analysis/' },
        { text: '合规(compliance)', link: '/compliance/' },
        { text: '字典(dict)', link: '/dict/' },
        { text: '测试(testing)', link: '/testing/' },
        { text: '归档(archive)', link: '/archive/' },
      ] },
    ],

    // 侧边栏按一级目录组装,每个分类取目录第一篇做入口
    // VitePress 自动 lazy 渲染,不读 srcDir 也不影响 nav 跳转
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
