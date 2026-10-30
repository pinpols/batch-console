// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { apiClient } from './client'
import { republishOutbox } from './ops'

const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('Outbox 重投请求精度', () => {
  it('通过实际 Axios 序列化发送精确的 64 位数字数组', async () => {
    let sent: unknown
    apiClient.defaults.adapter = async (config) => {
      sent = config.data
      return {
        data: { code: 'SUCCESS', data: { tenantId: 't1', requestedCount: 2, resetCount: 2 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    await republishOutbox('t1', ['9007199254740993', '9223372036854775807'])
    expect(sent).toBe('[9007199254740993,9223372036854775807]')
  })

  it('拒绝已丢失精度的数字和超出 Long 范围的字符串', async () => {
    let calls = 0
    apiClient.defaults.adapter = async (config) => {
      calls += 1
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }
    await expect(republishOutbox('t1', [9007199254740992])).rejects.toThrow()
    await expect(republishOutbox('t1', ['9223372036854775808'])).rejects.toThrow()
    expect(calls).toBe(0)
  })
})
