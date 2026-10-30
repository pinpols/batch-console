import { describe, expect, it } from 'vitest'
import { atomicRuntimeRows } from './atomicRuntimeModel'
describe('Atomic实际运行门控展示', () => {
  it('不可用时即使混有executor字段也不展示为真实状态', () => {
    expect(atomicRuntimeRows({ available: false, shell: { enabled: true } })).toEqual([])
  })
  it('缺少开关保持未知，不借用静态schema默认值或把未知当false', () => {
    const rows = atomicRuntimeRows({ available: true })
    expect(rows.map((row) => row.enabled)).toEqual([null, null, null, null])
    expect(rows[0]!.details[0]!.value).toBeNull()
  })
  it('只呈现实际开关、安全门控计数与来源，零计数不会丢失', () => {
    const rows = atomicRuntimeRows({
      available: true,
      shell: { enabled: false, commandWhitelistSize: 0 },
      sql: { enabled: true, dialect: 'PostgreSQL' },
      http: {
        enabled: true,
        enforceAllowlist: true,
        enforceAllowlistSource: 'prod-default',
        allowlistHostsSize: 3,
      },
      storedProc: { enabled: false, allowedSchemasSize: 0 },
    })
    expect(rows.map((row) => row.enabled)).toEqual([false, true, true, false])
    expect(rows[0]!.details[0]!.value).toBe(0)
    expect(rows[2]!.details.map((detail) => detail.value)).toEqual([true, 'prod-default', 3])
  })
})
