import { del, get } from './client'
import type { AxiosRequestConfig } from 'axios'
import type { components, operations } from '@/types/api.generated'

export type AiConversation = components['schemas']['ConsoleAiConversationView']
export type AiTurn = components['schemas']['ConsoleAiTurnView']
export type AiCostSummary = components['schemas']['ConsoleAiCostSummary']
type ConversationQuery = NonNullable<
  operations['listConsoleAiConversations']['parameters']['query']
>
type TurnsQuery = NonNullable<operations['listConsoleAiConversationTurns']['parameters']['query']>

export function listAiConversations(query: ConversationQuery = {}): Promise<AiConversation[]> {
  return get<AiConversation[]>('/api/console/ai/conversations', query, {
    _silent: true,
  } as AxiosRequestConfig)
}

export function listAiTurns(conversationId: string, query: TurnsQuery = {}): Promise<AiTurn[]> {
  return get<AiTurn[]>(
    `/api/console/ai/conversations/${encodeURIComponent(conversationId)}/turns`,
    query,
  )
}

export function deleteAiConversation(conversationId: string): Promise<void> {
  return del<void>(`/api/console/ai/conversations/${encodeURIComponent(conversationId)}`)
}

export function getAiCostSummary(month?: string): Promise<AiCostSummary> {
  return get<AiCostSummary>('/api/console/ai/cost-summary', month ? { month } : {})
}
