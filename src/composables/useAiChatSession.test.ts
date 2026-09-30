// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { chatWithAi } from '@/api/system'
import { useTenantStore } from '@/stores/tenant'
import { useAiChatSession } from './useAiChatSession'

vi.mock('@/api/system', () => ({ chatWithAi: vi.fn() }))

const mockedChat = vi.mocked(chatWithAi)

describe('useAiChatSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTenantStore().setTenantId('ta')
    mockedChat.mockReset()
  })

  it('sends versioned, allowlisted page context without object IDs', async () => {
    mockedChat.mockResolvedValue({
      requestId: 'r1',
      traceId: 't1',
      sessionId: 's1',
      promptCategory: 'OPERATIONS',
      promptDecision: 'APPROVED',
      modelName: 'test',
      answer: 'result',
      refusalReason: null,
    })
    const chat = useAiChatSession()
    chat.prompt.value = 'What happened?'

    expect(await chat.send('Empty', 'job-instance')).toBe(true)
    expect(mockedChat).toHaveBeenCalledWith({
      tenantId: 'ta',
      contextVersion: 'v1',
      prompt: 'What happened?',
      sessionId: undefined,
      pageContext: { pageType: 'job-instance' },
    })
    expect(chat.sessionId.value).toBe('s1')
    expect(chat.messages.value.map((item) => item.content)).toEqual(['What happened?', 'result'])
  })

  it('retains the draft and removes the optimistic message on failure', async () => {
    mockedChat.mockRejectedValue(new Error('unavailable'))
    const chat = useAiChatSession()
    chat.prompt.value = 'Retry me'

    expect(await chat.send('Empty')).toBe(false)
    expect(chat.prompt.value).toBe('Retry me')
    expect(chat.messages.value).toEqual([])
    expect(chat.sendError.value).toBe(true)
  })

  it('does not render a previous tenant response after reset', async () => {
    let resolveResponse!: (value: Awaited<ReturnType<typeof chatWithAi>>) => void
    mockedChat.mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve
      }),
    )
    const chat = useAiChatSession()
    chat.prompt.value = 'tenant A question'
    const pending = chat.send('Empty')

    useTenantStore().setTenantId('tb')
    chat.reset()
    resolveResponse({
      requestId: 'r1',
      traceId: 't1',
      sessionId: 's1',
      promptCategory: 'OPERATIONS',
      promptDecision: 'APPROVED',
      modelName: 'test',
      answer: 'tenant A answer',
      refusalReason: null,
    })

    expect(await pending).toBe(false)
    expect(chat.messages.value).toEqual([])
    expect(chat.prompt.value).toBe('')
    expect(chat.sessionId.value).toBe('')
  })

  it('keeps persisted turn status distinct from an empty successful answer', () => {
    const chat = useAiChatSession()
    const time = '2026-09-30T00:00:00Z'
    const turn = (turnNo: number, status: 'IN_PROGRESS' | 'FAILED' | 'COMPLETE') => ({
      turnNo,
      contextVersion: 'v1' as const,
      prompt: `question ${turnNo}`,
      response: null,
      status,
      promptDecision: null,
      modelName: null,
      promptTokens: null,
      completionTokens: null,
      estimatedCostUsd: null,
      createdAt: time,
      completedAt: null,
    })
    chat.restore(
      'session-1',
      [turn(3, 'IN_PROGRESS'), turn(2, 'FAILED'), turn(1, 'COMPLETE')],
      'No answer',
    )

    expect(chat.messages.value.filter((message) => message.role === 'assistant')).toEqual([
      expect.objectContaining({ content: 'No answer', status: 'COMPLETE' }),
      expect.objectContaining({ content: '', status: 'FAILED' }),
      expect.objectContaining({ content: '', status: 'IN_PROGRESS' }),
    ])
  })
})
