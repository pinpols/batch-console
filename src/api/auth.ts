import { get, post } from '@/api/client'

import type { MenuGroup, Role, UserInfo } from '@/types'

export interface LoginParams {
  username: string
  password: string
}

/** POST /api/console/auth/login 解包后的 data */
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
  /** 后端 ConsoleMenuRegistry 按 authorities 过滤后的菜单树；老版本后端可能无该字段 */
  menus?: MenuGroup[]
}

function mapAuthoritiesToRole(authorities: string[]): Role {
  const a = authorities.join(' ')
  if (a.includes('ROLE_ADMIN')) return 'ADMIN'
  if (a.includes('ROLE_CONFIG_ADMIN')) return 'OPERATOR'
  if (a.includes('ROLE_AUDITOR')) return 'VIEWER'
  return 'VIEWER'
}

export function mapProfileToUserInfo(p: ConsoleAuthProfilePayload): UserInfo {
  return {
    userId: p.username,
    username: p.username,
    role: mapAuthoritiesToRole(p.authorities ?? []),
    permissions: p.authorities ?? [],
    menus: p.menus,
  }
}

export const authApi = {
  login: async (params: LoginParams) => {
    const payload = await post<ConsoleAuthTokenPayload>('/api/console/auth/login', {
      username: params.username,
      password: params.password,
    })
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

  /** POST /api/console/auth/token — exchange current session for JWT */
  token: () => post<ConsoleAuthTokenPayload>('/api/console/auth/token', undefined),

  /** Console API 无单独 logout 端点时仅前端清态 */
  logout: () => Promise.resolve(),
}
