import { describe, expect, it } from 'vitest'
import { i18n } from '@/locales'
import { userErrorMessage } from './userErrorMessage'

describe('userErrorMessage', () => {
  it('hides gateway status and proxy HTML for server failures', () => {
    expect(
      userErrorMessage({
        isAxiosError: true,
        response: { status: 502, data: '<html>Bad Gateway</html>' },
      }),
    ).toBe(i18n.global.t('apiError.backendUnreachable'))
  })

  it('maps transport errors and timeouts to localized service copy', () => {
    expect(userErrorMessage({ isAxiosError: true, code: 'ECONNABORTED' })).toBe(
      i18n.global.t('apiError.backendUnreachable'),
    )
  })

  it('preserves actionable client validation messages', () => {
    expect(
      userErrorMessage({
        isAxiosError: true,
        response: { status: 400, data: { message: '作业编码不能为空' } },
      }),
    ).toBe('作业编码不能为空')
  })

  it('does not expose unknown backend i18n keys or raw payload strings', () => {
    expect(
      userErrorMessage({
        isAxiosError: true,
        response: { status: 409, data: { message: 'error.unknown.internal_state' } },
      }),
    ).toBe(i18n.global.t('apiError.requestFailed'))
    expect(
      userErrorMessage({ isAxiosError: true, response: { status: 502, data: 'upstream reset' } }),
    ).toBe(i18n.global.t('apiError.backendUnreachable'))
  })

  it('preserves non-API client-side validation errors', () => {
    expect(userErrorMessage(new Error('JSON 格式不正确'))).toBe('JSON 格式不正确')
  })

  it('normalizes fetch transport failures and non-Axios server responses', () => {
    expect(userErrorMessage(new TypeError('Failed to fetch'))).toBe(
      i18n.global.t('apiError.backendUnreachable'),
    )
    expect(
      userErrorMessage(
        Object.assign(new Error('AI stream request failed'), {
          response: { status: 503, data: { code: 'SYSTEM_ERROR' } },
        }),
      ),
    ).toBe(i18n.global.t('apiError.backendUnreachable'))
  })
})
