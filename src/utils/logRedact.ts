/**
 * 日志脱敏 & 限长
 *
 * - 递归扫描对象,命中敏感 key 的 value 替换为 `'***'`
 * - 数组 / 对象 / 字符串均有上限,防止日志巨大
 * - FormData / Blob / ArrayBuffer 等二进制只报 summary
 */

const SENSITIVE_KEY_RE =
  /password|passwd|pwd|secret|ticket|jwt|cookie|authorization|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token/i

/** 单独识别 `token` 但避免误伤 `traceToken`, `pageToken`, `idempotencyToken` 等 */
const TOKEN_KEY_RE = /^(token|auth[_-]?token|bearer[_-]?token)$/i

const MAX_DEPTH = 5
const MAX_ARRAY_ITEMS = 20
const MAX_STRING_LEN = 256

export interface SanitizeOptions {
  /** JSON 序列化后的最大字节数,超出返回 `_truncated` */
  maxBytes?: number
  /** 字符串单值最大长度,超出截断并追加 "(N chars)" */
  maxStringLen?: number
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key) || TOKEN_KEY_RE.test(key)
}

function truncateString(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `…(${s.length} chars)`
}

function deepRedact(value: unknown, depth: number, maxStringLen: number): unknown {
  if (depth > MAX_DEPTH) return '[deep]'
  if (value == null) return value
  if (typeof value === 'boolean' || typeof value === 'number') return value
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'string') return truncateString(value, maxStringLen)
  if (typeof value === 'function' || typeof value === 'symbol') return `[${typeof value}]`

  if (Array.isArray(value)) {
    const arr = value.slice(0, MAX_ARRAY_ITEMS).map((x) => deepRedact(x, depth + 1, maxStringLen))
    if (value.length > MAX_ARRAY_ITEMS) {
      arr.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`)
    }
    return arr
  }

  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString()
    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      const keys: string[] = []
      value.forEach((_, k) => keys.push(k))
      return `[FormData keys=${keys.join(',')}]`
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      return `[Blob size=${value.size} type=${value.type}]`
    }
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return `[ArrayBuffer size=${value.byteLength}]`
    }
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        result[k] = '***'
      } else {
        result[k] = deepRedact(v, depth + 1, maxStringLen)
      }
    }
    return result
  }

  return String(value)
}

/**
 * 返回适合写入日志的值:
 * - 敏感字段替换为 `'***'`
 * - 字符串 / 数组 / 嵌套层级均限长
 * - 最终整体 JSON 超 `maxBytes` 返回 `{ _truncated: '...', _size: N }`
 */
export function sanitizeForLog(value: unknown, options?: SanitizeOptions): unknown {
  if (value === undefined) return undefined
  const maxBytes = options?.maxBytes ?? 1024
  const maxStringLen = options?.maxStringLen ?? MAX_STRING_LEN

  const reduced = deepRedact(value, 0, maxStringLen)
  try {
    const json = JSON.stringify(reduced)
    if (json == null) return reduced
    if (json.length > maxBytes) {
      return { _truncated: json.slice(0, maxBytes) + '…', _size: json.length }
    }
    return reduced
  } catch {
    return '[unserializable]'
  }
}

/** 把 axios 的 params 对象转成轻量记录(保留原始 key-value 但脱敏) */
export function sanitizeParams(params: unknown): unknown {
  if (params == null) return undefined
  return sanitizeForLog(params, { maxBytes: 512 })
}

/** 把 request body 转成日志友好值 */
export function sanitizeRequestBody(body: unknown): unknown {
  if (body === undefined || body === null || body === '') return undefined
  return sanitizeForLog(body, { maxBytes: 1024 })
}

/** 把 response body(含 CommonResponse 信封)转成日志友好值 */
export function sanitizeResponseBody(body: unknown): unknown {
  if (body === undefined) return undefined
  return sanitizeForLog(body, { maxBytes: 1024 })
}
