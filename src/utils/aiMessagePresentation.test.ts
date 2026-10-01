import { describe, expect, it } from 'vitest'
import { aiMessageBody } from './aiMessagePresentation'
import type { AiChatMessage } from '@/composables/useAiChatSession'

const translate = (key: string) => `translated:${key}`
const assistant = (overrides: Partial<AiChatMessage>): AiChatMessage => ({
  id: '1',
  role: 'assistant',
  content: 'persisted answer',
  ...overrides,
})

describe('aiMessageBody', () => {
  it('keeps approved answer content', () => {
    expect(aiMessageBody(assistant({ decision: 'APPROVED' }), translate)).toBe('persisted answer')
  })

  it('localizes persisted rejections without exposing their stored answer', () => {
    expect(aiMessageBody(assistant({ decision: 'REJECTED_SAFETY' }), translate)).toBe(
      'translated:aiChat.rejection.safety',
    )
  })

  it('localizes failed and pending responses', () => {
    expect(aiMessageBody(assistant({ decision: 'FAILED', status: 'FAILED' }), translate)).toBe(
      'translated:aiChat.turnFailed',
    )
    expect(aiMessageBody(assistant({ content: '', status: 'IN_PROGRESS' }), translate)).toBe(
      'translated:aiChat.turnPending',
    )
  })
})
