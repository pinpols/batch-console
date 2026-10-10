import { EventSourceParserStream } from 'eventsource-parser/stream'
import { createIdempotencyKey } from '@/utils/idempotency'
import { LOCALE_STORAGE_KEY } from '@/constants/locale'
import type { AiChatRequest, AiChatResponse } from '@/types/console-api'

interface StreamCallbacks {
  onStarted(requestId: string): void
  onDelta(text: string): void
}

type StreamError = Error & {
  code?: string
  response?: { status: number; data?: { code?: string } }
}

function apiUrl(path: string): string {
  const base =
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
      : ''
  return `${base}${path}`
}

function xsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  if (!match) return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function headers(tenantId: string): HeadersInit {
  const locale = localStorage.getItem(LOCALE_STORAGE_KEY)
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
    'X-XSRF-TOKEN': xsrfToken(),
    'Idempotency-Key': createIdempotencyKey(),
    'Accept-Language': locale === 'en-US' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9',
  }
}

async function responseError(response: Response): Promise<StreamError> {
  const payload = (await response.json().catch(() => ({}))) as { code?: string }
  const error = new Error('AI stream request failed') as StreamError
  error.response = { status: response.status, data: payload }
  return error
}

export async function streamAiChat(
  body: AiChatRequest,
  callbacks: StreamCallbacks,
  signal: AbortSignal,
): Promise<AiChatResponse> {
  const response = await fetch(apiUrl('/api/console/ai/chat/stream'), {
    method: 'POST',
    credentials: 'include',
    headers: { ...headers(body.tenantId ?? ''), Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) throw await responseError(response)
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error('AI stream response is unavailable')
  }

  const events = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream({ maxBufferSize: 64 * 1024, onError: 'terminate' }))
  const reader = events.getReader()
  let completed: AiChatResponse | undefined
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const data = JSON.parse(value.data) as Record<string, unknown>
      switch (value.event) {
        case 'started':
          if (typeof data.requestId === 'string') callbacks.onStarted(data.requestId)
          break
        case 'delta':
          if (typeof data.text === 'string') callbacks.onDelta(data.text)
          break
        case 'completed':
          completed = data as AiChatResponse
          break
        case 'failed': {
          const error = new Error('AI stream failed') as StreamError
          error.code = typeof data.code === 'string' ? data.code : 'STREAM_FAILED'
          throw error
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  if (!completed) throw new Error('AI stream ended before completion')
  return completed
}

export async function cancelAiChatStream(requestId: string, tenantId: string): Promise<void> {
  const response = await fetch(
    apiUrl(`/api/console/ai/chat/stream/${encodeURIComponent(requestId)}/cancel`),
    { method: 'POST', credentials: 'include', headers: headers(tenantId) },
  )
  if (!response.ok && response.status !== 404) throw await responseError(response)
}
