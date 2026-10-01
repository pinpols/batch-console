import { del, get, post } from './client'
import type { AxiosRequestConfig } from 'axios'
import type { components, operations } from '@/types/api.generated'

export type AiConversation = components['schemas']['ConsoleAiConversationView']
export type AiConversationPage = components['schemas']['ConsoleAiConversationPageResponse']
export type AiTurn = components['schemas']['ConsoleAiTurnView']
export type AiCostSummary = components['schemas']['ConsoleAiCostSummary']
export type AiCapabilities = components['schemas']['ConsoleAiCapabilities']
export type AiAttachment = components['schemas']['ConsoleAiAttachmentView']
export type AiAttachmentSummary = components['schemas']['ConsoleAiAttachmentSummary']
export type AiClientTurn = components['schemas']['ConsoleAiClientTurnView']
type ConversationQuery = NonNullable<
  operations['listConsoleAiConversations']['parameters']['query']
>
type ConversationPageQuery = NonNullable<
  operations['pageConsoleAiConversations']['parameters']['query']
>
type TurnsQuery = NonNullable<operations['listConsoleAiConversationTurns']['parameters']['query']>

export function listAiConversations(query: ConversationQuery = {}): Promise<AiConversation[]> {
  return get<AiConversation[]>('/api/console/ai/conversations', query, {
    _silent: true,
  } as AxiosRequestConfig)
}

export function pageAiConversations(
  query: ConversationPageQuery = {},
): Promise<AiConversationPage> {
  return get<AiConversationPage>('/api/console/ai/conversations/page', query, {
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

export function getAiCapabilities(): Promise<AiCapabilities> {
  return get<AiCapabilities>('/api/console/ai/capabilities', {}, {
    _silent: true,
  } as AxiosRequestConfig)
}

export function uploadAiAttachment(file: File, clientAttachmentId: string): Promise<AiAttachment> {
  const form = new FormData()
  form.append('clientAttachmentId', clientAttachmentId)
  form.append('file', file)
  return post<AiAttachment>('/api/console/ai/attachments', form, {
    timeout: 60_000,
    _silent: true,
  } as AxiosRequestConfig)
}

export function getAiAttachmentByClientId(clientAttachmentId: string): Promise<AiAttachment> {
  return get<AiAttachment>(
    `/api/console/ai/attachments/by-client-id/${encodeURIComponent(clientAttachmentId)}`,
    {},
    { _silent: true } as AxiosRequestConfig,
  )
}

export function getAiAttachmentContent(id: string): Promise<Blob> {
  return get<Blob>(`/api/console/ai/attachments/${encodeURIComponent(id)}/content`, {}, {
    responseType: 'blob',
    _silent: true,
  } as AxiosRequestConfig)
}

export function deleteAiAttachment(id: string): Promise<void> {
  return del<void>(`/api/console/ai/attachments/${encodeURIComponent(id)}`)
}

export function getAiTurnByClientId(clientTurnId: string): Promise<AiClientTurn> {
  return get<AiClientTurn>(
    `/api/console/ai/turns/by-client-id/${encodeURIComponent(clientTurnId)}`,
    {},
    { _silent: true } as AxiosRequestConfig,
  )
}
