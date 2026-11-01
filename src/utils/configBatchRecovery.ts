import { STORAGE_KEYS } from '@/constants/storageKeys'
import { createIdempotencyKey } from '@/utils/idempotency'

export type ConfigBatchRecoveryKind = 'TENANT_COPY' | 'JOB_BUNDLE_CREATE' | 'JOB_BUNDLE_IMPORT'

/** 仅记录原请求身份；配置正文和凭据不保存在浏览器。 */
export interface ConfigBatchRecovery {
  actor: string
  headerTenant: string
  auditTenantId: string
  operationKind: ConfigBatchRecoveryKind
  key: string
  createdAt: number
}

const environment = JSON.stringify([
  import.meta.env.BASE_URL ?? '/',
  import.meta.env.VITE_API_BASE_URL ?? '',
])
const kinds: ConfigBatchRecoveryKind[] = ['TENANT_COPY', 'JOB_BUNDLE_CREATE', 'JOB_BUNDLE_IMPORT']

function storageKey(actor: string, headerTenant: string): string {
  return STORAGE_KEYS.configBatchRecoveryPrefix + encodeURIComponent(
    JSON.stringify([environment, actor, headerTenant]),
  )
}

function validCommand(value: unknown, actor: string, headerTenant: string): value is ConfigBatchRecovery {
  if (!value || typeof value !== 'object') return false
  const command = value as Partial<ConfigBatchRecovery>
  return (
    !!actor &&
    command.actor === actor &&
    command.headerTenant === headerTenant &&
    typeof command.auditTenantId === 'string' && !!command.auditTenantId.trim() &&
    typeof command.operationKind === 'string' && kinds.includes(command.operationKind as ConfigBatchRecoveryKind) &&
    typeof command.key === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(command.key) &&
    Number.isSafeInteger(command.createdAt) && Number(command.createdAt) >= 0
  )
}

export function createConfigBatchRecovery(
  scope: Pick<ConfigBatchRecovery, 'actor' | 'headerTenant' | 'auditTenantId' | 'operationKind'>,
): ConfigBatchRecovery {
  const command: ConfigBatchRecovery = {
    actor: scope.actor,
    headerTenant: scope.headerTenant,
    auditTenantId: scope.auditTenantId,
    operationKind: scope.operationKind,
    key: createIdempotencyKey(),
    createdAt: Date.now(),
  }
  if (!validCommand(command, scope.actor, scope.headerTenant)) {
    throw new Error('Invalid config batch recovery scope')
  }
  return command
}

export function listConfigBatchRecoveries(
  actor: string,
  headerTenant: string,
  storage?: Storage,
): { commands: ConfigBatchRecovery[]; blocked: boolean } {
  if (!actor) return { commands: [], blocked: true }
  try {
    const raw = (storage ?? window.sessionStorage).getItem(storageKey(actor, headerTenant))
    if (raw === null) return { commands: [], blocked: false }
    const commands: unknown = JSON.parse(raw)
    if (!Array.isArray(commands) || !commands.every((item) => validCommand(item, actor, headerTenant))) {
      return { commands: [], blocked: true }
    }
    if (new Set(commands.map((command) => command.key)).size !== commands.length) {
      return { commands: [], blocked: true }
    }
    return { commands, blocked: false }
  } catch {
    return { commands: [], blocked: true }
  }
}

function sameCommand(left: ConfigBatchRecovery, right: ConfigBatchRecovery): boolean {
  return left.actor === right.actor && left.headerTenant === right.headerTenant &&
    left.auditTenantId === right.auditTenantId && left.operationKind === right.operationKind &&
    left.key === right.key && left.createdAt === right.createdAt
}

/** 必须在发送正式写请求前成功保存。 */
export function saveConfigBatchRecovery(command: ConfigBatchRecovery, storage?: Storage): boolean {
  if (!validCommand(command, command.actor, command.headerTenant)) return false
  try {
    const target = storage ?? window.sessionStorage
    const current = listConfigBatchRecoveries(command.actor, command.headerTenant, target)
    if (current.blocked) return false
    const existing = current.commands.find((entry) => entry.key === command.key)
    if (existing) return sameCommand(existing, command)
    const saved: ConfigBatchRecovery = {
      actor: command.actor,
      headerTenant: command.headerTenant,
      auditTenantId: command.auditTenantId,
      operationKind: command.operationKind,
      key: command.key,
      createdAt: command.createdAt,
    }
    target.setItem(storageKey(command.actor, command.headerTenant), JSON.stringify([...current.commands, saved]))
    return true
  } catch {
    return false
  }
}

/** 只有调用者已核实原结果后才应删除；不会删除同范围内其他操作。 */
export function clearConfigBatchRecovery(command: ConfigBatchRecovery, storage?: Storage): boolean {
  if (!validCommand(command, command.actor, command.headerTenant)) return false
  try {
    const target = storage ?? window.sessionStorage
    const current = listConfigBatchRecoveries(command.actor, command.headerTenant, target)
    if (current.blocked) return false
    const found = current.commands.find((entry) => entry.key === command.key)
    if (!found || !sameCommand(found, command)) return false
    const remaining = current.commands.filter((entry) => entry.key !== command.key)
    if (remaining.length) target.setItem(storageKey(command.actor, command.headerTenant), JSON.stringify(remaining))
    else target.removeItem(storageKey(command.actor, command.headerTenant))
    return true
  } catch {
    return false
  }
}

export function canReadConfigBatchRecovery(
  command: ConfigBatchRecovery,
  actor: string,
  headerTenant: string,
): boolean {
  return validCommand(command, actor, headerTenant)
}
