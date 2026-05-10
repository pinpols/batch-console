/**
 * 把路由路径转成 i18n key 用的扁平 camelCase 字符串。
 * `/ops/summary` → `opsSummary`,`/system/api-keys` → `systemApiKeys`。
 *
 * 用于 `page.<pathKey>.title` / `page.<pathKey>.description` 的 messages 索引,
 * 让 vue-i18n key 不必处理斜杠/连字符。
 */
export function pathToKey(path: string): string {
  return path
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((seg, idx) => {
      const camel = seg
        .split('-')
        .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
        .join('')
      if (idx === 0) return camel
      return camel.charAt(0).toUpperCase() + camel.slice(1)
    })
    .join('')
}
