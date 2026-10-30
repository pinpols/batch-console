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
