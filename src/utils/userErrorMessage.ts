import { i18n } from '@/locales'

type ApiErrorLike = {
  isAxiosError?: boolean
  code?: string
  message?: string
  missingTenant?: boolean
  response?: {
    status?: number
    data?: unknown
  }
}

const TECHNICAL_MESSAGE =
  /^(?:request failed with status code|bad gateway|service unavailable|gateway timeout|bad request|internal server error|not found)\b|^[{[]|<(!doctype|html)|\b(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|SQLState|Stacktrace)\b/i

function isApiError(error: unknown): error is ApiErrorLike {
  if (!error || typeof error !== 'object') return false
  const candidate = error as ApiErrorLike
  return candidate.isAxiosError === true || typeof candidate.response?.status === 'number'
}

function translateMessage(message: unknown): string | undefined {
  if (typeof message !== 'string') return undefined
  const messageIsBlank = !message.trim()
  if (messageIsBlank) return undefined
  const value = message.trim()
  if (/^error\.[a-z][a-z0-9_]*(?:\.[a-zA-Z0-9_]+)+$/.test(value)) {
    return i18n.global.te(value) ? i18n.global.t(value) : undefined
  }
  if (TECHNICAL_MESSAGE.test(value)) return undefined
  return value
}

/** 将网络与服务端错误转换为用户可读文案，并保留可操作的 4xx 校验信息。 */
export function userErrorMessage(error: unknown, fallback?: string): string {
  const defaultMessage = fallback ?? i18n.global.t('apiError.requestFailed')
  if (!isApiError(error)) {
    if (
      error instanceof Error &&
      /network error|failed to fetch|load failed|timed out|timeout/i.test(error.message)
    ) {
      return i18n.global.t('apiError.backendUnreachable')
    }
    return error instanceof Error && error.message ? error.message : defaultMessage
  }
  if (error.code === 'ERR_CANCELED') return defaultMessage
  if (error.missingTenant && error.message) return error.message

  const status = error.response?.status
  if (!error.response || status == null) return i18n.global.t('apiError.backendUnreachable')
  if (status >= 500) return i18n.global.t('apiError.backendUnreachable')

  const body = error.response.data
  if (!body || typeof body !== 'object') return defaultMessage
  const payload = body as { message?: unknown; error?: unknown }
  return translateMessage(payload.message) ?? defaultMessage
}
