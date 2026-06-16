import { i18n } from '@/locales'

/**
 * 错误码 → 建议动作映射。把后端 BizException 的 i18n key / HTTP 状态翻成
 * 「下一步该怎么办」的人话建议,补在错误 toast 的解释之后,降低运维心智负担。
 *
 * 解释(explanation)沿用既有 `error.*` 翻译;本模块只负责附加「建议动作」。
 */

export type ErrorActionCategory =
  | 'relogin'
  | 'retry'
  | 'contactAdmin'
  | 'checkNetwork'
  | 'checkInput'
  | 'reduceFrequency'

/** 后端 BizException 下发的点分 i18n key → 建议动作类别。 */
const KEY_TO_ACTION: Record<string, ErrorActionCategory> = {
  'error.auth.invalid_credentials': 'checkInput',
  'error.auth.account_locked': 'contactAdmin',
  'error.auth.account_disabled': 'contactAdmin',
  'error.auth.session_expired': 'relogin',
  'error.auth.token_invalid': 'relogin',
  'error.job.definition_not_found': 'checkInput',
  'error.pipeline.definition_not_found': 'checkInput',
  'error.tenant.not_found': 'checkInput',
  'error.idempotency.redis_unavailable': 'retry',
  'error.idempotency.key_conflict': 'retry',
  'error.rateLimit.exceeded': 'reduceFrequency',
}

function actionText(cat: ErrorActionCategory): string {
  return i18n.global.t(`errorAction.${cat}`)
}

/** 仅识别 `error.xxx.yyy` 这种点分 key(允许 camelCase 段,如 rateLimit);普通文案返回 undefined。 */
function isBizKey(raw: string): boolean {
  return /^error\.[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+$/.test(raw.trim())
}

/**
 * 由后端 BizException i18n key 解析建议动作文案。
 * 未知 key / 非 key 文案返回 undefined(不强加建议)。
 */
export function suggestionForBizKey(key: string | undefined): string | undefined {
  if (!key) return undefined
  const trimmed = key.trim()
  if (!isBizKey(trimmed)) return undefined
  const cat = KEY_TO_ACTION[trimmed]
  return cat ? actionText(cat) : undefined
}

/**
 * 由 HTTP 状态码(或网络错误)解析建议动作文案,作为 biz key 缺失时的兜底。
 * 未覆盖的状态返回 undefined。
 */
export function suggestionForHttpStatus(
  status: number | undefined,
  opts?: { network?: boolean },
): string | undefined {
  if (opts?.network) return actionText('checkNetwork')
  if (status == null) return undefined
  if (status === 401) return actionText('relogin')
  if (status === 403) return actionText('contactAdmin')
  if (status === 429) return actionText('reduceFrequency')
  if (status === 400 || status === 422) return actionText('checkInput')
  if (status >= 500) return actionText('retry')
  return undefined
}

/**
 * 综合解析:优先按 biz key,缺失则回退 HTTP 状态 / 网络错误。
 */
export function resolveErrorSuggestion(input: {
  bizKey?: string
  status?: number
  network?: boolean
}): string | undefined {
  return (
    suggestionForBizKey(input.bizKey) ??
    suggestionForHttpStatus(input.status, { network: input.network })
  )
}
