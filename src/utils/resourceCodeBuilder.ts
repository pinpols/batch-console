/**
 * 资源 code 构造 + 校验,从 CodeNameBuilder.vue 抽出 pure 函数。
 *
 * 规则:`{DOMAIN}_{BIZ}[_v{N}]`(如 `JOB_DAILY_REPORT_v2`)
 *  - DOMAIN:大写 enum 字面量(JOB / WORKFLOW / TEMPLATE 等),由调用方传入(已是枚举值)
 *  - BIZ:3-30 字符,只能 [A-Z0-9_],会自动 normalize 输入(小写 → 大写,非法字符 → `_`)
 *  - 版本可选:`v1` / `1` 都接受,统一输出 `_v{n}`,非法返空
 */

export const BIZ_FORMAT = /^[A-Z][A-Z0-9_]{0,29}$/

export type BizViolation = 'EMPTY' | 'LENGTH' | 'FORMAT'

export interface BizValidationResult {
  ok: boolean
  violation?: BizViolation
}

/** 输入 normalize:`daily-report` → `DAILY_REPORT`(用户随便打,工具收敛) */
export function normalizeBiz(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
}

/** biz 名称校验。biz 必须先经 normalizeBiz 处理 */
export function validateBiz(biz: string): BizValidationResult {
  if (!biz) return { ok: false, violation: 'EMPTY' }
  if (biz.length < 3 || biz.length > 30) return { ok: false, violation: 'LENGTH' }
  if (!BIZ_FORMAT.test(biz)) return { ok: false, violation: 'FORMAT' }
  return { ok: true }
}

/** 版本后缀:`v2` / `2` / `V3` 都接受 → `_v2` / `_v2` / `_v3`;非法 / 空 → 空串 */
export function buildVersionSuffix(version: string): string {
  const trimmed = version.trim()
  if (!trimmed) return ''
  const n = trimmed.replace(/^v/i, '')
  if (!/^\d+$/.test(n)) return ''
  return `_v${n}`
}

/**
 * 拼最终 resource code。biz 空时返空串,调用方按需 disable submit。
 *
 * @param domain 大写 enum(JOB / WORKFLOW / TEMPLATE / CHANNEL ...)
 * @param biz 原始用户输入(自动 normalize)
 * @param version 可选版本号(v2 / 2)
 */
export function buildResourceCode(domain: string, biz: string, version = ''): string {
  const normalized = normalizeBiz(biz)
  if (!normalized) return ''
  return `${domain}_${normalized}${buildVersionSuffix(version)}`
}

/** 找出 existingCodes 里同 domain 的同类 code(用于 UI 提示「相似已存在」) */
export function findSimilarCodes(
  domain: string,
  finalCode: string,
  existingCodes: readonly string[],
): string[] {
  if (!existingCodes.length) return []
  const prefix = `${domain}_`
  return existingCodes.filter((c) => c.startsWith(prefix) && c !== finalCode)
}
