/**
 * 把路由路径转成 i18n key 用的扁平 camelCase 字符串。
 * `/ops/summary` → `opsSummary`,`/system/api-keys` → `systemApiKeys`。
 *
 * 用于 `page.<pathKey>.title` / `page.<pathKey>.description` 的 messages 索引,
 * 让 vue-i18n key 不必处理斜杠/连字符。
 */
export function pathToKey(path: string): string {
  const pathWithoutLeadingSlashes = path.replace(/^\/+/, '')
  const splitPathSegments = pathWithoutLeadingSlashes.split('/')
  const pathSegments = splitPathSegments.filter(Boolean)
  const keySegments = pathSegments.map((segment, index) => {
    const hyphenatedParts = segment.split('-')
    const camelCaseSegment = hyphenatedParts
      .map((part, partIndex) =>
        partIndex === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join('')
    if (index === 0) return camelCaseSegment
    return camelCaseSegment.charAt(0).toUpperCase() + camelCaseSegment.slice(1)
  })
  return keySegments.join('')
}
