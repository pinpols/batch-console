import { withMermaid } from 'vitepress-plugin-mermaid'

/**
 * 前端文档站 — 跨仓只看本 batch-console/docs/ 目录。
 * 跟 backend/ 区别(都在 tools/docs-bridge/ 下):
 *   - backend/  srcDir → ../../../../file-batch-system/docs (BE 主仓)   端口 5174 /docs/
 *   - frontend/ srcDir → ../../../docs (本 FE 仓自身 docs/)             端口 5175 /fe-docs/
 */
export default withMermaid({
  srcDir: '../../../docs',
  base: '/fe-docs/',
  title: '批量调度前端 文档',
  description: 'batch-console 前端方案 / 设计 / 阶段联调报告',
  lang: 'zh-CN',
  cleanUrls: true,
  // 本仓 docs/ 大量交叉链接到 ../file-batch-system/、GitHub 路径,本地构建无法解析。
  // build 不阻断,运行时 nav 仍可点;真坏链由 CI 单独检查。
  ignoreDeadLinks: true,

  // README.md 作为目录入口(GitHub 习惯,不是 vitepress 默认的 index.md)
  rewrites: {
    'README.md': 'index.md',
    ':path(.*)/README.md': ':path/index.md',
  },

  themeConfig: {
    nav: [
      { text: '主页', link: '/' },
      { text: 'QA 阶段报告', link: '/runbook/qa-d-phase-reports/' },
      { text: '运维', link: '/runbook/' },
      { text: '设计', link: '/design/' },
      { text: 'API', link: '/api/' },
      // 后端独立文档站 — 互链统一入口
      {
        text: '后端文档 ↗',
        items: [
          { text: '后端首页', link: 'http://localhost:5174/docs/' },
          { text: '架构', link: 'http://localhost:5174/docs/architecture/' },
          { text: 'ADR', link: 'http://localhost:5174/docs/architecture/adr/' },
          { text: '设计', link: 'http://localhost:5174/docs/design/' },
          { text: '运维', link: 'http://localhost:5174/docs/runbook/' },
          { text: 'API', link: 'http://localhost:5174/docs/api/' },
        ],
      },
    ],
    // sidebar 走 vitepress 默认(不强配),保持简洁
  },
})
