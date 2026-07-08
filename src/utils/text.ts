/**
 * 把文本里常见的 HTML 命名/数字实体解码成对应字符,用于「展示」纯文本
 * (如种子/后端数据里存了 `导入&rarr;核对` 这类字面量实体)。
 *
 * 输出仅作为文本节点渲染(绝不喂 v-html),因此不引入 XSS 面;`&amp;` 最后处理,
 * 避免 `&amp;rarr;` 被二次解码。
 */
const NAMED: Record<string, string> = {
  '&rarr;': '→',
  '&larr;': '←',
  '&harr;': '↔',
  '&rArr;': '⇒',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&middot;': '·',
  '&bull;': '•',
  '&times;': '×',
  '&divide;': '÷',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
}

export function decodeBasicEntities(input: unknown): string {
  if (input == null) return ''
  let s = String(input)
  if (!s.includes('&')) return s
  for (const [entity, char] of Object.entries(NAMED)) {
    if (s.includes(entity)) s = s.split(entity).join(char)
  }
  // 数字实体 &#8594; / &#x2192;
  s = s
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
  // &amp; 最后
  return s.split('&amp;').join('&')
}

function safeFromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return ''
  try {
    return String.fromCodePoint(cp)
  } catch {
    return ''
  }
}
