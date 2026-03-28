import { get, post } from '@/api/client'
import type { Role, UserInfo } from '@/types'

export interface LoginParams {
  username: string
  password: string
}

/** POST /api/console/auth/token 解包后的 data */
export interface ConsoleAuthTokenPayload {
  accessToken: string
  tokenType: string
  issuedAt: string
  expiresAt: string
  username: string
  tenantId: string
  authorities: string[]
}

export interface ConsoleAuthProfilePayload {
  username: string
  tenantId: string
  authorities: string[]
}

function mapAuthoritiesToRole(authorities: string[]): Role {
  const a = authorities.join(' ')
  if (a.includes('ROLE_ADMIN')) return 'ADMIN'
  if (a.includes('ROLE_CONFIG_ADMIN')) return 'OPERATOR'
  if (a.includes('ROLE_AUDITOR')) return 'VIEWER'
  return 'VIEWER'
}

function basicAuthHeader(username: string, password: string) {
  const raw = unescape(encodeURIComponent(`${username}:${password}`))
  return `Basic ${btoa(raw)}`
}

export function mapProfileToUserInfo(p: ConsoleAuthProfilePayload): UserInfo {
  return {
    userId: p.username,
    username: p.username,
    role: mapAuthoritiesToRole(p.authorities ?? []),
    permissions: p.authorities ?? [],
  }
}

export const authApi = {
  login: async (params: LoginParams) => {
    const payload = await post<ConsoleAuthTokenPayload>(
      '/api/console/auth/token',
      {},
      { headers: { Authorization: basicAuthHeader(params.username, params.password) } },
    )
    return {
      token: payload.accessToken,
      userInfo: mapProfileToUserInfo({
        username: payload.username,
        tenantId: payload.tenantId,
        authorities: payload.authorities,
      }),
      tenantId: payload.tenantId,
    }
  },

  /** GET /api/console/auth/me */
  me: async () => {
    const profile = await get<ConsoleAuthProfilePayload>('/api/console/auth/me')
    return mapProfileToUserInfo(profile)
  },

  /** Console API 无单独 logout 端点时仅前端清态 */
  logout: () => Promise.resolve(),
}
