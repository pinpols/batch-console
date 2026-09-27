import type { AxiosRequestConfig } from 'axios'
import { get } from '@/api/client'

export interface LoginPublicKeyResponse {
  algorithm: string
  publicKey: string
  fingerprint: string
}

/** 登录加密公钥。静默请求，失败由登录流程决定是否降级。 */
export function fetchLoginPublicKey(): Promise<LoginPublicKeyResponse> {
  return get<LoginPublicKeyResponse>('/api/console/auth/public-key', {
    _silent: true,
  } as AxiosRequestConfig)
}
