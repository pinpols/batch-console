import { describe, it, expect, vi } from 'vitest'

// t 回显 key,便于断言走到了哪个 errorAction.*
vi.mock('@/locales', () => ({ i18n: { global: { t: (k: string) => k } } }))

import {
  suggestionForBizKey,
  suggestionForHttpStatus,
  resolveErrorSuggestion,
} from './errorCatalog'

describe('suggestionForBizKey', () => {
  it('maps known biz keys to action categories', () => {
    expect(suggestionForBizKey('error.auth.session_expired')).toBe('errorAction.relogin')
    expect(suggestionForBizKey('error.auth.account_locked')).toBe('errorAction.contactAdmin')
    expect(suggestionForBizKey('error.rateLimit.exceeded')).toBe('errorAction.reduceFrequency')
    expect(suggestionForBizKey('error.idempotency.key_conflict')).toBe('errorAction.retry')
  })

  it('returns undefined for unknown keys, non-keys, and blanks', () => {
    expect(suggestionForBizKey('error.unknown.thing')).toBeUndefined()
    expect(suggestionForBizKey('账号或密码错误')).toBeUndefined()
    expect(suggestionForBizKey('')).toBeUndefined()
    expect(suggestionForBizKey(undefined)).toBeUndefined()
  })
})

describe('suggestionForHttpStatus', () => {
  it('maps statuses to actions', () => {
    expect(suggestionForHttpStatus(401)).toBe('errorAction.relogin')
    expect(suggestionForHttpStatus(403)).toBe('errorAction.contactAdmin')
    expect(suggestionForHttpStatus(429)).toBe('errorAction.reduceFrequency')
    expect(suggestionForHttpStatus(400)).toBe('errorAction.checkInput')
    expect(suggestionForHttpStatus(500)).toBe('errorAction.retry')
    expect(suggestionForHttpStatus(503)).toBe('errorAction.retry')
  })

  it('network flag wins and maps to checkNetwork', () => {
    expect(suggestionForHttpStatus(undefined, { network: true })).toBe('errorAction.checkNetwork')
    expect(suggestionForHttpStatus(500, { network: true })).toBe('errorAction.checkNetwork')
  })

  it('returns undefined for uncovered / missing status', () => {
    expect(suggestionForHttpStatus(404)).toBeUndefined()
    expect(suggestionForHttpStatus(undefined)).toBeUndefined()
  })
})

describe('resolveErrorSuggestion', () => {
  it('prefers biz key over status', () => {
    expect(resolveErrorSuggestion({ bizKey: 'error.auth.session_expired', status: 500 })).toBe(
      'errorAction.relogin',
    )
  })

  it('falls back to status when biz key unknown', () => {
    expect(resolveErrorSuggestion({ bizKey: 'error.unknown.x', status: 403 })).toBe(
      'errorAction.contactAdmin',
    )
  })

  it('falls back to network', () => {
    expect(resolveErrorSuggestion({ network: true })).toBe('errorAction.checkNetwork')
  })

  it('returns undefined when nothing matches', () => {
    expect(resolveErrorSuggestion({ status: 404 })).toBeUndefined()
  })
})
