import { get } from '@/api/client'
import type { components } from '@/types/api.generated'

export type ConsoleOidcProvider = components['schemas']['ConsoleOidcProviderResponse']

/** 登录页公开查询当前静态 OIDC 入口是否启用。 */
export async function getConsoleOidcProvider(): Promise<ConsoleOidcProvider> {
  const provider = await get<ConsoleOidcProvider | null>('/api/console/auth/oidc/provider')
  return provider ?? { enabled: false }
}
