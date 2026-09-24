import { get } from '@/api/client'

/**
 * 验证码相关接口。后端返回的是宽松 Map（无 OpenAPI schema），
 * 这里在本模块内手写最小返回类型（红线：不动 src/types/api.generated.ts）。
 */

/** 验证码 provider 标识。none = 关闭;其余为各家验证码服务。 */
export type CaptchaProvider = 'none' | 'cloudflare' | 'tencent' | 'aliyun'

/** GET /api/console/captcha/config 解包后的 data。 */
export interface CaptchaConfig {
  provider: CaptchaProvider
  /** 第三方 provider 的站点公钥;none 时为空。 */
  siteKey?: string
  /** 登录保护是否开启;false 时即便有 provider 也不需要验证码。 */
  loginProtectionEnabled: boolean
}

function normalizeProvider(raw: unknown): CaptchaProvider {
  const v = typeof raw === 'string' ? raw.toLowerCase() : ''
  if (v === 'cloudflare' || v === 'tencent' || v === 'aliyun') return v
  return 'none'
}

export const captchaApi = {
  /** 拉取验证码配置。任意 provider 都可调用(包括 none)。 */
  getCaptchaConfig: async (): Promise<CaptchaConfig> => {
    const raw = await get<Record<string, unknown>>('/api/console/captcha/config')
    return {
      provider: normalizeProvider(raw?.provider),
      siteKey: typeof raw?.siteKey === 'string' ? raw.siteKey : undefined,
      loginProtectionEnabled: raw?.loginProtectionEnabled === true,
    }
  },
}

export const { getCaptchaConfig } = captchaApi
