import type { ConfigSyncImportBody } from '@/api/configReleases'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { createIdempotencyKey } from '@/utils/idempotency'

/** 仅保存原请求身份和输入摘要；配置正文可能含敏感信息，不写入浏览器存储。 */
export interface ConfigSyncRecovery {
  scope: string
  key: string
  bodyHash: string
  createdAt: number
}
const retryWindowMs = 23 * 60 * 60 * 1000
// 同源下的不同前端部署或 API 地址不共享待确认命令；构建作用域固定到本次页面生命周期。
const environment = JSON.stringify([
  import.meta.env.BASE_URL ?? '/',
  import.meta.env.VITE_API_BASE_URL ?? '',
])
function storageKey(scope: string) {
  return STORAGE_KEYS.configSyncRecoveryPrefix + encodeURIComponent(`${environment}\0${scope}`)
}
function validScope(scope: string) {
  const parts = scope.split('\0')
  return parts.length === 2 && parts.every(Boolean)
}
function validRecord(value: ConfigSyncRecovery, scope: string, now: number) {
  return (
    value?.scope === scope &&
    validScope(scope) &&
    typeof value.key === 'string' &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(value.key) &&
    /^[a-f0-9]{64}$/.test(value.bodyHash) &&
    Number.isSafeInteger(value.createdAt) &&
    value.createdAt >= 0 &&
    value.createdAt <= now
  )
}
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const entries = Object.keys(record)
      .sort()
      .map((key) => [key, canonicalValue(record[key])])
    return Object.fromEntries(entries)
  }
  return value
}
async function bodyHash(body: ConfigSyncImportBody) {
  const normalized = canonicalValue(body)
  const serialized = JSON.stringify(normalized)
  const encoded = new TextEncoder().encode(serialized)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
export async function createConfigSyncRecovery(
  scope: string,
  body: ConfigSyncImportBody,
  now = Date.now(),
): Promise<ConfigSyncRecovery> {
  if (!validScope(scope) || scope.split('\0')[1] !== body.tenantId)
    throw new Error('Invalid config sync recovery scope')
  const key = createIdempotencyKey()
  const hash = await bodyHash(body)
  return { scope, key, bodyHash: hash, createdAt: now }
}
export function restoreConfigSyncRecovery(
  scope: string,
  storage?: Storage,
  now = Date.now(),
): { command: ConfigSyncRecovery | null; blocked: boolean } {
  try {
    const raw = (storage ?? window.sessionStorage).getItem(storageKey(scope))
    if (raw == null) return { command: null, blocked: false }
    const command = JSON.parse(raw) as ConfigSyncRecovery
    return validRecord(command, scope, now)
      ? { command, blocked: false }
      : { command: null, blocked: true }
  } catch {
    return { command: null, blocked: true }
  }
}
export function saveConfigSyncRecovery(command: ConfigSyncRecovery, storage?: Storage): boolean {
  try {
    if (!validRecord(command, command.scope, Date.now())) return false
    const target = storage ?? window.sessionStorage
    const previous = restoreConfigSyncRecovery(command.scope, target)
    if (
      previous.blocked ||
      (previous.command &&
        (previous.command.key !== command.key ||
          previous.command.bodyHash !== command.bodyHash ||
          previous.command.createdAt !== command.createdAt))
    )
      return false
    target.setItem(storageKey(command.scope), JSON.stringify(command))
    return true
  } catch {
    return false
  }
}
export function clearConfigSyncRecovery(command: ConfigSyncRecovery, storage?: Storage): boolean {
  try {
    const target = storage ?? window.sessionStorage
    const previous = restoreConfigSyncRecovery(command.scope, target)
    if (previous.blocked || (previous.command && previous.command.key !== command.key)) return false
    target.removeItem(storageKey(command.scope))
    return true
  } catch {
    return false
  }
}
export async function canRetryConfigSync(
  command: ConfigSyncRecovery,
  body: ConfigSyncImportBody,
  now = Date.now(),
): Promise<boolean> {
  if (!validRecord(command, command.scope, now) || now - command.createdAt >= retryWindowMs)
    return false
  return (
    command.scope.split('\0')[1] === body.tenantId && (await bodyHash(body)) === command.bodyHash
  )
}
