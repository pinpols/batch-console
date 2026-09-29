import { withMermaid } from 'vitepress-plugin-mermaid'
import { fileURLToPath, URL } from 'node:url'

/** 前端仓库托管的单站文档；构建时只读汇入配对后端 docs/。 */
export default withMermaid({
  srcDir: './content',
  base: '/docs/',

  title: '批量调度平台 文档中心',
  description: '产品使用指南 / 前端 / 后端 / 运维',
  lang: 'zh-CN',
  cleanUrls: true,

  // 两仓都以 README.md 作为目录入口，聚合后仍保留原有目录链接。
  rewrites: {
    'README.md': 'index.md',
    ':path(.*)/README.md': ':path/index.md',
  },

  // 后端文档体例不一,build 阶段死链先告警不阻断,P1 再逐条修
  ignoreDeadLinks: true,

  // 后端 .md 大量裸写 `CommonResponse<T>` / `<jwt>` / `Map<String, Object>` 这种
  // 类型/占位符,Vue 编译器会当成未闭合 HTML 标签报错。关掉 markdown 内嵌 HTML
  // 让 markdown-it 自动 escape 这类 `<` 字符;后端文档不需要嵌 HTML。
  markdown: {
    html: false,

    // 后端 markdown 里很多 link 用本机绝对路径或 ./README.md 形式,
    // 直接 build 出来在浏览器里点进去 100% 404。这里在 markdown-it 的 token
    // 渲染层做一次 link 重写,集中修三类问题:
    //
    //   1. ./README.md / ./xxx/README.md → ./ / ./xxx/
    //      vitepress rewrites 把每个目录的 README.md 输出为 index.md,
    //      所以 README 路径不存在,要去掉
    //   2. ./xxx.md / ./xxx.md#anchor → ./xxx / ./xxx#anchor
    //      cleanUrls=true 模式下后缀 .md 会 404,要剥掉
    //   3. /Users/dengchao/Downloads/file-batch-system/xxx.java(本机绝对路径)
    //      → https://github.com/pinpols/file-batch-system/blob/main/xxx.java
    //      浏览器没法读本机路径,转 GitHub 源码链接
    config(md) {
      const REPO_PREFIX = fileURLToPath(
        new URL('../../../../../file-batch-system/', import.meta.url),
      )
      const GITHUB_BASE = 'https://github.com/pinpols/file-batch-system/blob/main/'
      // batch-common / batch-console-api / batch-orchestrator / batch-worker-* / ...
      // 这些是 BE 项目模块,markdown 里裸写 batch-xxx/src/.../*.java 是想引源码,
      // 但浏览器解析为 docs URL 必 404,统一转 GitHub blob
      const MODULE_RE = /^(batch-[\w-]+)\/(src|pom\.xml)/

      function rewriteHref(href: string): string {
        if (!href || /^(https?:|mailto:|javascript:|#)/.test(href)) return href
        // 1. 本机绝对路径 → GitHub blob
        if (href.startsWith(REPO_PREFIX)) {
          const rel = href.slice(REPO_PREFIX.length)
          return GITHUB_BASE + rel
        }
        // 2. 项目模块相对路径 batch-xxx/src/... → GitHub blob
        if (MODULE_RE.test(href)) {
          // 砍掉行号:File.java:123 → File.java#L123
          const m = href.match(/^(.+\.\w+):(\d+)(.*)$/)
          if (m) return GITHUB_BASE + m[1] + '#L' + m[2] + m[3]
          return GITHUB_BASE + href
        }
        // 3. 拆 hash / query
        const hashIdx = href.search(/[#?]/)
        const path = hashIdx === -1 ? href : href.slice(0, hashIdx)
        const tail = hashIdx === -1 ? '' : href.slice(hashIdx)
        // 4. README.md / README → 目录根
        if (/(?:^|\/)README(\.md)?$/.test(path)) {
          return path.replace(/(?:^|\/)README(\.md)?$/, () => '/') + tail
        }
        // 5. 一般 .md 后缀 → cleanUrls 形式
        if (path.endsWith('.md')) {
          return path.slice(0, -3) + tail
        }
        return href
      }

      const orig =
        md.renderer.rules.link_open ||
        ((tokens: any, idx: number, opts: any, _env: any, self: any) =>
          self.renderToken(tokens, idx, opts))
      md.renderer.rules.link_open = (tokens: any, idx: number, opts: any, env: any, self: any) => {
        const token = tokens[idx]
        const hrefIdx = token.attrIndex('href')
        if (hrefIdx >= 0) {
          const old = token.attrs[hrefIdx][1]
          const next = rewriteHref(old)
          if (next !== old) token.attrs[hrefIdx][1] = next
        }
        return orig(tokens, idx, opts, env, self)
      }

      // 内联代码里的 {{ }}(如 GitHub Actions `${{ secrets.X }}`)会被 Vue 模板编译器当插值
      // 求值 → SSR build 崩(Cannot read properties of undefined)。给 <code> 注入 v-pre,
      // 让 Vue 跳过其内容编译,大括号原样渲染。一次性解决所有含 {{ }} 的内联代码。
      const origCodeInline =
        md.renderer.rules.code_inline ||
        ((tokens: any, idx: number) => `<code>${md.utils.escapeHtml(tokens[idx].content)}</code>`)
      md.renderer.rules.code_inline = (
        tokens: any,
        idx: number,
        opts: any,
        env: any,
        self: any,
      ) => {
        const html = origCodeInline(tokens, idx, opts, env, self)
        return html.replace(/^<code(?![^>]*\bv-pre\b)/, '<code v-pre')
      }
    },
  },

  // 聚合目录不是 Git 源目录，不能从它推断两仓的文档修改时间。
  lastUpdated: false,

  /**
   * 死链兜底:build 完成后扫所有 .html,把 /docs/ 内不存在的 a href 处理成两类:
   *   (1) 真实文件在 archive/ 下 → 改写指向 archive 路径(BE 文档 link 没跟上归档)
   *   (2) 真不存在的 → 改成 href="javascript:void(0)" + class="dead-link",
   *       浏览器不再跳 404 page
   *
   * 时机:vitepress 的 buildEnd 在 SSR 渲染完所有 .html 后触发(closeBundle
   * 时还没 render),才能扫到全量 .html
   */
  async buildEnd(siteConfig: { outDir: string }) {
    const { readdir, readFile, writeFile, stat } = await import('node:fs/promises')
    const { join, relative } = await import('node:path')
    const DIST = siteConfig.outDir
    const BASE = '/docs/'

    const real = new Set<string>()
    async function collect(dir: string) {
      for (const n of await readdir(dir)) {
        const p = join(dir, n)
        const s = await stat(p).catch(() => null)
        if (!s) continue
        if (s.isDirectory()) await collect(p)
        else {
          const rel = relative(DIST, p)
          const url = BASE + rel
          real.add(url)
          if (rel.endsWith('.html')) {
            real.add(url.replace(/index\.html$/, ''))
            real.add(url.replace(/\.html$/, ''))
            real.add(url.replace(/index\.html$/, '').replace(/\/$/, ''))
            if (rel === 'index.html') {
              real.add(BASE)
              real.add(BASE.replace(/\/$/, ''))
            }
          }
        }
      }
    }
    await collect(DIST)

    function exists(u: string): boolean {
      return (
        real.has(u) || real.has(u + '/') || real.has(u.replace(/\/$/, '')) || real.has(u + '.html')
      )
    }
    // 候选前缀:BE 把过期文件统一归档到 archive/<dir>/
    const PREFIXES = [
      '/docs/backend/archive',
      '/docs/backend/archive/architecture',
      '/docs/backend/archive/analysis',
      '/docs/frontend/archive',
    ]
    function findArchived(u: string): string | null {
      if (!u.startsWith(BASE)) return null
      const tail = u.slice(BASE.length - 1)
      for (const p of PREFIXES) {
        const cand = p + tail
        if (exists(cand)) return cand
        const stripped = tail.replace(/^\/[^/]+/, '')
        const cand2 = p + stripped
        if (exists(cand2) && stripped !== tail && stripped) return cand2
      }
      return null
    }

    let rewritten = 0
    let neutralized = 0
    const { resolve } = await import('node:path/posix')
    async function patch(dir: string) {
      for (const n of await readdir(dir)) {
        const p = join(dir, n)
        const s = await stat(p).catch(() => null)
        if (!s) continue
        if (s.isDirectory()) await patch(p)
        else if (n.endsWith('.html')) {
          // 当前 html 文件对应的绝对 URL,用来 resolve 相对 href
          // 例:dist/backend/architecture/adr/ADR-012.html → /docs/backend/architecture/adr/ADR-012.html
          const pageRel = relative(DIST, p)
          const pageUrl = BASE + pageRel
          const pageDirUrl = pageUrl.replace(/[^/]*$/, '')

          let html = await readFile(p, 'utf-8')
          let touched = false
          html = html.replace(
            /<a([^>]*?)href="([^"#?]*)([#?][^"]*)?"([^>]*)>/g,
            (m, pre, href, hash = '', post) => {
              if (!href) return m
              if (/^(https?:|mailto:|javascript:|#)/.test(href)) return m
              // 解析为绝对 URL
              let abs: string
              if (href.startsWith('/')) abs = href
              else abs = resolve(pageDirUrl, href)
              if (!abs.startsWith(BASE)) return m
              if (exists(abs)) return m
              const archived = findArchived(abs)
              if (archived) {
                touched = true
                rewritten++
                return `<a${pre}href="${archived}${hash}"${post}>`
              }
              touched = true
              neutralized++
              const cleaned =
                pre.replace(/\sclass="[^"]*"/g, '') + post.replace(/\sclass="[^"]*"/g, '')
              return `<a${cleaned} href="javascript:void(0)" class="dead-link" title="链接已失效:${abs}">`
            },
          )
          if (touched) await writeFile(p, html)
        }
      }
    }
    try {
      await patch(DIST)
      console.log(`[buildEnd:dead-links] rewritten=${rewritten} neutralized=${neutralized}`)
    } catch (e) {
      console.warn('[buildEnd:dead-links] skip:', (e as Error).message)
    }
  },

  // srcDir 在 batch-console 仓外(file-batch-system/docs/),Rollup 从那里 resolve
  // 不到本仓 node_modules 的 vue。显式 alias 避免 SSR build 时 vue/server-renderer
  // 解析失败。
  vite: {
    build: {
      // 文档站 Mermaid 动态图类按需加载；通用 chunk 预算由 docs:size 独立阻断。
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/cytoscape/')) return 'vendor-cytoscape'
            if (id.includes('/node_modules/katex/')) return 'vendor-katex'
          },
        },
      },
    },
    // 显式 root 锚定到统一文档桥目录，确保依赖解析稳定。
    root: fileURLToPath(new URL('..', import.meta.url)),
    // 跨仓 srcDir(file-batch-system/docs)编出的 .md 模块 import 'vue',Rollup 从 srcDir
    // 旁的 node_modules 找不到 → ENOENT build 失败。显式 alias 到本仓 node_modules,
    // dedupe 防 SSR build 出现两份 vue 运行时。
    resolve: {
      alias: {
        vue: fileURLToPath(new URL('../../../../node_modules/vue', import.meta.url)),
        'vue/server-renderer': fileURLToPath(
          new URL('../../../../node_modules/vue/server-renderer', import.meta.url),
        ),
        'vue-router': fileURLToPath(new URL('../../../../node_modules/vue-router', import.meta.url)),
      },
      dedupe: ['vue', 'vue-router'],
    },
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
      {
        // vitepress 默认只 emit .md → .html,不会拷 srcDir 下的 .yaml/.json/.sql 等
        // 但 BE 文档 link 真有指向这些文件(api/console-api.openapi.yaml /
        // compliance/sbom.json),不拷会 404。在 build 完成时把整个 srcDir 下的
        // 静态资源(白名单后缀)mirror 到 dist 对应路径
        name: 'docs-static-assets-mirror',
        async closeBundle() {
          const { readdir, mkdir, copyFile, stat } = await import('node:fs/promises')
          const { join, relative, dirname } = await import('node:path')
          const SRC = fileURLToPath(new URL('../content', import.meta.url))
          const DIST = fileURLToPath(new URL('../.vitepress/dist', import.meta.url))
          const ALLOWED = /\.(ya?ml|json|sql|csv|txt|svg|png|jpe?g|gif|pdf)$/i
          let copied = 0
          async function walk(dir: string) {
            for (const name of await readdir(dir)) {
              if (name.startsWith('.') || name === 'node_modules') continue
              const p = join(dir, name)
              const s = await stat(p).catch(() => null)
              if (!s) continue
              if (s.isDirectory()) await walk(p)
              else if (ALLOWED.test(name)) {
                const rel = relative(SRC, p)
                const target = join(DIST, rel)
                await mkdir(dirname(target), { recursive: true })
                await copyFile(p, target)
                copied++
              }
            }
          }
          try {
            await walk(SRC)
            console.log(`[docs-static-assets-mirror] copied ${copied} files`)
          } catch (e) {
            console.warn('[docs-static-assets-mirror] skip:', (e as Error).message)
          }
        },
      },
    ],
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

    nav: [
      { text: '首页', link: '/' },
      { text: '使用指南', link: '/frontend/user-guide/' },
      {
        text: '前端',
        items: [
          { text: '前端文档索引', link: '/frontend/' },
          { text: '前端架构', link: '/frontend/architecture/project-structure' },
          { text: '前端运维', link: '/frontend/runbook/' },
          { text: '前端设计', link: '/frontend/redesign/' },
        ],
      },
      {
        text: '后端',
        items: [
          { text: '后端文档索引', link: '/backend/' },
          { text: '架构', link: '/backend/architecture/' },
          { text: 'ADR', link: '/backend/architecture/adr/' },
          { text: '运维', link: '/backend/runbook/' },
          { text: 'API', link: '/backend/api/' },
          { text: '设计', link: '/backend/design/' },
        ],
      },
    ],

    sidebar: {
      '/frontend/user-guide/': [
        {
          text: '产品使用指南',
          items: [
            { text: '指南首页', link: '/frontend/user-guide/' },
            { text: '角色与权限', link: '/frontend/user-guide/roles-and-access' },
            { text: '快速入门', link: '/frontend/user-guide/getting-started' },
            { text: '作业与流程', link: '/frontend/user-guide/jobs-and-workflows' },
            { text: '运行与审批', link: '/frontend/user-guide/runs-and-approvals' },
            { text: '文件与配置导入', link: '/frontend/user-guide/files-and-imports' },
            { text: '可观测性与排障', link: '/frontend/user-guide/observability' },
            { text: '平台治理', link: '/frontend/user-guide/platform-governance' },
            { text: '常见问题', link: '/frontend/user-guide/troubleshooting' },
          ],
        },
      ],
    },

    editLink: {
      pattern: ({ relativePath }) => {
        if (relativePath.startsWith('frontend/')) {
          return `https://github.com/pinpols/batch-console/edit/main/docs/${relativePath.slice('frontend/'.length)}`
        }
        if (relativePath === 'README.md') {
          return 'https://github.com/pinpols/batch-console/edit/main/docs/README.md'
        }
        const path = relativePath.startsWith('backend/')
          ? relativePath.slice('backend/'.length)
          : relativePath
        return `https://github.com/pinpols/file-batch-system/edit/main/docs/${path}`
      },
      text: '在 GitHub 上编辑此页',
    },

    // GitHub 图标隐藏 — 内部文档站,无需对外引流
    // socialLinks: [
    //   { icon: 'github', link: 'https://github.com/pinpols/file-batch-system' },
    // ],

    search: {
      provider: 'local',
      options: {
        // 历史归档和阶段计划体量大且时效性低，不进入浏览器全文索引。
        // 页面仍可正常访问，当前架构、设计、API 与运维文档保留全文搜索。
        _render(
          mdSource: string,
          env: { relativePath?: string },
          md: { render: (source: string, renderEnv?: { relativePath?: string }) => string },
        ) {
          const path = env.relativePath || ''
          if (/^(backend\/(?:analysis|archive|audit|backlog|compliance|plans|qa|review|sdk|spike|stats|test-data|testing|verifications)|frontend\/(?:archive|reports|redesign|verifications))\//.test(path)) {
            return ''
          }
          if (path.startsWith('frontend/') && !path.startsWith('frontend/user-guide/')) {
            const headings = mdSource
              .split('\n')
              .filter((line) => /^#{1,3}\s+/.test(line))
              .join('\n')
            return md.render(headings, env)
          }
          // ADR 数量多且正文较长，搜索只保留标题层级；页面正文仍完整构建和访问。
          // 决策编号、主题和章节可搜索，同时避免把整套历史决策装入浏览器索引。
          if (path.startsWith('backend/architecture/adr/')) {
            const headings = mdSource
              .split('\n')
              .filter((line) => /^#{1,3}\s+/.test(line))
              .join('\n')
            return md.render(headings, env)
          }
          return md.render(mdSource, env)
        },
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
