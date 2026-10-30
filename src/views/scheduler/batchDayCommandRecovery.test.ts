// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import {
  restoreBatchDayCommand,
  saveBatchDayCommand,
  clearBatchDayCommand,
  type BatchDayCommand,
} from './batchDayCommandRecovery'
describe('批次日未知命令恢复', () => {
  const command: BatchDayCommand = {
    kind: 'day',
    body: {
      tenantId: 'ta',
      calendarCode: 'CAL',
      bizDate: '2026-10-25',
      action: 'FREEZE',
      reason: 'review',
    },
    key: 'original-key',
    scope: 'admin-a\0ta\0CAL',
    createdAt: 1000,
    actor: 'admin-a',
  }
  beforeEach(() => sessionStorage.clear())
  it('刷新后恢复原键和原请求，并隔离租户与日历', () => {
    expect(saveBatchDayCommand(command)).toBe(true)
    expect(restoreBatchDayCommand(command.scope, sessionStorage, 2000)).toEqual({
      command,
      blocked: false,
    })
    expect(restoreBatchDayCommand('admin-a\0tb\0CAL', sessionStorage, 2000)).toEqual({
      command: null,
      blocked: false,
    })
    expect(clearBatchDayCommand(command)).toBe(true)
    expect(restoreBatchDayCommand(command.scope)).toEqual({ command: null, blocked: false })
  })
  it('损坏、身份不匹配或过期记录不生成替代键，也不删除原证据', () => {
    const key = STORAGE_KEYS.batchDayGovernanceRecoveryPrefix + encodeURIComponent(command.scope)
    sessionStorage.setItem(key, '{broken')
    expect(restoreBatchDayCommand(command.scope).blocked).toBe(true)
    expect(sessionStorage.getItem(key)).toBe('{broken')
    saveBatchDayCommand(command)
    expect(
      restoreBatchDayCommand(command.scope, sessionStorage, 1000 + 24 * 3600 * 1000).blocked,
    ).toBe(true)
    saveBatchDayCommand({ ...command, body: { ...command.body, tenantId: 'tb' } })
    expect(restoreBatchDayCommand(command.scope, sessionStorage, 2000).blocked).toBe(true)
  })
  it('存储不可用时明确阻断恢复和写入，不默默发送新请求', () => {
    const broken = {
      getItem() {
        throw new Error('unavailable')
      },
      setItem() {
        throw new Error('unavailable')
      },
      removeItem() {
        throw new Error('unavailable')
      },
    } as unknown as Storage
    expect(saveBatchDayCommand(command, broken)).toBe(false)
    expect(restoreBatchDayCommand(command.scope, broken).blocked).toBe(true)
    expect(clearBatchDayCommand(command, broken)).toBe(false)
  })
  it('迟到的旧确认不删除同一范围内较新的恢复命令', () => {
    const newer = { ...command, key: 'newer-key' }
    saveBatchDayCommand(newer)
    expect(clearBatchDayCommand(command)).toBe(false)
    expect(restoreBatchDayCommand(command.scope, sessionStorage, 2000).command).toEqual(newer)
  })
})
