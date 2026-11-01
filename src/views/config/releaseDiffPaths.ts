/** 只列出变化路径，不在摘要中复制可能含凭据的配置值。 */
export function releaseDiffPaths(before: unknown, after: unknown, limit = 200) {
  const paths: string[] = []
  let truncated = false
  let visited = 0
  function compare(a: unknown, b: unknown, path: string, depth: number) {
    if (truncated || Object.is(a, b)) return
    if (++visited > 5000 || depth > 30 || paths.length >= limit) {
      truncated = true
      return
    }
    const aObject = a !== null && typeof a === 'object'
    const bObject = b !== null && typeof b === 'object'
    if (aObject && bObject && Array.isArray(a) === Array.isArray(b)) {
      const aRecord = a as Record<string, unknown>
      const bRecord = b as Record<string, unknown>
      const keys = [...new Set([...Object.keys(aRecord), ...Object.keys(bRecord)])].sort()
      for (const key of keys) {
        const child = Array.isArray(a) ? `${path}[${key}]` : `${path}[${JSON.stringify(key)}]`
        if (!Object.hasOwn(aRecord, key) || !Object.hasOwn(bRecord, key)) {
          if (paths.length >= limit) { truncated = true; return }
          paths.push(child)
        } else compare(aRecord[key], bRecord[key], child, depth + 1)
        if (truncated) return
      }
      return
    }
    paths.push(path)
  }
  compare(before, after, '$', 0)
  return { paths, truncated }
}
