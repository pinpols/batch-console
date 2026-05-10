import { defineConfig } from 'vitepress'

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
export default defineConfig({
  // 跨仓 srcDir:相对 .vitepress/ 上推两级到 batch-console/,再 ../ 到 Downloads/,
  // 然后到 file-batch-system/docs。本地约束:两仓必须放同一父目录(AGENTS.md)。
  srcDir: '../../file-batch-system/docs',
  outDir: '../../batch-console/dist-docs',
  base: '/docs/',
  cacheDir: '../../batch-console/node_modules/.vitepress',

  title: '批量调度平台 文档中心',
  description: 'ADR / 架构 / 运维 / 操作手册',
  lang: 'zh-CN',
  cleanUrls: true,

  // 后端文档体例不一,build 阶段死链先告警不阻断,P1 再逐条修
  ignoreDeadLinks: true,

  // 跨仓引用时禁用 vitepress 的 git lastUpdated(读不到对仓 git 信息)
  lastUpdated: false,

  themeConfig: {
    siteTitle: '批量调度平台 · 文档',
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    darkModeSwitchLabel: '主题',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    langMenuLabel: '语言',
    externalLinkIcon: true,

    // P1 阶段细化分组;P0 先空,VitePress 自动从目录推导
    sidebar: {},

    // P1 阶段配 editLink 跳后端仓 GitHub;现在不知道仓路径,留空
    editLink: undefined,

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
