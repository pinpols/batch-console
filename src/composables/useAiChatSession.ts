import { ref } from 'vue'
import { chatWithAi } from '@/api/system'
import { useTenantStore } from '@/stores/tenant'
import type { AiTurn } from '@/api/ai'
import type { AiChatResponse } from '@/types/console-api'

type PromptDecision = AiChatResponse['promptDecision'] | 'REJECTED_BUDGET'
type SendErrorKey =
  | 'aiChat.sendError'
  | 'aiChat.sendRateLimited'
  | 'aiChat.sendForbidden'
  | 'aiChat.sendSessionExpired'
  | 'aiChat.sendUnavailable'
  | 'aiChat.sendTimeout'

function sendErrorKeyFor(error: unknown): SendErrorKey {
  if (!error || typeof error !== 'object') return 'aiChat.sendError'
  const result = error as {
    rateLimited?: boolean
    code?: string
    response?: { status?: number; data?: { code?: string } }
  }
  const status = result.response?.status
  const code = result.response?.data?.code
  if (result.rateLimited || status === 429 || code === 'RATE_LIMITED')
    return 'aiChat.sendRateLimited'
  if (status === 403 || code === 'FORBIDDEN') return 'aiChat.sendForbidden'
  if (status === 404 || code === 'NOT_FOUND') return 'aiChat.sendSessionExpired'
  if (status === 503 || code === 'SERVICE_UNAVAILABLE') return 'aiChat.sendUnavailable'
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

export interface AiChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  decision?: PromptDecision
  refusalReason?: string | null
  modelName?: string
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
  let generation = 0

  function reset() {
    generation += 1
    prompt.value = ''
    sending.value = false
    sessionId.value = ''
    messages.value = []
    sendError.value = false
    sendErrorKey.value = 'aiChat.sendError'
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

  async function send(emptyAnswer: string, pageType?: string): Promise<boolean> {
    const draft = prompt.value
    const content = draft.trim()
    if (!content || sending.value) return false
    const requestGeneration = generation
    const tenantId = tenant.tenantId
    const userMessage: AiChatMessage = { id: `${Date.now()}-u`, role: 'user', content }
    messages.value.push(userMessage)
    sending.value = true
    sendError.value = false
    sendErrorKey.value = 'aiChat.sendError'
    try {
      const res = await chatWithAi({
        tenantId,
        contextVersion: 'v1',
        prompt: content,
        sessionId: sessionId.value || undefined,
        ...(pageType ? { pageContext: { pageType } } : {}),
      })
      if (requestGeneration !== generation || tenant.tenantId !== tenantId) return false
      if (res.sessionId) sessionId.value = res.sessionId
      messages.value.push({
        id: res.requestId,
        role: 'assistant',
        content: res.answer || emptyAnswer,
        decision: res.promptDecision,
        refusalReason: res.refusalReason,
        modelName: res.modelName,
      })
      if (prompt.value === draft) prompt.value = ''
      return true
    } catch (error) {
      if (requestGeneration !== generation || tenant.tenantId !== tenantId) return false
      messages.value = messages.value.filter((message) => message.id !== userMessage.id)
      sendError.value = true
      sendErrorKey.value = sendErrorKeyFor(error)
      return false
    } finally {
      if (requestGeneration === generation) sending.value = false
    }
  }

  return {
    prompt,
    sending,
    sendError,
    sendErrorKey,
    sessionId,
    messages,
    reset,
    restore,
    prepend,
    send,
  }
}
