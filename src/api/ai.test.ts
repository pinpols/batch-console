import { beforeEach, describe, expect, it, vi } from 'vitest'
import { del, get } from './client'
import { deleteAiConversation, listAiConversations, listAiTurns, pageAiConversations } from './ai'

vi.mock('./client', () => ({ get: vi.fn(), del: vi.fn() }))

const mockedGet = vi.mocked(get)
const mockedDel = vi.mocked(del)

describe('listAiConversations', () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedDel.mockReset()
  })

  it('uses the owner-scoped endpoint with a bounded limit', async () => {
    mockedGet.mockResolvedValue([])
    await listAiConversations({ limit: 20 })
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/ai/conversations',
      { limit: 20 },
      { _silent: true },
    )
  })

  it('passes the server cursor through the owner-scoped page endpoint', async () => {
    mockedGet.mockResolvedValue({
      items: [],
      total: 0,
      pageNo: 0,
      pageSize: 20,
      nextCursor: null,
      hasMore: false,
    })
    await pageAiConversations({ cursor: 'opaque-cursor', limit: 20 })
    expect(mockedGet).toHaveBeenCalledWith(
      '/api/console/ai/conversations/page',
      { cursor: 'opaque-cursor', limit: 20 },
      { _silent: true },
    )
  })

  it('encodes conversation IDs for history and deletion', async () => {
    mockedGet.mockResolvedValue([])
    mockedDel.mockResolvedValue(undefined)
    await listAiTurns('a/b', { beforeTurnNo: 10, limit: 50 })
    await deleteAiConversation('a/b')
    expect(mockedGet).toHaveBeenCalledWith('/api/console/ai/conversations/a%2Fb/turns', {
      beforeTurnNo: 10,
      limit: 50,
    })
    expect(mockedDel).toHaveBeenCalledWith('/api/console/ai/conversations/a%2Fb')
  })
})
