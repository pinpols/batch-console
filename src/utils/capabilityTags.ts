/**
 * Worker 能力标签在注册表里可能是 JSON 数组字符串（["report","dry-run-safe"]），
 * 也可能是逗号分隔的旧格式；统一拆成标签数组，避免页面直接显示原始 JSON。
 */
export function parseCapabilityTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw !== 'string') return []
  const text = raw.trim()
  if (!text) return []
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {
      // 不是合法 JSON 时按逗号分隔处理
    }
  }
  return text
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((part) => part.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)
}
