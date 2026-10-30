import { del, get, post } from '@/api/client'
import type { components } from '@/types/api.generated'

export type ConsoleOidcProvider = components['schemas']['ConsoleOidcProviderResponse']
export type ConsoleOidcIdentity = components['schemas']['ConsoleOidcIdentityResponse']
export type ConsoleOidcIdentityRequest = components['schemas']['ConsoleOidcIdentityRequest']

/** 登录页公开查询当前静态 OIDC 入口是否启用。 */
export async function getConsoleOidcProvider(): Promise<ConsoleOidcProvider> {
  const provider = await get<ConsoleOidcProvider | null>('/api/console/auth/oidc/provider')
  return provider ?? { enabled: false }
}

const OIDC_IDENTITIES_PATH = '/api/console/auth/oidc/identities'

export function listConsoleOidcIdentities(tenantId: string): Promise<ConsoleOidcIdentity[]> {
  return get<ConsoleOidcIdentity[]>(OIDC_IDENTITIES_PATH, { tenantId })
}

export function bindConsoleOidcIdentity(
  tenantId: string,
  request: ConsoleOidcIdentityRequest,
): Promise<ConsoleOidcIdentity> {
  return post<ConsoleOidcIdentity>(OIDC_IDENTITIES_PATH, request, { params: { tenantId } })
}

export function unbindConsoleOidcIdentity(tenantId: string, identityId: number): Promise<void> {
  return del<void>(`${OIDC_IDENTITIES_PATH}/${identityId}`, { params: { tenantId } })
}
