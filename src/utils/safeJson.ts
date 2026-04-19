/**
 * 对抗"后端 Long 超过 JS Number.MAX_SAFE_INTEGER (2^53 - 1 = 9007199254740991)"的静默截断问题。
 *
 * 后端返回的 id / parent_id / related_file_id / trace_id 等很多字段声明为 int64。
 * PostgreSQL `bigserial` 通常从 1 开始、线性增长，要走到 2^53 需要 9 × 10^15 行；
 * 但 snowflake / twitter-style id 生成的就是 64-bit（时间戳 41 bit + 机器 10 bit + 序号 12 bit），
 * 这种场景下 id **一定**超 2^53。一旦前端 `JSON.parse` 读到，会静默四舍五入到最近的 2 的幂次，
 * 后续拿 id 做等值比对或作为 URL 参数时就错了行（通常是"编辑落到别人的数据"这类隐蔽 bug）。
 *
 * 策略：用 `json-bigint` 把**超出安全区间**的数字解析成字符串；≤ 2^53 的数字仍保持 number。
 * 大多数 id 不受影响，超大 id 升级成 string，前端只负责回传（不会自己做算术）。
 *
 * 若未来真要做 id 计算，再按需手动 `BigInt(str)`。
 */
import JSONBig from 'json-bigint'

const bigInstance = JSONBig({
  storeAsString: true, // 超 2^53 时转成 string 而不是 BigInt 类型（避免整个类型体系改造）
  useNativeBigInt: false,
  strict: false,
})

/** 尝试用 json-bigint 解析 body；解析失败（非 JSON）保留原始字符串，交给 axios 默认行为。 */
export function safeParseJson(text: unknown): unknown {
  if (typeof text !== 'string') return text
  const trimmed = text.trim()
  if (!trimmed) return text
  // axios transformResponse 的 text 可能已经是对象（responseType=blob/stream 等）
  if (trimmed[0] !== '{' && trimmed[0] !== '[' && trimmed[0] !== '"') return text
  try {
    return bigInstance.parse(text)
  } catch {
    return text
  }
}
