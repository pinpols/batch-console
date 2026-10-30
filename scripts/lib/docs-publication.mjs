import { createHash } from 'node:crypto'
import { basename } from 'node:path'
import { createMarkdownRenderer } from 'vitepress'

/** 发布副本按完整Markdown块分卷；source保留原始字节，用于证明没有遗漏或重复正文。 */
export async function paginateEvidence(source, relativePath, maxSourceBytes = 140_000) {
  if (source.startsWith('---\n') || source.startsWith('---\r\n')) {
    throw new Error(`分卷暂不处理带frontmatter的记录：${relativePath}`)
  }
  const file = basename(relativePath)
  if (!/^[\w.-]+\.md$/.test(file)) throw new Error(`不支持的分卷文件名：${relativePath}`)
  const md = await createMarkdownRenderer(process.cwd())
  const env = { relativePath }
  const tokens = md.parse(source, env)
  if (Object.keys(env.references ?? {}).length) {
    throw new Error(`分卷暂不处理跨卷引用式链接：${relativePath}`)
  }
  if (
    tokens.some((token) => token.type === 'html_block' && !token.content.trim().startsWith('<!--'))
  ) {
    throw new Error(`不能安全拆开HTML容器：${relativePath}`)
  }
  const lines = source.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const headings = tokens.flatMap((token, index) => {
    if (token.type !== 'heading_open' || token.level !== 0 || !token.map) return []
    const id = token.attrGet('id')
    if (!id || /[\s{}"<>]/.test(id)) throw new Error(`无效的章节锚点：${relativePath}`)
    return [
      {
        line: token.map[0],
        id,
        label: tokens[index + 1]?.content ?? '',
        level: Number(token.tag[1]),
      },
    ]
  })
  if (!headings.length) throw new Error(`记录没有可导航标题：${relativePath}`)
  const boundaries = new Set([0, lines.length])
  let topLevelBulletList = false
  for (const token of tokens) {
    if (token.type === 'bullet_list_open' && token.level === 0) topLevelBulletList = true
    if (token.type === 'bullet_list_close' && token.level === 0) topLevelBulletList = false
    if (
      token.map &&
      (token.level === 0 ||
        (topLevelBulletList && token.type === 'list_item_open' && token.level === 1))
    ) {
      boundaries.add(token.map[0])
    }
  }
  // 标题与其后的第一个正文块放在一起，避免卷尾只留下一个空标题。
  const headerLines = new Set(headings.map((heading) => heading.line))
  const candidates = [...boundaries].sort((a, b) => a - b)
  for (const heading of headings) {
    const next = candidates.find((line) => line > heading.line)
    if (next !== undefined && next !== lines.length && !headerLines.has(next))
      boundaries.delete(next)
  }
  const points = [...boundaries].sort((a, b) => a - b)
  const ranges = []
  let start = 0
  let bytes = 0
  for (let i = 0; i < points.length - 1; i++) {
    const unitBytes = Buffer.byteLength(lines.slice(points[i], points[i + 1]).join(''))
    if (unitBytes > maxSourceBytes)
      throw new Error(`不可拆分Markdown块超过分卷上限：${relativePath}:${points[i] + 1}`)
    if (bytes && bytes + unitBytes > maxSourceBytes) {
      ranges.push([start, points[i]])
      start = points[i]
      bytes = 0
    }
    bytes += unitBytes
  }
  ranges.push([start, lines.length])
  const base = file.slice(0, -3)
  const partNames = ranges.map((_, i) => `${base}.part-${String(i + 1).padStart(3, '0')}.md`)
  const title = headings[0].label.replace(/\s+\{#[^}]+\}\s*$/, '')
  const sourceSha256 = createHash('sha256').update(source).digest('hex')
  const parts = ranges.map(([from, to], index) => {
    const raw = lines.slice(from, to)
    const annotated = [...raw]
    for (const heading of headings.filter((h) => h.line >= from && h.line < to)) {
      const at = heading.line - from
      const ending = /\r?\n$/.exec(annotated[at])?.[0] ?? ''
      const text = ending ? annotated[at].slice(0, -ending.length) : annotated[at]
      if (/\{#[^}]+\}/.test(text)) continue
      const closing = /[\t ]+#+[\t ]*$/.exec(text)
      annotated[at] = closing
        ? `${text.slice(0, closing.index)} {#${heading.id}}${closing[0]}${ending}`
        : `${text} {#${heading.id}}${ending}`
    }
    const navigation = [
      `[完整目录](./${file})`,
      index ? `[上一卷](./${partNames[index - 1]})` : '',
      index + 1 < ranges.length ? `[下一卷](./${partNames[index + 1]})` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    const markdown = `---\ntitle: ${JSON.stringify(`${title}（第${index + 1}/${ranges.length}卷）`)}\n---\n\n${navigation}\n\n> 发布分卷 ${index + 1}/${ranges.length}，对应原文第 ${from + 1}–${to} 行；权威原文保持不变。\n\n${annotated.join('')}\n`
    return {
      name: partNames[index],
      source: raw.join(''),
      markdown,
      fromLine: from + 1,
      toLine: to,
    }
  })
  if (parts.map((part) => part.source).join('') !== source)
    throw new Error(`分卷正文校验失败：${relativePath}`)
  const destinations = headings.map((heading) => {
    const index = ranges.findIndex(([from, to]) => heading.line >= from && heading.line < to)
    return [heading.id, partNames[index].replace(/\.md$/, '')]
  })
  const escapeLabel = (value) => value.replace(/[\[\]\\]/g, '\\$&')
  const links = headings
    .map((heading, i) => {
      const target = `${destinations[i][1]}#${encodeURIComponent(heading.id)}`
      const label = heading.label.replace(/\s+\{#[^}]+\}\s*$/, '')
      return `- [${escapeLabel(label)}](./${target})`
    })
    .join('\n')
  const partList = parts
    .map(
      (part, i) => `- [第 ${i + 1} 卷（原文 ${part.fromLine}–${part.toLine} 行）](./${part.name})`,
    )
    .join('\n')
  // HTML保持禁用；只有受信任主题读取导航元数据，正文不注入脚本或HTML。
  const metadata = `---\npublicationRedirects: ${JSON.stringify(destinations)}\n---\n\n`
  const index = `${metadata}# ${title} {#${headings[0].id}}\n\n完整正文按卷发布，原文件及证据不删减。原有章节链接会定位到对应分卷；每卷提供返回目录与前后卷导航。\n\n原文 SHA-256：\`${sourceSha256}\`。\n\n${partList}\n\n## 章节定位\n\n${links}\n`
  return { index, parts, headings, destinations, sourceSha256 }
}

/** 分卷中的跨章节链接先回到原目录，由原锚点映射定位到正确卷。 */
export function rewritePublicationAnchor(relativePath, href) {
  if (!href.startsWith('#')) return href
  const match = /(?:^|\/)([^/]+)\.part-\d{3}\.md$/.exec(relativePath)
  return match ? `./${match[1]}.md${href}` : href
}
