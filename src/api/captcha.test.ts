import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  get: vi.fn(),
}))

import { get } from '@/api/client'
import { getCaptchaConfig, getSelfHostedChallenge } from './captcha'

const mockedGet = vi.mocked(get)

describe('captchaApi', () => {
  beforeEach(() => mockedGet.mockReset())

  it('normalizes a well-formed config payload', async () => {
    mockedGet.mockResolvedValue({
      provider: 'cloudflare',
      siteKey: 'site-123',
      loginProtectionEnabled: true,
    })
    const cfg = await getCaptchaConfig()
    expect(cfg).toEqual({
      provider: 'cloudflare',
      siteKey: 'site-123',
      loginProtectionEnabled: true,
    })
  })

  it('lowercases and falls back unknown provider to none', async () => {
    mockedGet.mockResolvedValue({ provider: 'SELFHOSTED', loginProtectionEnabled: true })
    expect((await getCaptchaConfig()).provider).toBe('selfhosted')

    mockedGet.mockResolvedValue({ provider: 'mystery', loginProtectionEnabled: true })
    expect((await getCaptchaConfig()).provider).toBe('none')
  })

  it('defaults loginProtectionEnabled to false when missing', async () => {
    mockedGet.mockResolvedValue({ provider: 'none' })
    expect((await getCaptchaConfig()).loginProtectionEnabled).toBe(false)
  })

  it('coerces challenge gap to a number', async () => {
    mockedGet.mockResolvedValue({ challengeId: 'abc', gap: '42' })
    expect(await getSelfHostedChallenge()).toEqual({ challengeId: 'abc', gap: 42 })
  })

  it('tolerates a missing challengeId', async () => {
    mockedGet.mockResolvedValue({ gap: 10 })
    expect(await getSelfHostedChallenge()).toEqual({ challengeId: '', gap: 10 })
  })
})
