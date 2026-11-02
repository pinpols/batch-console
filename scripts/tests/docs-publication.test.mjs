import test from 'node:test'
import assert from 'node:assert/strict'
import { createMarkdownRenderer } from 'vitepress'
import { paginateEvidence, rewritePublicationAnchor } from '../lib/docs-publication.mjs'
import { publicationRedirect } from '../../tools/docs-bridge/frontend/.vitepress/theme/publicationNavigation.mjs'

test('完整分卷保留原始正文、重复与自定义锚点，不拆代码块和列表项', async () => {
  const source =
    '# 记录\n\n## 重复\n\n' +
    '- [用户指南](../user-guide/README.md)\n'.repeat(12) +
    '\n```md\n## 围栏内的伪标题\n```\n\n## 重复\n\n[回到前文](#重复)\n\n## 固定 {#stable}\n\n结束。\n'
  const result = await paginateEvidence(source, 'audit/example.md', 180)
  assert.ok(result.parts.length > 1)
  assert.equal(result.parts.map((part) => part.source).join(''), source)
  assert.deepEqual(
    result.headings.map((h) => h.id),
    ['记录', '重复', '重复-1', 'stable'],
  )
  assert.ok(result.parts.some((part) => part.markdown.includes('```md\n## 围栏内的伪标题\n```')))
  assert.ok(result.parts.every((part) => Buffer.byteLength(part.source) <= 180))
  assert.ok(result.parts.every((part) => part.markdown.includes('[完整目录](./example.md)')))
  const md = await createMarkdownRenderer(process.cwd())
  const actual = result.parts.flatMap((part) =>
    md
      .parse(part.markdown.replace(/^---\n[\s\S]*?\n---\n/, ''), { relativePath: part.name })
      .filter((t) => t.type === 'heading_open')
      .map((t) => t.attrGet('id')),
  )
  assert.deepEqual(actual, ['记录', '重复', '重复-1', 'stable'])
  assert.equal(result.index.includes('<script'), false)
  assert.equal(result.index.includes('<span'), false)
  const metadata = JSON.parse(/^publicationRedirects: (.*)$/m.exec(result.index)[1])
  assert.deepEqual(metadata, result.destinations)
  assert.ok(
    result.destinations.every(([id, page]) =>
      result.parts.some((part) => part.name === `${page}.md` && part.markdown.includes(`{#${id}}`)),
    ),
  )
})

test('有序列表作为完整块保留，不能安全拆开的超大块失败关闭', async () => {
  const source = '# 记录\n\n1. 第一项\n2. 第二项\n\n## 后文\n\n更多。\n'
  const result = await paginateEvidence(source, 'plans/ordered.md', 50)
  assert.ok(result.parts.some((part) => part.markdown.includes('1. 第一项\n2. 第二项')))
  await assert.rejects(
    paginateEvidence('# 标题\n\n' + '长段落'.repeat(80), 'audit/large.md', 60),
    /不可拆分Markdown块/,
  )
  await assert.rejects(
    paginateEvidence('# 标题\n\n<details>\n\n内容\n\n</details>', 'audit/html.md'),
    /HTML容器/,
  )
  await assert.rejects(
    paginateEvidence('# 标题\n\n[文本][ref]\n\n[ref]: ../guide.md', 'audit/ref.md'),
    /引用式链接/,
  )
})

test('分卷只重定向本文锚点，保留图片、相对文档和外链', () => {
  assert.equal(
    rewritePublicationAnchor('backend/audit/example.part-002.md', '#重复-1'),
    './example.md#重复-1',
  )
  for (const href of ['../runbook/README.md#setup', 'https://example.test/#x', './image.png'])
    assert.equal(rewritePublicationAnchor('backend/audit/example.part-002.md', href), href)
  assert.equal(rewritePublicationAnchor('backend/audit/example.md', '#x'), '#x')
})

test('主题从原文旧锚点定位本卷，保留查询参数并拒绝外部或跨文档目的地', () => {
  const hash = '#%E9%87%8D%E5%A4%8D-1'
  assert.equal(
    publicationRedirect(
      [['重复-1', 'example.part-002']],
      '/docs/backend/audit/example',
      hash,
      '?theme=dark',
    ),
    `./example.part-002?theme=dark${hash}`,
  )
  for (const target of [
    'https://example.test/',
    '../example.part-002',
    'other.part-002',
    'example.part-002/../../x',
  ])
    assert.equal(
      publicationRedirect([['重复-1', target]], '/docs/backend/audit/example', hash),
      null,
    )
  assert.equal(
    publicationRedirect([['重复-1', 'example.part-002']], '/docs/backend/audit/example', '#%zz'),
    null,
  )
})

test('架构图发布页提取当前 Markdown 图并链接到原章节，忽略其他代码块', async () => {
  const { renderDiagramPage } = await import('../lib/docs-diagrams.mjs')
  const source =
    '# 源文\n\n## 运行主链\n\n```text\n不属于图\n```\n\n```mermaid\nflowchart LR\n A-->B\n```\n\n## 运行主链\n\n**租户执行边界**\n\n```mermaid\nsequenceDiagram\n A->>B: OK\n```\n'
  const output = await renderDiagramPage(
    { title: '模块结构', path: 'architecture/project-structure.md' },
    source,
  )
  assert.match(
    output,
    /\.\.\/backend\/architecture\/project-structure\.md#%E8%BF%90%E8%A1%8C%E4%B8%BB%E9%93%BE/,
  )
  assert.match(output, /%E8%BF%90%E8%A1%8C%E4%B8%BB%E9%93%BE-1/)
  assert.match(output, /flowchart LR\n A-->B/)
  assert.match(output, /sequenceDiagram\n A->>B: OK/)
  assert.match(output, /图 2 · 租户执行边界/)
  assert.match(output, /\[架构图导览\]\(\.\/README\.md\)/)
  assert.doesNotMatch(output, /不属于图/)
  assert.doesNotMatch(output, /<script/)
})

test('架构图发布页的源文没有图时明确失败，避免生成空页面', async () => {
  const { renderDiagramPage } = await import('../lib/docs-diagrams.mjs')
  await assert.rejects(
    renderDiagramPage({ title: '缺图', path: 'architecture/empty.md' }, '# 没有图\n'),
    /没有 Mermaid 图/,
  )
})

test('架构图目录按源文标题生成可跳转链接，重复标题也对应各自图', async () => {
  const { renderDiagramPage } = await import('../lib/docs-diagrams.mjs')
  const source =
    '# 源文\n\n## 相同标题\n\n```mermaid\nflowchart LR\n A-->B\n```\n\n' +
    '## 相同标题\n\n```mermaid\nflowchart LR\n C-->D\n```\n\n' +
    '## PROCESS 和 ATOMIC\n\n```mermaid\nflowchart LR\n E-->F\n```\n'
  const page = await renderDiagramPage({ title: '整体流程', path: 'architecture/flows.md' }, source)
  const md = await createMarkdownRenderer(process.cwd())
  const tokens = md.parse(page.replace(/^---\n[\s\S]*?\n---\n/, ''), {
    relativePath: 'architecture-diagrams/flows.md',
  })
  const links = tokens
    .filter((token) => token.type === 'inline')
    .flatMap((token) => token.children || [])
    .filter((token) => token.type === 'link_open' && token.attrGet('class') !== 'header-anchor')
    .map((token) => token.attrGet('href'))
    .filter((href) => href?.startsWith('#'))
    .map((href) => decodeURIComponent(href.slice(1)))
  const headings = tokens
    .filter((token) => token.type === 'heading_open' && token.tag === 'h2')
    .map((token) => token.attrGet('id'))
  assert.equal(links.length, 3)
  assert.deepEqual(links, headings)
  assert.equal(new Set(headings).size, 3)
  assert.match(page, /\[图 3 · PROCESS 和 ATOMIC\]\(#/)
})

test('架构图随每次生成读取最新源文，缺失源文时报错', async () => {
  const { mkdtemp, mkdir, readFile, rm, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { writeDiagramPages } = await import('../lib/docs-diagrams.mjs')
  const root = await mkdtemp(join(tmpdir(), 'docs-diagrams-test-'))
  const sourceDir = join(root, 'backend')
  const targetDir = join(root, 'site')
  const topic = { slug: 'example', title: '示例', path: 'architecture/a.md' }
  try {
    await mkdir(join(sourceDir, 'architecture'), { recursive: true })
    await assert.rejects(writeDiagramPages(sourceDir, targetDir, [topic]), /ENOENT/)
    const path = join(sourceDir, topic.path)
    await writeFile(path, '# 图\n\n## 原标题\n\n```mermaid\nflowchart LR\n A-->B\n```\n')
    await writeDiagramPages(sourceDir, targetDir, [topic])
    assert.match(await readFile(join(targetDir, 'example.md'), 'utf8'), /A-->B/)
    await writeFile(path, '# 图\n\n## 新标题\n\n```mermaid\nflowchart LR\n A-->C\n```\n')
    await writeDiagramPages(sourceDir, targetDir, [topic])
    const updated = await readFile(join(targetDir, 'example.md'), 'utf8')
    assert.match(updated, /A-->C/)
    assert.doesNotMatch(updated, /A-->B/)
    assert.match(updated, /\[图 1 · 新标题\]\(#/)
    assert.doesNotMatch(updated, /原标题/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('架构图生成页和目录不显示指向不存在文件的编辑入口', async () => {
  const { renderDiagramPage, renderDiagramIndex } = await import('../lib/docs-diagrams.mjs')
  const page = await renderDiagramPage(
    { title: '模块结构', path: 'architecture/project-structure.md' },
    '# 源文\n\n```mermaid\nflowchart LR\n A-->B\n```\n',
  )
  assert.match(renderDiagramIndex(), /^---\neditLink: false\n---\n/)
  assert.match(page, /^---\neditLink: false\n---\n/)
  assert.match(page, /\.\.\/backend\/architecture\/project-structure\.md#/)
})
