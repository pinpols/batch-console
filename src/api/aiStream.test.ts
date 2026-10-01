// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelAiChatStream, streamAiChat } from './aiStream'

function sseResponse(body: string): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body))
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  )
}

describe('streamAiChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.cookie = 'XSRF-TOKEN=token-1'
  })

  it('delivers partial text and the authoritative completion', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        sseResponse(
          'event: started\ndata: {"requestId":"r1"}\n\n' +
            'event: delta\ndata: {"text":"hello "}\n\n' +
            'event: delta\ndata: {"text":"world"}\n\n' +
            'event: completed\ndata: {"requestId":"r1","answer":"hello world","promptDecision":"APPROVED"}\n\n',
        ),
      )
    const onStarted = vi.fn()
    const onDelta = vi.fn()
    const result = await streamAiChat(
      { tenantId: 't1', contextVersion: 'v1', prompt: 'question' },
      { onStarted, onDelta },
      new AbortController().signal,
    )
    expect(onStarted).toHaveBeenCalledWith('r1')
    expect(onDelta.mock.calls).toEqual([['hello '], ['world']])
    expect(result.answer).toBe('hello world')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', method: 'POST' })
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      'X-Tenant-Id': 't1',
      'X-XSRF-TOKEN': 'token-1',
    })
  })

  it('rejects a truncated stream and a failed event', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(sseResponse('event: delta\ndata: {"text":"partial"}\n\n'))
    await expect(
      streamAiChat(
        { tenantId: 't1', contextVersion: 'v1', prompt: 'q' },
        { onStarted() {}, onDelta() {} },
        new AbortController().signal,
      ),
    ).rejects.toThrow('before completion')
    fetchMock.mockResolvedValueOnce(
      sseResponse('event: failed\ndata: {"code":"STREAM_FAILED"}\n\n'),
    )
    await expect(
      streamAiChat(
        { tenantId: 't1', contextVersion: 'v1', prompt: 'q' },
        { onStarted() {}, onDelta() {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'STREAM_FAILED' })
  })

  it('posts a stop request for the active stream', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }))
    await cancelAiChatStream('r1', 't1')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/console/ai/chat/stream/r1/cancel')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', method: 'POST' })
  })
})
