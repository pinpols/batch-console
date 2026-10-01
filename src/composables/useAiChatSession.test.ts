// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { cancelAiChatStream, streamAiChat } from '@/api/aiStream'
import { deleteAiAttachment, getAiCapabilities, uploadAiAttachment } from '@/api/ai'
import { useTenantStore } from '@/stores/tenant'
import { useAiChatSession } from './useAiChatSession'

vi.mock('@/api/aiStream', () => ({ streamAiChat: vi.fn(), cancelAiChatStream: vi.fn() }))
vi.mock('@/api/ai', () => ({
  deleteAiAttachment: vi.fn(),
  getAiCapabilities: vi.fn(),
  getAiAttachmentByClientId: vi.fn(),
  getAiTurnByClientId: vi.fn(),
  uploadAiAttachment: vi.fn(),
}))

const mockedChat = vi.mocked(streamAiChat)
const mockedCancel = vi.mocked(cancelAiChatStream)
const mockedCapabilities = vi.mocked(getAiCapabilities)
const mockedUpload = vi.mocked(uploadAiAttachment)
const mockedDelete = vi.mocked(deleteAiAttachment)

describe('useAiChatSession', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTenantStore().setTenantId('ta')
    mockedChat.mockReset()
    mockedCancel.mockReset()
    mockedCancel.mockResolvedValue()
    mockedCapabilities.mockReset()
    mockedUpload.mockReset()
    mockedDelete.mockReset()
    mockedDelete.mockResolvedValue()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('sends uploaded images by stable IDs and releases the local preview', async () => {
    mockedCapabilities.mockResolvedValue({
      imageInput: true,
      maxImages: 4,
      maxImageBytes: 1024,
      maxTotalBytes: 4096,
    })
    mockedUpload.mockImplementation(async (_file, clientAttachmentId) => ({
      id: 'attachment-1',
      clientAttachmentId,
      status: 'DRAFT',
      mediaType: 'image/png',
      byteSize: 4,
      width: 1,
      height: 1,
      expiresAt: '2026-10-02T00:00:00Z',
    }))
    mockedChat.mockResolvedValue({
      requestId: 'r1',
      traceId: 't1',
      sessionId: 's1',
      promptCategory: 'OPERATIONS',
      promptDecision: 'APPROVED',
      modelName: 'test',
      answer: 'Image answer',
      refusalReason: null,
      sources: [],
    })
    const chat = useAiChatSession()
    await chat.loadImageCapabilities()
    await chat.addImages([new File(['data'], 'screen.png', { type: 'image/png' })])
    expect(chat.images.value[0]?.status).toBe('ready')
    chat.prompt.value = 'What is shown?'

    expect(await chat.send('Empty')).toBe(true)
    expect(mockedChat).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentIds: ['attachment-1'],
        clientTurnId: expect.any(String),
      }),
      expect.any(Object),
      expect.any(AbortSignal),
    )
    expect(chat.messages.value[0]?.images?.[0]?.id).toBe('attachment-1')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
  })

  it('reports image validation errors without using the text attachment length message', async () => {
    mockedCapabilities.mockResolvedValue({
      imageInput: true,
      maxImages: 4,
      maxImageBytes: 1024,
      maxTotalBytes: 4096,
    })
    const chat = useAiChatSession()
    await chat.loadImageCapabilities()
    await chat.addImages([new File(['test'], 'evidence.txt', { type: 'text/plain' })])

    expect(chat.sendErrorKey.value).toBe('aiChat.imageInvalid')
    expect(mockedUpload).not.toHaveBeenCalled()
  })

  it('deletes abandoned uploaded drafts when the session is cleared', async () => {
    mockedCapabilities.mockResolvedValue({
      imageInput: true,
      maxImages: 4,
      maxImageBytes: 1024,
      maxTotalBytes: 4096,
    })
    mockedUpload.mockImplementation(async (_file, clientAttachmentId) => ({
      id: 'attachment-1',
      clientAttachmentId,
      status: 'DRAFT',
      mediaType: 'image/png',
      byteSize: 4,
      width: 1,
      height: 1,
      expiresAt: '2026-10-02T00:00:00Z',
    }))
    const chat = useAiChatSession()
    await chat.loadImageCapabilities()
    await chat.addImages([new File(['data'], 'screen.png', { type: 'image/png' })])
    chat.reset(true)

    expect(mockedDelete).toHaveBeenCalledWith('attachment-1')
    expect(chat.images.value).toEqual([])
  })

  it('sends versioned, allowlisted page context without object IDs', async () => {
    mockedChat.mockResolvedValue({
      requestId: 'r1',
      traceId: 't1',
      sessionId: 's1',
      promptCategory: 'OPERATIONS',
      promptDecision: 'APPROVED',
      modelName: 'test',
      answer: 'result\n\n参考来源:operations.md',
      refusalReason: null,
      sources: [{ source: 'operations.md' }],
    })
    const chat = useAiChatSession()
    chat.prompt.value = 'What happened?'

    expect(await chat.send('Empty', 'job-instance')).toBe(true)
    expect(mockedChat).toHaveBeenCalledWith(
      {
        tenantId: 'ta',
        contextVersion: 'v1',
        prompt: 'What happened?',
        sessionId: undefined,
        pageContext: { pageType: 'job-instance' },
      },
      expect.objectContaining({ onStarted: expect.any(Function), onDelta: expect.any(Function) }),
      expect.any(AbortSignal),
    )
    expect(chat.sessionId.value).toBe('s1')
    expect(chat.messages.value.map((item) => item.content)).toEqual(['What happened?', 'result'])
    expect(chat.messages.value[1]?.sources).toEqual([{ source: 'operations.md' }])
  })

  it('keeps source references separate from an English answer', async () => {
    mockedChat.mockResolvedValue({
      requestId: 'r2',
      traceId: 't2',
      sessionId: 's2',
      promptCategory: 'OPERATIONS',
      promptDecision: 'APPROVED',
      modelName: 'test',
      answer: 'Result\n\nSources:operations.md',
      refusalReason: null,
      sources: [{ source: 'operations.md' }],
    })
    const chat = useAiChatSession()
    chat.prompt.value = 'What happened?'

    expect(await chat.send('Empty')).toBe(true)
    expect(chat.messages.value[1]?.content).toBe('Result')
    expect(chat.messages.value[1]?.sources).toEqual([{ source: 'operations.md' }])
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

  it('keeps the draft when the backend persists a failed model response', async () => {
    mockedChat.mockResolvedValue({
      requestId: 'r-failed',
      traceId: 't-failed',
      sessionId: 's-failed',
      promptCategory: 'OPERATIONS',
      promptDecision: 'FAILED',
      modelName: null,
      answer: 'AI is temporarily unavailable.',
      refusalReason: null,
      sources: [],
    })
    const chat = useAiChatSession()
    chat.prompt.value = 'Retry this question'

    expect(await chat.send('Empty')).toBe(true)
    expect(chat.prompt.value).toBe('Retry this question')
    expect(chat.sessionId.value).toBe('s-failed')
    expect(chat.messages.value[1]).toMatchObject({
      decision: 'FAILED',
      content: 'AI is temporarily unavailable.',
    })
  })

  it.each([
    [{ rateLimited: true }, 'aiChat.sendRateLimited'],
    [{ response: { status: 429, data: { code: 'RATE_LIMITED' } } }, 'aiChat.sendRateLimited'],
    [{ response: { status: 403, data: { code: 'FORBIDDEN' } } }, 'aiChat.sendForbidden'],
    [{ response: { status: 404, data: { code: 'NOT_FOUND' } } }, 'aiChat.sendSessionExpired'],
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
    let resolveResponse!: (value: Awaited<ReturnType<typeof streamAiChat>>) => void
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
      sources: [],
    })

    expect(await pending).toBe(true)
    expect(chat.prompt.value).toBe('Next question')
    expect(chat.messages.value.map((message) => message.content)).toEqual([
      'First question',
      'First answer',
    ])
  })

  it('keeps separate in-memory drafts for the current and another conversation', () => {
    const chat = useAiChatSession()
    chat.prompt.value = 'New conversation draft'
    chat.restore('s1', [], 'Empty')
    expect(chat.prompt.value).toBe('')

    chat.prompt.value = 'Existing conversation draft'
    chat.reset()
    expect(chat.prompt.value).toBe('New conversation draft')

    chat.restore('s1', [], 'Empty')
    expect(chat.prompt.value).toBe('Existing conversation draft')
    chat.reset(true)
    expect(chat.prompt.value).toBe('')
  })

  it('does not replace a newer draft when a sent question fails', async () => {
    let rejectResponse!: (reason: Error) => void
    mockedChat.mockReturnValue(new Promise((_resolve, reject) => (rejectResponse = reject)))
    const chat = useAiChatSession()
    chat.prompt.value = 'First question'
    const pending = chat.send('Empty')
    chat.prompt.value = 'Follow-up draft'
    rejectResponse(new Error('unavailable'))

    expect(await pending).toBe(false)
    expect(chat.prompt.value).toBe('Follow-up draft')
  })

  it('does not render a previous tenant response after reset', async () => {
    let resolveResponse!: (value: Awaited<ReturnType<typeof streamAiChat>>) => void
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
      sources: [],
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
      attachments: [],
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
      attachments: [],
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

  it('shows deltas before completion and replaces them with the audited final answer', async () => {
    let resolveResponse!: (value: Awaited<ReturnType<typeof streamAiChat>>) => void
    mockedChat.mockImplementation(
      (_body, callbacks) =>
        new Promise((resolve) => {
          resolveResponse = resolve
          callbacks.onStarted('request-1')
          callbacks.onDelta('partial ')
        }),
    )
    const chat = useAiChatSession()
    chat.prompt.value = 'Status?'
    const pending = chat.send('Empty')
    await vi.waitFor(() =>
      expect(chat.messages.value[1]).toMatchObject({ content: 'partial ', status: 'IN_PROGRESS' }),
    )
    resolveResponse({
      requestId: 'request-1',
      traceId: 'trace-1',
      sessionId: 'session-1',
      promptCategory: 'OPERATIONS',
      promptDecision: 'APPROVED',
      modelName: 'test',
      answer: 'partial answer',
      refusalReason: null,
      sources: [],
    })
    expect(await pending).toBe(true)
    expect(chat.messages.value[1]).toMatchObject({ content: 'partial answer', status: 'COMPLETE' })
  })

  it('cancels an active request and keeps the draft', async () => {
    mockedChat.mockImplementation(
      (_body, callbacks, signal) =>
        new Promise((_resolve, reject) => {
          callbacks.onStarted('request-1')
          signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')))
        }),
    )
    const chat = useAiChatSession()
    chat.prompt.value = 'Status?'
    const pending = chat.send('Empty', undefined, 'Stopped')
    chat.stop()
    expect(await pending).toBe(false)
    expect(mockedCancel).toHaveBeenCalledWith('request-1', 'ta')
    expect(chat.prompt.value).toBe('Status?')
    expect(chat.messages.value[1]).toMatchObject({ content: 'Stopped', status: 'FAILED' })
    expect(chat.sendError.value).toBe(false)
  })

  it('cancels the old stream and unlocks the composer when switching conversations', async () => {
    mockedChat.mockImplementation(
      (_body, callbacks, signal) =>
        new Promise((_resolve, reject) => {
          callbacks.onStarted('request-1')
          signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')))
        }),
    )
    const chat = useAiChatSession()
    chat.prompt.value = 'Old question'
    const pending = chat.send('Empty')

    chat.restore('new-session', [], 'Empty')

    expect(chat.sessionId.value).toBe('new-session')
    expect(chat.sending.value).toBe(false)
    expect(chat.messages.value).toEqual([])
    expect(mockedCancel).toHaveBeenCalledWith('request-1', 'ta')
    expect(await pending).toBe(false)
    expect(chat.messages.value).toEqual([])
  })
})
