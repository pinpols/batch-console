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
    expect(chat.sendErrorKey.value).toBe('aiChat.sendError')
  })

  it.each([
    [{ rateLimited: true }, 'aiChat.sendRateLimited'],
    [{ response: { status: 429, data: { code: 'RATE_LIMITED' } } }, 'aiChat.sendRateLimited'],
    [{ response: { status: 403, data: { code: 'FORBIDDEN' } } }, 'aiChat.sendForbidden'],
    [
      { response: { status: 503, data: { code: 'SERVICE_UNAVAILABLE' } } },
      'aiChat.sendUnavailable',
    ],
    [{ code: 'ECONNABORTED' }, 'aiChat.sendTimeout'],
  ] as const)('maps a failed send to %s', async (error, expectedKey) => {
    mockedChat.mockRejectedValue(error)
    const chat = useAiChatSession()
    chat.prompt.value = 'Retry me'

    expect(await chat.send('Empty')).toBe(false)
    expect(chat.sendErrorKey.value).toBe(expectedKey)
    expect(chat.prompt.value).toBe('Retry me')
  })

  it('keeps a new draft typed while the previous question is sending', async () => {
    let resolveResponse!: (value: Awaited<ReturnType<typeof chatWithAi>>) => void
    mockedChat.mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve
      }),
    )
    const chat = useAiChatSession()
    chat.prompt.value = 'First question'
    const pending = chat.send('Empty')
    chat.prompt.value = 'Next question'
    resolveResponse({
      requestId: 'r1',
      traceId: 't1',
      sessionId: 's1',
      promptCategory: 'OPERATIONS',
      promptDecision: 'APPROVED',
      modelName: 'test',
      answer: 'First answer',
      refusalReason: null,
    })

    expect(await pending).toBe(true)
    expect(chat.prompt.value).toBe('Next question')
    expect(chat.messages.value.map((message) => message.content)).toEqual([
      'First question',
      'First answer',
    ])
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

  it('restores the server decision on rejected and failed turns', () => {
    const chat = useAiChatSession()
    const time = '2026-09-30T00:00:00Z'
    const turn = (turnNo: number, status: 'REJECTED' | 'FAILED', promptDecision: string) => ({
      turnNo,
      contextVersion: 'v1' as const,
      prompt: `question ${turnNo}`,
      response: null,
      status,
      promptDecision,
      modelName: null,
      promptTokens: null,
      completionTokens: null,
      estimatedCostUsd: null,
      createdAt: time,
      completedAt: time,
    })
    chat.restore(
      'session-1',
      [
        turn(3, 'REJECTED', 'UNKNOWN'),
        turn(2, 'FAILED', 'FAILED'),
        turn(1, 'REJECTED', 'REJECTED_BUDGET'),
      ],
      'No answer',
    )

    expect(
      chat.messages.value
        .filter((message) => message.role === 'assistant')
        .map((message) => message.decision),
    ).toEqual(['REJECTED_BUDGET', 'FAILED', undefined])
  })
})
