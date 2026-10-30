import type { AtomicRuntimeStatus } from '@/api/atomicRuntime'
export interface RuntimeDetail {
  key: string
  value: boolean | string | number | null
  source?: boolean
}
export interface RuntimeExecutorRow {
  executor: string
  enabled: boolean | null
  details: RuntimeDetail[]
}
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null
export function atomicRuntimeRows(status: AtomicRuntimeStatus | null): RuntimeExecutorRow[] {
  if (status?.available !== true) return []
  return [
    {
      executor: 'shell',
      enabled: bool(status.shell?.enabled),
      details: [{ key: 'commandWhitelistSize', value: count(status.shell?.commandWhitelistSize) }],
    },
    {
      executor: 'sql',
      enabled: bool(status.sql?.enabled),
      details: [{ key: 'dialect', value: text(status.sql?.dialect) }],
    },
    {
      executor: 'http',
      enabled: bool(status.http?.enabled),
      details: [
        { key: 'enforceAllowlist', value: bool(status.http?.enforceAllowlist) },
        {
          key: 'enforceAllowlistSource',
          value: text(status.http?.enforceAllowlistSource),
          source: true,
        },
        { key: 'allowlistHostsSize', value: count(status.http?.allowlistHostsSize) },
      ],
    },
    {
      executor: 'storedProc',
      enabled: bool(status.storedProc?.enabled),
      details: [{ key: 'allowedSchemasSize', value: count(status.storedProc?.allowedSchemasSize) }],
    },
  ]
}
