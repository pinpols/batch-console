import type { AxiosRequestConfig } from 'axios'
import { get, post } from '@/api/client'
import { encryptLoginBody } from '@/utils/loginCrypto'

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
  /**
   * P1 待 BE 实施(见 docs/runbook/password-security-backlog.md):
   * BE schema 加 password_must_change BOOLEAN + login/me response 带此字段。
   * 字段缺失时 FE 视为 false(向后兼容老版本 BE)。
   */
  mustChangePassword?: boolean
  /**
   * P3 待 BE 实施:密码距离过期天数,< 7 时 FE banner 提示。
   * 字段缺失时 FE 不显 banner。
   */
  passwordExpiringIn?: number
}

/** POST /api/console/auth/change-password — 待 BE 实施 (P0.1) */
export interface ChangePasswordBody {
  oldPassword: string
  newPassword: string
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
    // P1/P3 待 BE:字段缺失 → undefined,FE 视为不需强制 / 不显 banner
    mustChangePassword: p.mustChangePassword,
    passwordExpiringIn: p.passwordExpiringIn,
  }
}

export const authApi = {
  login: async (params: LoginParams) => {
    // 2026-05-18: 优先 RSA+AES 混合加密 body;Web Crypto 不可用 / 公钥取失败时
    // 回退明文 (BE 默认 required=false 接受双形态)。
    // prod profile 强制 required=true 时,明文路径会被 401 error.auth.encryption_required
    // 拦下,登录页捕获错误码提示用户。
    const plaintext = { username: params.username, password: params.password }
    const encrypted = await encryptLoginBody(plaintext)
    const body: Record<string, unknown> = encrypted ?? plaintext
    const payload = await post<ConsoleAuthTokenPayload>('/api/console/auth/login', body)
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

  /**
   * POST /api/console/auth/logout — 后端 Set-Cookie max-age=0 清 HttpOnly
   * token cookie。返回 204(无 body)。失败不抛(前端会兜底清本地态)。
   * 可传 `{ _silent: true }`(见 interceptors LoggedConfig)抑制失败 toast,
   * 用于登录页挂载时预清的兜底调用。
   */
  logout: (config?: AxiosRequestConfig) =>
    post<void>('/api/console/auth/logout', undefined, config),

  /**
   * POST /api/console/auth/change-password — 自助改密码(待 BE 实施 P0.1)
   *
   * 见 docs/runbook/password-security-backlog.md
   * - 5 角色全部可调(hasAnyAuthority ROLE_ADMIN/CONFIG_ADMIN/AUDITOR/TENANT_USER/USER)
   * - oldPassword 错 → 401
   * - newPassword 不合规(< 12 位)→ 400
   * - newPassword == oldPassword → 409 STATE_CONFLICT
   * - 成功后 BE 自动清 password_must_change flag
   */
  changePassword: (body: ChangePasswordBody) =>
    post<void>('/api/console/auth/change-password', body),
}
