import { ref } from 'vue'
import { cancelAiChatStream, streamAiChat } from '@/api/aiStream'
import { useTenantStore } from '@/stores/tenant'
import type { AiTurn } from '@/api/ai'
import type { AiChatResponse } from '@/types/console-api'
import { aiPromptWithAttachment, type AiTextAttachment } from '@/utils/aiTextAttachment'

type PromptDecision = AiChatResponse['promptDecision'] | 'REJECTED_BUDGET'
type SendErrorKey =
  | 'aiChat.sendError'
  | 'aiChat.sendRateLimited'
  | 'aiChat.sendForbidden'
  | 'aiChat.sendSessionExpired'
  | 'aiChat.sendUnavailable'
  | 'aiChat.sendTimeout'
  | 'aiChat.attachmentTooLarge'

function sendErrorKeyFor(error: unknown): SendErrorKey {
  if (!error || typeof error !== 'object') return 'aiChat.sendError'
  const result = error as {
    rateLimited?: boolean
    code?: string
    response?: { status?: number; data?: { code?: string } }
  }
  const status = result.response?.status
  const code = result.response?.data?.code
  if (
    result.rateLimited ||
    status === 429 ||
    code === 'RATE_LIMITED' ||
    result.code === 'RATE_LIMITED'
  )
    return 'aiChat.sendRateLimited'
  if (status === 403 || code === 'FORBIDDEN' || result.code === 'FORBIDDEN')
    return 'aiChat.sendForbidden'
  if (status === 404 || code === 'NOT_FOUND' || result.code === 'NOT_FOUND')
    return 'aiChat.sendSessionExpired'
  if (status === 503 || code === 'SERVICE_UNAVAILABLE' || result.code === 'SERVICE_UNAVAILABLE')
    return 'aiChat.sendUnavailable'
  if (result.code === 'STREAM_FAILED') return 'aiChat.sendUnavailable'
  if (result.code === 'ECONNABORTED' || result.code === 'ETIMEDOUT' || status === 504)
    return 'aiChat.sendTimeout'
  return 'aiChat.sendError'
}

function persistedDecision(value: string | null): PromptDecision | undefined {
  switch (value) {
    case 'APPROVED':
    case 'REJECTED_SCOPE':
    case 'REJECTED_AUTH':
    case 'REJECTED_DISABLED':
    case 'REJECTED_SAFETY':
    case 'REJECTED_BUDGET':
    case 'FAILED':
      return value
    default:
      return undefined
  }
}

function withoutInlineSources(answer: string, sources: AiChatResponse['sources']): string {
  if (!sources.length) return answer
  const suffix = `\n\n参考来源:${sources.map((item) => item.source).join(', ')}`
  return answer.endsWith(suffix) ? answer.slice(0, -suffix.length) : answer
}

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  decision?: PromptDecision
  refusalReason?: string | null
  modelName?: string
  sources?: AiChatResponse['sources']
  status?: AiTurn['status']
}

export function useAiChatSession() {
  const tenant = useTenantStore()
  const prompt = ref('')
  const sending = ref(false)
  const sendError = ref(false)
  const sendErrorKey = ref<SendErrorKey>('aiChat.sendError')
  const sessionId = ref('')
  const messages = ref<AiChatMessage[]>([])
  const attachment = ref<AiTextAttachment | null>(null)
  let generation = 0
  let activeController: AbortController | null = null
  let activeRequestId = ''
  let activeTenantId = ''
  let stopped = false

  function reset() {
    generation += 1
    stop()
    prompt.value = ''
    attachment.value = null
    sending.value = false
    sessionId.value = ''
    messages.value = []
    sendError.value = false
    sendErrorKey.value = 'aiChat.sendError'
  }

  function stop() {
    if (!activeController) return
    stopped = true
    if (activeRequestId) {
      void cancelAiChatStream(activeRequestId, activeTenantId).catch(() => undefined)
    }
    activeController.abort()
  }

  function turnMessages(turns: AiTurn[], emptyAnswer: string): AiChatMessage[] {
    return [...turns].reverse().flatMap((turn) => [
      { id: `${turn.turnNo}-u`, role: 'user' as const, content: turn.prompt },
      {
        id: `${turn.turnNo}-a`,
        role: 'assistant' as const,
        content: turn.response || (turn.status === 'COMPLETE' ? emptyAnswer : ''),
        decision: persistedDecision(turn.promptDecision),
        modelName: turn.modelName || undefined,
        status: turn.status,
      },
    ])
  }

  function restore(id: string, turns: AiTurn[], emptyAnswer: string) {
    sessionId.value = id
    messages.value = turnMessages(turns, emptyAnswer)
  }

  function prepend(turns: AiTurn[], emptyAnswer: string) {
    messages.value = [...turnMessages(turns, emptyAnswer), ...messages.value]
  }

  async function send(
    emptyAnswer: string,
    pageType?: string,
    stoppedAnswer = emptyAnswer,
  ): Promise<boolean> {
    const draft = prompt.value
    const content = draft.trim()
    if (!content || sending.value) return false
    let requestPrompt: string
    try {
      requestPrompt = aiPromptWithAttachment(content, attachment.value)
    } catch {
      sendError.value = true
      sendErrorKey.value = 'aiChat.attachmentTooLarge'
      return false
    }
    const requestGeneration = generation
    const tenantId = tenant.tenantId
    const userMessage: AiChatMessage = { id: `${Date.now()}-u`, role: 'user', content }
    const pendingMessage: AiChatMessage = {
      id: `${Date.now()}-a`,
      role: 'assistant',
      content: '',
      status: 'IN_PROGRESS',
    }
    messages.value.push(userMessage, pendingMessage)
    const assistantMessage = messages.value[messages.value.length - 1]
    sending.value = true
    activeController = new AbortController()
    activeRequestId = ''
    activeTenantId = tenantId
    stopped = false
    sendError.value = false
    sendErrorKey.value = 'aiChat.sendError'
    try {
      const res = await streamAiChat(
        {
          tenantId,
          contextVersion: 'v1',
          prompt: requestPrompt,
          sessionId: sessionId.value || undefined,
          ...(pageType ? { pageContext: { pageType } } : {}),
        },
        {
          onStarted(requestId) {
            if (requestGeneration !== generation || tenant.tenantId !== tenantId) return
            activeRequestId = requestId
          },
          onDelta(delta) {
            if (requestGeneration !== generation || tenant.tenantId !== tenantId) return
            assistantMessage.content += delta
          },
        },
        activeController.signal,
      )
      if (requestGeneration !== generation || tenant.tenantId !== tenantId) return false
      if (res.sessionId) sessionId.value = res.sessionId
      assistantMessage.id = res.requestId
      const sources = res.sources ?? []
      assistantMessage.content = withoutInlineSources(res.answer || emptyAnswer, sources)
      assistantMessage.decision = res.promptDecision
      assistantMessage.refusalReason = res.refusalReason
      assistantMessage.modelName = res.modelName ?? undefined
      assistantMessage.sources = sources
      assistantMessage.status = res.promptDecision === 'APPROVED' ? 'COMPLETE' : 'FAILED'
      if (res.promptDecision === 'APPROVED' && prompt.value === draft) {
        prompt.value = ''
        attachment.value = null
      }
      return true
    } catch (error) {
      if (requestGeneration !== generation || tenant.tenantId !== tenantId) return false
      if (stopped) {
        assistantMessage.content = stoppedAnswer
        assistantMessage.decision = 'FAILED'
        assistantMessage.status = 'FAILED'
        return false
      }
      if (assistantMessage.content) {
        assistantMessage.content = ''
        assistantMessage.decision = 'FAILED'
        assistantMessage.status = 'FAILED'
      } else {
        messages.value = messages.value.filter(
          (message) => message.id !== userMessage.id && message.id !== assistantMessage.id,
        )
      }
      sendError.value = true
      sendErrorKey.value = sendErrorKeyFor(error)
      return false
    } finally {
      if (requestGeneration === generation) {
        sending.value = false
        activeController = null
        activeRequestId = ''
        activeTenantId = ''
      }
    }
  }

  return {
    prompt,
    sending,
    sendError,
    sendErrorKey,
    sessionId,
    messages,
    attachment,
    reset,
    restore,
    prepend,
    send,
    stop,
  }
}
