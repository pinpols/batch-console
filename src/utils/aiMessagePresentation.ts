import type { AiChatMessage } from '@/composables/useAiChatSession'

const REJECTION_KEYS = {
  REJECTED_SCOPE: 'aiChat.rejection.scope',
  REJECTED_AUTH: 'aiChat.rejection.auth',
  REJECTED_DISABLED: 'aiChat.rejection.disabled',
  REJECTED_SAFETY: 'aiChat.rejection.safety',
  REJECTED_BUDGET: 'aiChat.rejection.budget',
} as const

export function aiMessageBody(message: AiChatMessage, translate: (key: string) => string): string {
  if (message.role !== 'assistant') return message.content
  if (message.decision && message.decision in REJECTION_KEYS) {
    return translate(REJECTION_KEYS[message.decision as keyof typeof REJECTION_KEYS])
  }
  if (message.decision === 'FAILED' || message.status === 'FAILED') {
    return translate('aiChat.turnFailed')
  }
  if (message.status === 'REJECTED') return translate('aiChat.turnRejected')
  if (message.status === 'IN_PROGRESS' && !message.content) return translate('aiChat.turnPending')
  return message.content
}
