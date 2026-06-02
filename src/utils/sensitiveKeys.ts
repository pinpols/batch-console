/**
 * 凭据敏感字段检测 — 单一权威源(Lane G FE 警示)。
 *
 * 与 BE `SensitiveDataValidator` 关键字一一对应:
 *   ../file-batch-system/batch-common/src/main/java/com/example/batch/common/security/SensitiveDataValidator.java
 *
 * **修改红线**:任何一侧改 keyword 列表 / 归一化策略,必须同步另一侧;
 * 否则 FE 警示提示"安全"而 BE 拒入,或反之 — 用户体验严重不一致。
 *
 * 归一化:key.toLowerCase().replace(/_|-/g,'') 后做 contains 匹配,
 * 这样 `api_key` / `apiKey` / `x-api-key` / `API-KEY` 都落到同一规范形态(与 BE 行为对齐)。
 */

/**
 * 命中即视为凭据的关键字(已小写、已去 `_-`)。与 BE `SENSITIVE_KEYWORDS` 1:1。
 *
 * 注意:列表保持小写 / 去分隔符 normalized 形态,匹配时 input 也要先 normalize。
 */
export const SENSITIVE_KEYWORDS: readonly string[] = Object.freeze([
  'password',
  'passwd',
  'secret',
  'apikey',
  'token',
  'credential',
  'accesskey',
  'privatekey',
  'clientsecret',
])

/** 归一化 key:小写 + 去 `_-`,匹配 BE `SensitiveDataValidator#scan` 的策略。 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '')
}

function isSensitiveKey(key: string): boolean {
  const norm = normalizeKey(key)
  for (const kw of SENSITIVE_KEYWORDS) {
    if (norm.includes(kw)) return true
  }
  return false
}

export interface DetectOptions {
  /**
   * 跳过的路径前缀(jsonpath 风格,用 `.` 分隔)。
   * 例如 `["auth"]` 跳过 `auth.password` / `auth.token`(HTTP executor 协议字段豁免,与 BE 对齐)。
   * 注意:精确匹配段前缀,`auth` 不会误跳 `authorize.password`。
   */
  exemptPaths?: string[]
}

/** 判断 `path`(以 `.` 分隔)是否落在任何豁免前缀下。 */
function isExempt(path: string, exemptPaths: readonly string[] | undefined): boolean {
  if (!exemptPaths || exemptPaths.length === 0) return false
  for (const ex of exemptPaths) {
    if (path === ex || path.startsWith(ex + '.')) return true
  }
  return false
}

/**
 * 递归扫描对象/数组的 key,返回所有命中关键字的完整路径(如 `auth.password` / `items[0].token`)。
 *
 * - 输入支持 `Record<string,unknown>` / `string`(JSON 字符串自动 parse;parse 失败返回空数组)/ 数组 / 其他原始值(返回空)
 * - 已访问对象用 `WeakSet` 防自指循环
 * - 命中后**不**早停,返回所有命中以便 UI 一次性列全
 */
export function detectSensitiveKeys(data: unknown, options: DetectOptions = {}): string[] {
  const { exemptPaths } = options
  // 字符串入参 → 尝试 JSON.parse,失败视为无命中(避免抛错破 UI)
  let payload: unknown = data
  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (!trimmed) return []
    try {
      payload = JSON.parse(trimmed)
    } catch {
      return []
    }
  }
  if (payload === null || typeof payload !== 'object') return []

  const hits: string[] = []
  const seen = new WeakSet<object>()

  function walk(node: unknown, path: string): void {
    if (node === null || typeof node !== 'object') return
    if (seen.has(node as object)) return
    seen.add(node as object)

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        walk(node[i], `${path}[${i}]`)
      }
      return
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key
      if (!isExempt(childPath, exemptPaths) && isSensitiveKey(key)) {
        hits.push(childPath)
      }
      if (value !== null && typeof value === 'object') {
        walk(value, childPath)
      }
    }
  }

  walk(payload, '')
  return hits
}
