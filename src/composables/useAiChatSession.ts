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
  const isRateLimited =
    result.rateLimited ||
    status === 429 ||
    code === 'RATE_LIMITED' ||
    result.code === 'RATE_LIMITED'
  if (isRateLimited) return 'aiChat.sendRateLimited'
  const isForbidden = status === 403 || code === 'FORBIDDEN' || result.code === 'FORBIDDEN'
  if (isForbidden) return 'aiChat.sendForbidden'
  const isExpiredSession = status === 404 || code === 'NOT_FOUND' || result.code === 'NOT_FOUND'
  if (isExpiredSession) return 'aiChat.sendSessionExpired'
  const isServiceUnavailable =
    status === 503 || code === 'SERVICE_UNAVAILABLE' || result.code === 'SERVICE_UNAVAILABLE'
  if (isServiceUnavailable) return 'aiChat.sendUnavailable'
  if (result.code === 'STREAM_FAILED') return 'aiChat.sendUnavailable'
  const isTimeout = result.code === 'ECONNABORTED' || result.code === 'ETIMEDOUT' || status === 504
  if (isTimeout) return 'aiChat.sendTimeout'
  return 'aiChat.sendError'
}

function imageUploadErrorKeyFor(error: unknown): SendErrorKey {
  if (!error || typeof error !== 'object') return 'aiChat.imageUploadFailed'
  const result = error as { response?: { status?: number; data?: { code?: string } } }
  const status = result.response?.status
  const code = result.response?.data?.code
  const isRateLimited = status === 429 || code === 'RATE_LIMITED'
  if (isRateLimited) return 'aiChat.imageUploadRateLimited'
  const isInvalidImage = status === 400 || code === 'INVALID_ARGUMENT'
  if (isInvalidImage) return 'aiChat.imageInvalid'
  const isServiceUnavailable = status === 503 || code === 'SERVICE_UNAVAILABLE'
  if (isServiceUnavailable) return 'aiChat.imageUploadUnavailable'
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
  const draftRevision = ref(0)
  const contextRevision = ref(0)
  const drafts = new Map<
    string,
    {
      prompt: string
      attachment: AiTextAttachment | null
      images: AiImageDraft[]
    }
  >()
  const imageTenants = new Map<string, string>()
  let generation = 0
  let activeController: AbortController | null = null
  let activeRequestId = ''
  let activeTenantId = ''
  let stopped = false
  let pendingDelta = ''
  let deltaFrame = 0
  let capabilitySequence = 0
  let reconcileSequence = 0

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
    draftRevision.value += 1
  }

  /** 切换租户会清除当前及其他会话的本地草稿。 */
  function hasUnsavedDraft() {
    if (
      prompt.value.trim() ||
      attachment.value ||
      images.value.length ||
      sending.value ||
      pendingTurnId.value
    )
      return true
    return [...drafts].some(
      ([id, draft]) =>
        id !== sessionId.value &&
        Boolean(draft.prompt.trim() || draft.attachment || draft.images.length),
    )
  }

  function tenantGuardState() {
    return {
      prompt: prompt.value,
      attachment: attachment.value,
      images: images.value,
      sending: sending.value,
      pendingTurnId: pendingTurnId.value,
      sessionId: sessionId.value,
      draftRevision: draftRevision.value,
    }
  }

  function tracked(image: AiImageDraft) {
    return (
      images.value.includes(image) ||
      [...drafts.values()].some((draft) => draft.images.includes(image))
    )
  }

  async function loadImageCapabilities() {
    const tenantId = tenant.tenantId
    const tenantRevision = tenant.revision
    const requestGeneration = generation
    const sequence = ++capabilitySequence
    const result = await getAiCapabilities().catch(() => null)
    if (
      tenant.tenantId === tenantId &&
      tenant.revision === tenantRevision &&
      generation === requestGeneration &&
      sequence === capabilitySequence
    )
      imageCapabilities.value = result
  }

  async function addImages(files: File[]) {
    const limits = imageCapabilities.value
    if (!limits?.imageInput || !files.length) return
    const tenantId = tenant.tenantId
    const tenantRevision = tenant.revision
    const uploadGeneration = generation
    const isCurrentUpload = () =>
      tenant.tenantId === tenantId &&
      tenant.revision === tenantRevision &&
      generation === uploadGeneration
    for (const file of files) {
      let imageIsInvalid = !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      if (!imageIsInvalid) imageIsInvalid = file.size > limits.maxImageBytes
      if (!imageIsInvalid) imageIsInvalid = images.value.length >= limits.maxImages
      if (!imageIsInvalid) {
        imageIsInvalid =
          images.value.reduce((sum, item) => sum + item.size, 0) + file.size > limits.maxTotalBytes
      }
      if (imageIsInvalid) {
        sendError.value = true
        sendErrorKey.value = 'aiChat.imageInvalid'
        break
      }
      const item: AiImageDraft = {
        clientAttachmentId: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        status: 'uploading',
      }
      imageTenants.set(item.clientAttachmentId, tenantId)
      images.value.push(item)
      try {
        const uploaded = await uploadAiAttachment(file, item.clientAttachmentId)
        if (!isCurrentUpload()) return
        if (!tracked(item)) {
          void deleteAiAttachment(uploaded.id).catch(() => undefined)
          return
        }
        item.id = uploaded.id
        item.mediaType = uploaded.mediaType ?? undefined
        item.width = uploaded.width ?? undefined
        item.height = uploaded.height ?? undefined
        item.status = uploaded.status === 'DRAFT' ? 'ready' : 'failed'
        draftRevision.value += 1
      } catch (error) {
        if (!isCurrentUpload()) return
        const found = await getAiAttachmentByClientId(item.clientAttachmentId).catch(() => null)
        if (!isCurrentUpload()) return
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
          draftRevision.value += 1
        } else {
          item.status = 'failed'
          draftRevision.value += 1
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
    if (
      item.id &&
      item.status === 'ready' &&
      imageTenants.get(item.clientAttachmentId) === tenant.tenantId
    ) {
      void deleteAiAttachment(item.id).catch(() => undefined)
    }
    imageTenants.delete(item.clientAttachmentId)
  }

  function reset(clearDrafts = false) {
    if (!clearDrafts) rememberDraft()
    generation += 1
    draftRevision.value += 1
    contextRevision.value += 1
    stop()
    if (deltaFrame) cancelAnimationFrame(deltaFrame)
    deltaFrame = 0
    pendingDelta = ''
    if (clearDrafts) {
      const currentImages = images.value
      const draftImages = [...drafts.values()].flatMap((draft) => draft.images)
      const allAbandonedImages = [...currentImages, ...draftImages]
      const abandoned = new Set(allAbandonedImages)
      for (const image of abandoned) {
        URL.revokeObjectURL(image.previewUrl)
        if (
          image.id &&
          image.status === 'ready' &&
          imageTenants.get(image.clientAttachmentId) === tenant.tenantId
        ) {
          void deleteAiAttachment(image.id).catch(() => undefined)
        }
      }
      imageTenants.clear()
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
    const newestFirstTurns = [...turns].reverse()
    return newestFirstTurns.flatMap((turn) => [
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
    contextRevision.value += 1
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
    const chatSubmissionIsBlocked = !content || sending.value || pendingTurnId.value
    if (chatSubmissionIsBlocked) return false
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
    const tenantRevision = tenant.revision
    const isCurrentRequest = () =>
      requestGeneration === generation &&
      tenant.tenantId === tenantId &&
      tenant.revision === tenantRevision
    const sentAttachment = attachment.value
    const sentImages = images.value
    const releaseSentImages = () => {
      for (const image of sentImages) {
        URL.revokeObjectURL(image.previewUrl)
        imageTenants.delete(image.clientAttachmentId)
      }
    }
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
    contextRevision.value += 1
    drafts.delete(sessionId.value)
    draftRevision.value += 1
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
            if (!isCurrentRequest()) return
            activeRequestId = requestId
          },
          onDelta(delta) {
            if (!isCurrentRequest()) return
            pendingDelta += delta
            if (!deltaFrame) {
              deltaFrame = requestAnimationFrame(() => flushDelta(assistantMessage))
            }
          },
        },
        activeController.signal,
      )
      if (!isCurrentRequest()) return false
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
      const shouldRestoreRejectedPromptDraft =
        res.promptDecision !== 'APPROVED' && !prompt.value && !attachment.value
      if (shouldRestoreRejectedPromptDraft) {
        prompt.value = draft
        attachment.value = sentAttachment
      }
      releaseSentImages()
      return true
    } catch (error) {
      if (!isCurrentRequest()) return false
      flushDelta(assistantMessage)
      if (clientTurnId) {
        const persisted = await getAiTurnByClientId(clientTurnId).catch(() => null)
        if (!isCurrentRequest()) return false
        if (persisted) {
          sessionId.value = persisted.sessionId
          assistantMessage.content = persisted.turn.response ?? ''
          assistantMessage.status = persisted.turn.status
          const restoredPromptDecision = persistedDecision(persisted.turn.promptDecision ?? null)
          assistantMessage.decision = restoredPromptDecision
          assistantMessage.modelName = persisted.turn.modelName ?? undefined
          releaseSentImages()
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
        releaseSentImages()
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
    const pendingId = pendingTurnId.value
    const tenantId = tenant.tenantId
    const tenantRevision = tenant.revision
    const requestGeneration = generation
    const session = sessionId.value
    const sequence = ++reconcileSequence
    const assistant = messages.value.at(-1)
    const persisted = await getAiTurnByClientId(pendingId).catch(() => null)
    if (
      !persisted ||
      tenant.tenantId !== tenantId ||
      tenant.revision !== tenantRevision ||
      generation !== requestGeneration ||
      sequence !== reconcileSequence ||
      pendingTurnId.value !== pendingId ||
      sessionId.value !== session ||
      messages.value.at(-1) !== assistant
    )
      return
    sessionId.value = persisted.sessionId
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
    draftRevision,
    contextRevision,
    hasUnsavedDraft,
    tenantGuardState,
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
