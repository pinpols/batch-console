import { ref } from 'vue'
import { chatWithAi } from '@/api/system'
import { useTenantStore } from '@/stores/tenant'
import type { AiTurn } from '@/api/ai'
import type { AiChatResponse } from '@/types/console-api'

type PromptDecision = AiChatResponse['promptDecision']

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
  }

  function turnMessages(turns: AiTurn[], emptyAnswer: string): AiChatMessage[] {
    return [...turns].reverse().flatMap((turn) => [
      { id: `${turn.turnNo}-u`, role: 'user' as const, content: turn.prompt },
      {
        id: `${turn.turnNo}-a`,
        role: 'assistant' as const,
        content: turn.response || (turn.status === 'COMPLETE' ? emptyAnswer : ''),
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
    const content = prompt.value.trim()
    if (!content || sending.value) return false
    const requestGeneration = generation
    const tenantId = tenant.tenantId
    const userMessage: AiChatMessage = { id: `${Date.now()}-u`, role: 'user', content }
    messages.value.push(userMessage)
    sending.value = true
    sendError.value = false
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
      prompt.value = ''
      return true
    } catch {
      if (requestGeneration !== generation || tenant.tenantId !== tenantId) return false
      messages.value = messages.value.filter((message) => message.id !== userMessage.id)
      sendError.value = true
      return false
    } finally {
      if (requestGeneration === generation) sending.value = false
    }
  }

  return { prompt, sending, sendError, sessionId, messages, reset, restore, prepend, send }
}
