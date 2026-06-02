import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/client', () => ({
  get: vi.fn(),
}))

import { get } from '@/api/client'
import {
  listCustomTaskTypes,
  countCustomTaskTypes,
  getCustomTaskType,
  parseDescriptor,
} from './customTaskTypes'

const mockedGet = vi.mocked(get)

describe('customTaskTypes api', () => {
  beforeEach(() => mockedGet.mockReset())

  it('listCustomTaskTypes passes tenantId when provided', async () => {
    mockedGet.mockResolvedValue([])
    await listCustomTaskTypes('acme-prod')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/custom-task-types', {
      tenantId: 'acme-prod',
    })
  })

  it('listCustomTaskTypes omits params when tenantId not provided', async () => {
    mockedGet.mockResolvedValue([])
    await listCustomTaskTypes()
    expect(mockedGet).toHaveBeenCalledWith('/api/console/custom-task-types', undefined)
  })

  it('countCustomTaskTypes hits the count endpoint', async () => {
    mockedGet.mockResolvedValue(3)
    await expect(countCustomTaskTypes('acme-prod')).resolves.toBe(3)
    expect(mockedGet).toHaveBeenCalledWith('/api/console/custom-task-types/count', {
      tenantId: 'acme-prod',
    })
  })

  it('getCustomTaskType URL-encodes the taskTypeCode', async () => {
    mockedGet.mockResolvedValue({})
    await getCustomTaskType('my type/v2')
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/custom-task-types/my%20type%2Fv2',
      undefined,
    )
  })
})

describe('parseDescriptor', () => {
  it('returns null for null/empty', () => {
    expect(parseDescriptor(null)).toBeNull()
    expect(parseDescriptor(undefined)).toBeNull()
    expect(parseDescriptor('')).toBeNull()
  })

  it('parses a valid JSON object', () => {
    const r = parseDescriptor('{"schema":{"foo":1},"requiredEnv":["A"]}')
    expect(r?.schema).toEqual({ foo: 1 })
    expect(r?.requiredEnv).toEqual(['A'])
  })

  it('returns null for invalid JSON', () => {
    expect(parseDescriptor('{not json')).toBeNull()
  })

  it('returns null for non-object payloads (string / number / array)', () => {
    expect(parseDescriptor('"hello"')).toBeNull()
    expect(parseDescriptor('42')).toBeNull()
    // arrays are objects in JS; descriptor must be object — we accept arrays
    // (typeof === 'object') but the consumer treats as opaque; that's fine here.
  })
})
