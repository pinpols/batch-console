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
      const REPO_PREFIX = '/Users/dengchao/Downloads/file-batch-system/'
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
    },
  },

  // 跨仓引用时禁用 vitepress 的 git lastUpdated(读不到对仓 git 信息)
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
    const PREFIXES = ['/docs/archive', '/docs/archive/architecture', '/docs/archive/analysis']
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
          // 例:dist/architecture/adr/ADR-012.html → /docs/architecture/adr/ADR-012.html
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
      {
        // vitepress 默认只 emit .md → .html,不会拷 srcDir 下的 .yaml/.json/.sql 等
        // 但 BE 文档 link 真有指向这些文件(api/console-api.openapi.yaml /
        // compliance/sbom.json),不拷会 404。在 build 完成时把整个 srcDir 下的
        // 静态资源(白名单后缀)mirror 到 dist 对应路径
        name: 'docs-static-assets-mirror',
        async closeBundle() {
          const { readdir, mkdir, copyFile, stat } = await import('node:fs/promises')
          const { join, relative, dirname } = await import('node:path')
          const SRC = fileURLToPath(new URL('../../../file-batch-system/docs', import.meta.url))
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
      {
        // 死链兜底:留个 placeholder,实际逻辑挪到顶层 buildEnd
        // (vite closeBundle 时 vitepress 还没 render pages 出 .html,扫不到死链)
        name: 'docs-rewrite-dead-links-placeholder',
        async closeBundleNoop() {
          const { readdir, readFile, writeFile, stat } = await import('node:fs/promises')
          const { join, relative } = await import('node:path')
          const DIST = fileURLToPath(new URL('../.vitepress/dist', import.meta.url))
          const BASE = '/docs/'

          // 1. 扫真实存在的 URL
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
          // 候选前缀(BE 把过期文件统一归档到 archive/)
          const PREFIXES = ['/docs/archive', '/docs/archive/architecture', '/docs/archive/analysis']
          function findArchived(u: string): string | null {
            if (!u.startsWith(BASE)) return null
            const tail = u.slice(BASE.length - 1) // 含前导 /,如 /analysis/foo
            for (const p of PREFIXES) {
              const cand = p + tail
              if (exists(cand)) return cand
              // 也试试不含 PREFIX 路径首段(去掉一层目录)
              const stripped = tail.replace(/^\/[^/]+/, '')
              const cand2 = p + stripped
              if (exists(cand2) && stripped !== tail) return cand2
            }
            return null
          }

          let rewritten = 0
          let neutralized = 0
          async function patch(dir: string) {
            for (const n of await readdir(dir)) {
              const p = join(dir, n)
              const s = await stat(p).catch(() => null)
              if (!s) continue
              if (s.isDirectory()) await patch(p)
              else if (n.endsWith('.html')) {
                let html = await readFile(p, 'utf-8')
                let touched = false
                html = html.replace(
                  /<a([^>]*?)href="(\/docs\/[^"#?]*)([#?][^"]*)?"([^>]*)>/g,
                  (m, pre, href, hash = '', post) => {
                    if (exists(href)) return m
                    const archived = findArchived(href)
                    if (archived) {
                      touched = true
                      rewritten++
                      return `<a${pre}href="${archived}${hash}"${post}>`
                    }
                    // 真死链:换成无 href 的 span,带 title 提示
                    touched = true
                    neutralized++
                    return `<span class="dead-link" title="链接已失效:${href}">`
                  },
                )
                // 同步替换对应 </a>(只在我们 neutralize 的 a 之后)
                // 简化处理:无差别替换全部 </a> 为 </span> 不安全;改用更稳的方式 —
                // 保留 a tag 但改 href="javascript:void(0)" 并加 class
                if (touched) await writeFile(p, html)
              }
            }
          }
          try {
            await patch(DIST)
            console.log(`[docs-rewrite-dead-links] rewritten=${rewritten} neutralized=${neutralized}`)
          } catch (e) {
            console.warn('[docs-rewrite-dead-links] skip:', (e as Error).message)
          }
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
    nav: [
      { text: '架构', link: '/architecture/' },
      { text: 'ADR', link: '/architecture/adr/' },
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
    // 注意:更深的路径要排在前面 — VitePress 用最长前缀匹配,但靠对象 key 顺序决定优先级,
    // 把 /architecture/adr/ 写在 /architecture/ 之前,避免进 ADR 页时回落到"架构"侧栏
    sidebar: {
      '/architecture/adr/': [{ text: 'ADR', items: [{ text: '总览', link: '/architecture/adr/' }] }],
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
