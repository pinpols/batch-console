import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  get: vi.fn(),
}))

import { get } from '@/api/client'
import { listAtomicTaskTypeSchemas } from './atomicTaskTypes'

const mockedGet = vi.mocked(get)

describe('listAtomicTaskTypeSchemas', () => {
  beforeEach(() => mockedGet.mockReset())

  it('normalizes a well-formed payload', async () => {
    mockedGet.mockResolvedValue([
      {
        taskType: 'sql',
        displayName: 'SQL 执行',
        enabledByDefault: true,
        parameters: [
          { name: 'sql', type: 'string', required: true, description: '待执行 SQL' },
        ],
        securityGates: [{ field: 'allowedDataSourceBeans', meaning: '只允许白名单内 DS' }],
      },
    ])
    const r = await listAtomicTaskTypeSchemas()
    expect(r).toHaveLength(1)
    expect(r[0].taskType).toBe('sql')
    expect(r[0].parameters[0].required).toBe(true)
    expect(r[0].securityGates[0].field).toBe('allowedDataSourceBeans')
  })

  it('fills sensible defaults when fields are missing', async () => {
    mockedGet.mockResolvedValue([{ taskType: 'shell' }])
    const [r] = await listAtomicTaskTypeSchemas()
    expect(r.displayName).toBe('shell')
    expect(r.enabledByDefault).toBe(true)
    expect(r.parameters).toEqual([])
    expect(r.securityGates).toEqual([])
  })

  it('returns empty array when payload is empty', async () => {
    mockedGet.mockResolvedValue([])
    await expect(listAtomicTaskTypeSchemas()).resolves.toEqual([])
  })

  it('handles per-item field shape variations', async () => {
    mockedGet.mockResolvedValue([
      {
        taskType: 'http',
        parameters: [{ name: 'url' }],
        securityGates: [{ field: 'blockedHostPatterns' }],
      },
    ])
    const [r] = await listAtomicTaskTypeSchemas()
    expect(r.parameters[0].type).toBe('string')
    expect(r.parameters[0].required).toBe(false)
    expect(r.securityGates[0].meaning).toBe('')
  })
})
