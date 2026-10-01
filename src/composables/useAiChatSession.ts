import { ref } from 'vue'
import { cancelAiChatStream, streamAiChat } from '@/api/aiStream'
import { useTenantStore } from '@/stores/tenant'
import type { AiTurn } from '@/api/ai'
import {
  deleteAiAttachment,
  getAiAttachmentByClientId,
  getAiCapabilities,
  getAiTurnByClientId,
  uploadAiAttachment,
  type AiAttachmentSummary,
  type AiCapabilities,
} from '@/api/ai'
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
  | 'aiChat.imageUploadFailed'
  | 'aiChat.imageUploadRateLimited'
  | 'aiChat.imageInvalid'
  | 'aiChat.imageUploadUnavailable'
  | 'aiChat.imageUploadPending'
  | 'aiChat.imageStatusUnknown'

export interface AiImageDraft {
  clientAttachmentId: string
  id?: string
  name: string
  size: number
  previewUrl: string
  status: 'uploading' | 'ready' | 'failed'
  mediaType?: string
  width?: number
  height?: number
}

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

function imageUploadErrorKeyFor(error: unknown): SendErrorKey {
  if (!error || typeof error !== 'object') return 'aiChat.imageUploadFailed'
  const result = error as { response?: { status?: number; data?: { code?: string } } }
  const status = result.response?.status
  const code = result.response?.data?.code
  if (status === 429 || code === 'RATE_LIMITED') return 'aiChat.imageUploadRateLimited'
  if (status === 400 || code === 'INVALID_ARGUMENT') return 'aiChat.imageInvalid'
  if (status === 503 || code === 'SERVICE_UNAVAILABLE') return 'aiChat.imageUploadUnavailable'
  return 'aiChat.imageUploadFailed'
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
  const names = sources.map((item) => item.source).join(', ')
  for (const label of ['参考来源:', 'Sources:']) {
    const suffix = `\n\n${label}${names}`
    if (answer.endsWith(suffix)) return answer.slice(0, -suffix.length)
  }
  return answer
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
  images?: AiAttachmentSummary[]
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
  const images = ref<AiImageDraft[]>([])
  const imageCapabilities = ref<AiCapabilities | null>(null)
  const pendingTurnId = ref('')
  const drafts = new Map<
    string,
    {
      prompt: string
      attachment: AiTextAttachment | null
      images: AiImageDraft[]
    }
  >()
  let generation = 0
  let activeController: AbortController | null = null
  let activeRequestId = ''
  let activeTenantId = ''
  let stopped = false
  let pendingDelta = ''
  let deltaFrame = 0

  function flushDelta(message: AiChatMessage) {
    if (deltaFrame) cancelAnimationFrame(deltaFrame)
    deltaFrame = 0
    if (pendingDelta) message.content += pendingDelta
    pendingDelta = ''
  }

  function rememberDraft() {
    drafts.set(sessionId.value, {
      prompt: prompt.value,
      attachment: attachment.value,
      images: images.value,
    })
  }

  function tracked(image: AiImageDraft) {
    return (
      images.value.includes(image) ||
      [...drafts.values()].some((draft) => draft.images.includes(image))
    )
  }

  async function loadImageCapabilities() {
    const tenantId = tenant.tenantId
    const result = await getAiCapabilities().catch(() => null)
    if (tenant.tenantId === tenantId) imageCapabilities.value = result
  }

  async function addImages(files: File[]) {
    const limits = imageCapabilities.value
    if (!limits?.imageInput || !files.length) return
    const tenantId = tenant.tenantId
    for (const file of files) {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > limits.maxImageBytes ||
        images.value.length >= limits.maxImages ||
        images.value.reduce((sum, item) => sum + item.size, 0) + file.size > limits.maxTotalBytes
      ) {
        sendError.value = true
        sendErrorKey.value = 'aiChat.attachmentTooLarge'
        break
      }
      const item: AiImageDraft = {
        clientAttachmentId: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        status: 'uploading',
      }
      images.value.push(item)
      try {
        const uploaded = await uploadAiAttachment(file, item.clientAttachmentId)
        if (tenant.tenantId !== tenantId) return
        if (!tracked(item)) {
          void deleteAiAttachment(uploaded.id).catch(() => undefined)
          return
        }
        item.id = uploaded.id
        item.mediaType = uploaded.mediaType ?? undefined
        item.width = uploaded.width ?? undefined
        item.height = uploaded.height ?? undefined
        item.status = uploaded.status === 'DRAFT' ? 'ready' : 'failed'
      } catch (error) {
        if (tenant.tenantId !== tenantId) return
        const found = await getAiAttachmentByClientId(item.clientAttachmentId).catch(() => null)
        if (tenant.tenantId !== tenantId) return
        if (found?.status === 'DRAFT') {
          if (!tracked(item)) {
            void deleteAiAttachment(found.id).catch(() => undefined)
            return
          }
          item.id = found.id
          item.mediaType = found.mediaType ?? undefined
          item.width = found.width ?? undefined
          item.height = found.height ?? undefined
          item.status = 'ready'
        } else {
          item.status = 'failed'
          sendError.value = true
          sendErrorKey.value = imageUploadErrorKeyFor(error)
        }
      }
    }
  }

  function removeImage(item: AiImageDraft) {
    images.value = images.value.filter((image) => image !== item)
    for (const draft of drafts.values()) {
      draft.images = draft.images.filter((image) => image !== item)
    }
    URL.revokeObjectURL(item.previewUrl)
    if (item.id && item.status === 'ready') {
      void deleteAiAttachment(item.id).catch(() => undefined)
    }
  }

  function reset(clearDrafts = false) {
    if (!clearDrafts) rememberDraft()
    generation += 1
    stop()
    if (deltaFrame) cancelAnimationFrame(deltaFrame)
    deltaFrame = 0
    pendingDelta = ''
    if (clearDrafts) {
      const abandoned = new Set([
        ...images.value,
        ...[...drafts.values()].flatMap((draft) => draft.images),
      ])
      for (const image of abandoned) {
        URL.revokeObjectURL(image.previewUrl)
        if (image.id && image.status === 'ready') {
          void deleteAiAttachment(image.id).catch(() => undefined)
        }
      }
      drafts.clear()
      imageCapabilities.value = null
    }
    prompt.value = clearDrafts ? '' : (drafts.get('')?.prompt ?? '')
    attachment.value = clearDrafts ? null : (drafts.get('')?.attachment ?? null)
    images.value = clearDrafts ? [] : (drafts.get('')?.images ?? [])
    pendingTurnId.value = ''
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
      {
        id: `${turn.turnNo}-u`,
        role: 'user' as const,
        content: turn.prompt,
        images: turn.attachments ?? [],
      },
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
    rememberDraft()
    stop()
    generation += 1
    if (deltaFrame) cancelAnimationFrame(deltaFrame)
    deltaFrame = 0
    pendingDelta = ''
    activeController = null
    activeRequestId = ''
    activeTenantId = ''
    sending.value = false
    sessionId.value = id
    const draft = drafts.get(id)
    prompt.value = draft?.prompt ?? ''
    attachment.value = draft?.attachment ?? null
    images.value = draft?.images ?? []
    messages.value = turnMessages(turns, emptyAnswer)
    sendError.value = false
    pendingTurnId.value = ''
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
    if (!content || sending.value || pendingTurnId.value) return false
    if (images.value.some((image) => image.status !== 'ready' || !image.id)) {
      sendError.value = true
      sendErrorKey.value = 'aiChat.imageUploadPending'
      return false
    }
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
    const sentAttachment = attachment.value
    const sentImages = images.value
    const clientTurnId = sentImages.length ? crypto.randomUUID() : ''
    const userMessage: AiChatMessage = {
      id: `${Date.now()}-u`,
      role: 'user',
      content,
      images: sentImages
        .filter((image) => image.id)
        .map((image) => ({
          id: image.id!,
          mediaType: image.mediaType ?? 'image/png',
          byteSize: image.size,
          width: image.width ?? 0,
          height: image.height ?? 0,
        })),
    }
    const pendingMessage: AiChatMessage = {
      id: `${Date.now()}-a`,
      role: 'assistant',
      content: '',
      status: 'IN_PROGRESS',
    }
    messages.value.push(userMessage, pendingMessage)
    const assistantMessage = messages.value[messages.value.length - 1]
    sending.value = true
    prompt.value = ''
    attachment.value = null
    images.value = []
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
          ...(clientTurnId
            ? {
                clientTurnId,
                attachmentIds: sentImages.map((image) => image.id!),
              }
            : {}),
          ...(pageType ? { pageContext: { pageType } } : {}),
        },
        {
          onStarted(requestId) {
            if (requestGeneration !== generation || tenant.tenantId !== tenantId) return
            activeRequestId = requestId
          },
          onDelta(delta) {
            if (requestGeneration !== generation || tenant.tenantId !== tenantId) return
            pendingDelta += delta
            if (!deltaFrame) {
              deltaFrame = requestAnimationFrame(() => flushDelta(assistantMessage))
            }
          },
        },
        activeController.signal,
      )
      if (requestGeneration !== generation || tenant.tenantId !== tenantId) return false
      flushDelta(assistantMessage)
      if (res.sessionId) sessionId.value = res.sessionId
      assistantMessage.id = res.requestId
      const sources = res.sources ?? []
      assistantMessage.content = withoutInlineSources(res.answer || emptyAnswer, sources)
      assistantMessage.decision = res.promptDecision
      assistantMessage.refusalReason = res.refusalReason
      assistantMessage.modelName = res.modelName ?? undefined
      assistantMessage.sources = sources
      assistantMessage.status = res.promptDecision === 'APPROVED' ? 'COMPLETE' : 'FAILED'
      if (res.promptDecision !== 'APPROVED' && !prompt.value && !attachment.value) {
        prompt.value = draft
        attachment.value = sentAttachment
      }
      sentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
      return true
    } catch (error) {
      if (requestGeneration !== generation || tenant.tenantId !== tenantId) return false
      flushDelta(assistantMessage)
      if (clientTurnId) {
        const persisted = await getAiTurnByClientId(clientTurnId).catch(() => null)
        if (requestGeneration !== generation || tenant.tenantId !== tenantId) return false
        if (persisted) {
          sessionId.value = persisted.sessionId
          assistantMessage.content = persisted.turn.response ?? ''
          assistantMessage.status = persisted.turn.status
          assistantMessage.decision = persistedDecision(persisted.turn.promptDecision ?? null)
          assistantMessage.modelName = persisted.turn.modelName ?? undefined
          sentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
          if (persisted.turn.status === 'IN_PROGRESS') {
            pendingTurnId.value = clientTurnId
            sendError.value = true
            sendErrorKey.value = 'aiChat.imageStatusUnknown'
          }
          return persisted.turn.status === 'COMPLETE'
        }
        pendingTurnId.value = clientTurnId
        sendError.value = true
        sendErrorKey.value = 'aiChat.imageStatusUnknown'
        sentImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
        return false
      }
      if (stopped) {
        assistantMessage.content = stoppedAnswer
        assistantMessage.decision = 'FAILED'
        assistantMessage.status = 'FAILED'
        if (!prompt.value && !attachment.value) {
          prompt.value = draft
          attachment.value = sentAttachment
        }
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
      if (!prompt.value && !attachment.value) {
        prompt.value = draft
        attachment.value = sentAttachment
      }
      return false
    } finally {
      if (requestGeneration === generation) {
        flushDelta(assistantMessage)
        sending.value = false
        activeController = null
        activeRequestId = ''
        activeTenantId = ''
      }
    }
  }

  async function reconcileTurn() {
    if (!pendingTurnId.value) return
    const persisted = await getAiTurnByClientId(pendingTurnId.value).catch(() => null)
    if (!persisted) return
    sessionId.value = persisted.sessionId
    const assistant = messages.value.at(-1)
    if (!assistant || assistant.role !== 'assistant') return
    assistant.content = persisted.turn.response ?? ''
    assistant.status = persisted.turn.status
    assistant.decision = persistedDecision(persisted.turn.promptDecision ?? null)
    assistant.modelName = persisted.turn.modelName ?? undefined
    if (persisted.turn.status !== 'IN_PROGRESS') {
      pendingTurnId.value = ''
      sendError.value = false
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
    images,
    imageCapabilities,
    pendingTurnId,
    loadImageCapabilities,
    addImages,
    removeImage,
    reconcileTurn,
    rememberDraft,
    reset,
    restore,
    prepend,
    send,
    stop,
  }
}
