<template>
  <PageContainer>
    <PageHeader />

    <div>
      <el-tabs v-model="activeTab" tab-position="left" class="pill-tabs">
        <el-tab-pane :label="t('aiChat.tabChat')" name="chat">
          <div class="chat-layout">
            <aside class="conversation-list" :aria-label="t('aiChat.historyTitle')">
              <div class="conversation-list__head">
                <strong>{{ t('aiChat.historyTitle') }}</strong>
                <el-button
                  :icon="Plus"
                  circle
                  :aria-label="t('aiChat.btnNewSession')"
                  @click="resetSession()"
                />
              </div>
              <div v-if="historyLoading" v-loading="true" class="conversation-list__loading" />
              <div v-else-if="!historyAvailable" class="conversation-list__fallback">
                <p class="conversation-list__empty">{{ t('aiChat.historyUnavailable') }}</p>
                <el-button text @click="loadConversations">{{ t('common.retry') }}</el-button>
              </div>
              <p v-else-if="!conversations.length" class="conversation-list__empty">
                {{ t('aiChat.historyEmpty') }}
              </p>
              <div v-else class="conversation-list__items">
                <div
                  v-for="conversation in conversations"
                  :key="conversation.id"
                  class="conversation-list__item"
                  :data-conversation-id="conversation.id"
                >
                  <el-button
                    text
                    class="conversation-list__open"
                    :type="sessionId === conversation.id ? 'primary' : 'default'"
                    @click="openConversation(conversation.id)"
                  >
                    {{ conversation.title }}
                  </el-button>
                  <el-button
                    text
                    :icon="Trash2"
                    class="conversation-list__delete"
                    :aria-label="t('aiChat.deleteConversation')"
                    @click="removeConversation(conversation.id)"
                  />
                </div>
                <el-button
                  v-if="historyHasMore"
                  text
                  :loading="historyMoreLoading"
                  @click="loadMoreConversations"
                >
                  {{ t('aiChat.loadOlderConversations') }}
                </el-button>
                <p v-if="historyPageError" class="conversation-list__empty" role="alert">
                  {{ t('aiChat.historyLoadError') }}
                </p>
              </div>
              <div v-if="costSummary" class="conversation-list__cost">
                <div>{{ t('aiChat.monthlyCost', { cost: monthlyCost }) }}</div>
                <div>{{ t('aiChat.meteredCalls', { count: costSummary.requestCount }) }}</div>
                <div>{{ t('aiChat.reportedTokens', { count: reportedTokens }) }}</div>
                <div v-if="reservedCost !== null">
                  {{ t('aiChat.reservedCost', { cost: reservedCost }) }}
                </div>
                <div v-if="monthlyBudget !== null">
                  {{ t('aiChat.monthlyBudget', { budget: monthlyBudget }) }}
                </div>
              </div>
            </aside>
            <div class="chat-panel">
              <div v-if="historyError" class="history-error" role="alert">
                {{ t(historyErrorKey) }}
              </div>
              <div
                ref="chatList"
                v-loading="historyTurnsLoading"
                class="chat-list"
                aria-live="polite"
                @scroll="onChatScroll"
              >
                <div
                  v-for="item in messages"
                  :key="item.id"
                  class="bubble"
                  :class="`bubble--${item.role}`"
                >
                  <div class="bubble__meta">
                    {{ item.role === 'user' ? t('aiChat.bubbleMe') : t('aiChat.bubbleAi') }}
                  </div>
                  <div
                    v-if="
                      item.role === 'assistant' && item.decision && item.decision !== 'APPROVED'
                    "
                    class="gate-notice"
                  >
                    <div class="gate-notice__head">
                      <span class="gate-notice__title">{{ t('aiChat.gateTitle') }}</span>
                      <span class="gate-notice__tag">{{ decisionLabel(item.decision) }}</span>
                    </div>
                  </div>
                  <AiMessageContent
                    class="bubble__body"
                    :content="messageBody(item)"
                    :role="item.role"
                    :streaming="item.status === 'IN_PROGRESS'"
                  />
                  <AiMessageImages v-if="item.role === 'user'" :images="item.images ?? []" />
                  <AiSourceReferences
                    v-if="item.role === 'assistant'"
                    :sources="item.sources ?? []"
                  />
                  <div v-if="item.role === 'assistant' && item.modelName" class="bubble__model">
                    {{ t('aiChat.modelBy', { model: item.modelName }) }}
                  </div>
                </div>
                <el-button
                  v-if="hasOlderTurns"
                  text
                  :loading="historyTurnsLoading"
                  @click="loadOlderTurns"
                >
                  {{ t('aiChat.loadOlder') }}
                </el-button>
              </div>
              <AiFollowUpSuggestions
                :messages="messages"
                :has-draft="Boolean(prompt.trim())"
                @select="(value) => (prompt = value)"
              />
              <el-form
                class="composer"
                @submit.prevent
                @paste="handleImagePaste"
                @drop="handleImageDrop"
                @dragover="handleImageDragOver"
              >
                <div class="composer__label">{{ t('aiChat.promptLabel') }}</div>
                <el-input
                  v-model="prompt"
                  type="textarea"
                  :rows="6"
                  :disabled="historyTurnsLoading"
                  :placeholder="t('aiChat.inputPlaceholder')"
                  class="composer__editor"
                />
                <div v-if="sendError" class="history-error" role="alert">
                  {{ t(sendErrorKey) }}
                </div>
                <el-button v-if="chat.pendingTurnId.value" text @click="chat.reconcileTurn()">
                  {{ t('aiChat.checkTurnStatus') }}
                </el-button>
                <AiTextAttachmentPicker v-model="chat.attachment.value" :disabled="sending" />
                <AiImageAttachmentPicker ref="imagePicker" :chat="chat" :disabled="sending" />
                <div class="composer__actions">
                  <el-button :disabled="sending || !messages.length" @click="resetSession()">
                    {{ t('aiChat.btnNewSession') }}
                  </el-button>
                  <div class="composer__actions-right">
                    <div class="composer__hint">{{ t('aiChat.composerHint') }}</div>
                    <el-button
                      v-if="sending"
                      :icon="Square"
                      :aria-label="t('aiChat.btnStop')"
                      @click="chat.stop()"
                    />
                    <el-button
                      type="primary"
                      :loading="sending"
                      :disabled="
                        historyTurnsLoading || !prompt.trim() || !!chat.pendingTurnId.value
                      "
                      @click="send"
                    >
                      {{ t('aiChat.btnSend') }}
                    </el-button>
                  </div>
                </div>
              </el-form>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('aiChat.tabAudits')" name="audits">
          <ProTable
            class="audit-table-shell"
            :data="auditRows"
            :loading="auditTableBlocking"
            :total="auditTotal"
            pagination-mode="cursor"
            :has-more="auditHasMore"
            :has-prev="auditCursorStack.length > 0"
            v-model:page="auditPage"
            v-model:page-size="auditPageSize"
            @change="resetAuditCursorAndLoad"
            @cursor-next="nextAuditPage"
            @cursor-prev="prevAuditPage"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="auditQueryBusy"
                :refresh-busy="auditLoading"
                :disabled="auditLoading"
                @search="onAuditSearch"
                @reset="onAuditReset"
                @refresh="() => runAuditRefresh(loadAudits)"
              >
                <el-form-item label="Trace">
                  <el-input
                    class="query-w-200"
                    v-model="auditTraceDraft"
                    clearable
                    :placeholder="t('aiChat.tracePlaceholder')"
                    @keyup.enter="onAuditSearch"
                  />
                </el-form-item>
                <el-form-item :label="t('aiChat.operatorLabel')">
                  <el-input
                    class="query-w-160"
                    v-model="auditOperatorDraft"
                    clearable
                    :placeholder="t('aiChat.operatorPlaceholder')"
                    @keyup.enter="onAuditSearch"
                  />
                </el-form-item>
                <el-form-item :label="t('aiChat.categoryLabel')">
                  <MetaSelect
                    class="query-w-200"
                    v-model="auditCategoryDraft"
                    clearable
                    filterable
                    allow-create
                    default-first-option
                    :placeholder="t('aiChat.categoryPlaceholder')"
                    @keyup.enter="onAuditSearch"
                    :options="auditCategoryOptions"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <DatetimeColumn prop="createdAt" :label="t('aiChat.colTime')" width="160" />
            <el-table-column prop="operatorId" :label="t('aiChat.colOperator')" width="120" />
            <el-table-column
              prop="sessionId"
              :label="t('aiChat.colSession')"
              width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="requestId"
              :label="t('aiChat.colRequestId')"
              width="140"
              show-overflow-tooltip
            />
            <el-table-column prop="promptCategory" :label="t('aiChat.colCategory')" width="120" />
            <el-table-column prop="promptDecision" :label="t('aiChat.colDecision')" width="110" />
            <el-table-column prop="modelName" :label="t('aiChat.colModel')" width="140" />
            <el-table-column
              prop="refusalReason"
              :label="t('aiChat.colRejectReason')"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column
              prop="promptPreview"
              :label="t('aiChat.colPromptPreview')"
              min-width="220"
              show-overflow-tooltip
            />
            <el-table-column
              prop="responsePreview"
              :label="t('aiChat.colAnswerPreview')"
              min-width="260"
              show-overflow-tooltip
            />
            <el-table-column
              prop="traceId"
              :label="t('aiChat.colTrace')"
              min-width="150"
              show-overflow-tooltip
            />
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessageBox } from 'element-plus'
  import { Plus, Square, Trash2 } from '@lucide/vue'

  const { t } = useI18n({ useScope: 'global' })
  import {
    deleteAiConversation,
    getAiCostSummary,
    pageAiConversations,
    listAiTurns,
  } from '@/api/ai'
  import { useAiChatSession } from '@/composables/useAiChatSession'
  import { useAiAutoScroll } from '@/composables/useAiAutoScroll'
  import { aiMessageBody } from '@/utils/aiMessagePresentation'
  import { queryAiAuditsPage } from '@/api/observabilityQueries'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import AiMessageContent from '@/components/common/AiMessageContent.vue'
  import AiMessageImages from '@/components/common/AiMessageImages.vue'
  import AiImageAttachmentPicker from '@/components/common/AiImageAttachmentPicker.vue'
  import AiFollowUpSuggestions from '@/components/common/AiFollowUpSuggestions.vue'
  import AiSourceReferences from '@/components/common/AiSourceReferences.vue'
  import AiTextAttachmentPicker from '@/components/common/AiTextAttachmentPicker.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { AiAuditLogResponse } from '@/types/console-api'
  import type { AiConversation, AiCostSummary } from '@/api/ai'
  import type { AiChatMessage } from '@/composables/useAiChatSession'

  type PromptDecision = NonNullable<AiChatMessage['decision']>

  const tenant = useTenantStore()
  const route = useRoute()
  const router = useRouter()
  const activeTab = ref<'chat' | 'audits'>('chat')
  const chat = useAiChatSession()
  const { prompt, sending, sendError, sendErrorKey, sessionId, messages } = chat
  const imagePicker = ref<InstanceType<typeof AiImageAttachmentPicker> | null>(null)
  function handleImagePaste(event: Event) {
    imagePicker.value?.onPaste(event as ClipboardEvent)
  }
  function handleImageDrop(event: Event) {
    imagePicker.value?.onDrop(event as DragEvent)
  }
  function handleImageDragOver(event: Event) {
    imagePicker.value?.onDragOver(event as DragEvent)
  }
  const {
    element: chatList,
    onScroll: onChatScroll,
    follow: followChat,
  } = useAiAutoScroll(computed(() => [messages.value.length, messages.value.at(-1)?.content]))
  const conversations = ref<AiConversation[]>([])
  const costSummary = ref<AiCostSummary | null>(null)
  const monthlyCost = computed(() => {
    const value = costSummary.value?.estimatedCostUsd
    return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : null
  })
  const monthlyBudget = computed(() => {
    const value = costSummary.value?.monthlyBudgetUsd
    return typeof value === 'number' && value > 0 && Number.isFinite(value)
      ? value.toFixed(2)
      : null
  })
  const reservedCost = computed(() => {
    const value = costSummary.value?.reservedCostUsd
    return typeof value === 'number' && value > 0 && Number.isFinite(value)
      ? value.toFixed(4)
      : null
  })
  const reportedTokens = computed(
    () => (costSummary.value?.promptTokens ?? 0) + (costSummary.value?.completionTokens ?? 0),
  )
  const historyAvailable = ref(true)
  const historyLoading = ref(false)
  const historyMoreLoading = ref(false)
  const historyHasMore = ref(false)
  const historyNextCursor = ref<string | null>(null)
  const historyPageError = ref(false)
  const historyTurnsLoading = ref(false)
  const openingConversationId = ref<string | null>(null)
  const historyError = ref(false)
  const historyErrorKey = ref<'aiChat.historyLoadError' | 'aiChat.conversationUnavailable'>(
    'aiChat.historyLoadError',
  )
  const oldestTurnNo = ref<number | null>(null)
  const hasOlderTurns = ref(false)
  let historyRequestSequence = 0
  let turnRequestSequence = 0
  let auditRequestSequence = 0

  const DECISION_LABEL_KEY: Record<Exclude<PromptDecision, 'APPROVED'>, string> = {
    REJECTED_SCOPE: 'aiChat.decision.rejectedScope',
    REJECTED_AUTH: 'aiChat.decision.rejectedAuth',
    REJECTED_DISABLED: 'aiChat.decision.rejectedDisabled',
    REJECTED_SAFETY: 'aiChat.decision.rejectedSafety',
    REJECTED_BUDGET: 'aiChat.decision.rejectedBudget',
    FAILED: 'aiChat.decision.failed',
  }

  function decisionLabel(decision: PromptDecision): string {
    if (decision === 'APPROVED') return ''
    return t(DECISION_LABEL_KEY[decision])
  }

  function messageBody(message: AiChatMessage): string {
    return aiMessageBody(message, t)
  }

  const { loading: auditLoading, error: auditLoadError, run: runLoadAudits } = useListLoadState()
  const {
    filterBusy: auditQueryBusy,
    tableBlocking: auditTableBlocking,
    runSearch: runAuditSearch,
    runReset: runAuditReset,
    runRefresh: runAuditRefresh,
  } = useListFilterFeedback(auditLoading)
  const auditRows = ref<AiAuditLogResponse[]>([])
  const auditTotal = ref(0)
  const auditPage = ref(1)
  const auditPageSize = ref(15)
  const auditCursor = ref<string | null>(null)
  const auditNextCursor = ref<string | null>(null)
  const auditCursorStack = ref<(string | null)[]>([])
  const auditHasMore = ref(false)
  const auditTraceDraft = ref('')
  const auditOperatorDraft = ref('')
  const auditCategoryDraft = ref('')
  const auditTraceApplied = ref('')
  const auditOperatorApplied = ref('')
  const auditCategoryApplied = ref('')

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const auditCategoryOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'aiPromptCategory'),
  )

  function onAuditSearch() {
    return runAuditSearch(async () => {
      auditTraceApplied.value = auditTraceDraft.value.trim()
      auditOperatorApplied.value = auditOperatorDraft.value.trim()
      auditCategoryApplied.value = auditCategoryDraft.value.trim()
      resetAuditCursor()
      await loadAudits()
    })
  }

  function onAuditReset() {
    return runAuditReset(async () => {
      auditTraceDraft.value = ''
      auditOperatorDraft.value = ''
      auditCategoryDraft.value = ''
      auditTraceApplied.value = ''
      auditOperatorApplied.value = ''
      auditCategoryApplied.value = ''
      resetAuditCursor()
      await loadAudits()
    })
  }

  function resetSession(clearDrafts = false) {
    turnRequestSequence += 1
    historyTurnsLoading.value = false
    openingConversationId.value = null
    chat.reset(clearDrafts)
    oldestTurnNo.value = null
    hasOlderTurns.value = false
    historyError.value = false
    historyErrorKey.value = 'aiChat.historyLoadError'
  }

  function isMissingConversation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const response = (error as { response?: { status?: number; data?: { code?: string } } })
      .response
    return response?.status === 404 || response?.data?.code === 'NOT_FOUND'
  }

  function markConversationUnavailable(id: string) {
    conversations.value = conversations.value.filter((item) => item.id !== id)
    if (sessionId.value === id) resetSession()
    historyErrorKey.value = 'aiChat.conversationUnavailable'
    historyError.value = true
  }

  async function loadConversations() {
    const sequence = ++historyRequestSequence
    const tenantId = tenant.tenantId
    historyLoading.value = true
    historyMoreLoading.value = false
    historyPageError.value = false
    try {
      const result = await pageAiConversations({ limit: 20 })
      if (sequence !== historyRequestSequence || tenant.tenantId !== tenantId) return
      conversations.value = result.items
      historyNextCursor.value = result.nextCursor
      historyHasMore.value = result.hasMore && Boolean(result.nextCursor)
      historyAvailable.value = true
      const cost = await getAiCostSummary().catch(() => null)
      if (sequence === historyRequestSequence && tenant.tenantId === tenantId)
        costSummary.value = cost
    } catch {
      if (sequence !== historyRequestSequence || tenant.tenantId !== tenantId) return
      conversations.value = []
      historyNextCursor.value = null
      historyHasMore.value = false
      historyAvailable.value = false
      costSummary.value = null
    } finally {
      if (sequence === historyRequestSequence) historyLoading.value = false
    }
  }

  async function loadMoreConversations() {
    const cursor = historyNextCursor.value
    if (!cursor || !historyHasMore.value || historyLoading.value || historyMoreLoading.value) return
    const sequence = historyRequestSequence
    const tenantId = tenant.tenantId
    historyMoreLoading.value = true
    historyPageError.value = false
    try {
      const result = await pageAiConversations({ cursor, limit: 20 })
      if (sequence !== historyRequestSequence || tenant.tenantId !== tenantId) return
      const loadedIds = new Set(conversations.value.map((item) => item.id))
      conversations.value = [
        ...conversations.value,
        ...result.items.filter((item) => !loadedIds.has(item.id)),
      ]
      historyNextCursor.value = result.nextCursor
      historyHasMore.value =
        result.hasMore && Boolean(result.nextCursor) && result.nextCursor !== cursor
    } catch {
      if (sequence === historyRequestSequence && tenant.tenantId === tenantId)
        historyPageError.value = true
    } finally {
      if (sequence === historyRequestSequence) historyMoreLoading.value = false
    }
  }

  async function openConversation(id: string) {
    if (sending.value) return
    const sequence = ++turnRequestSequence
    const tenantId = tenant.tenantId
    historyTurnsLoading.value = true
    openingConversationId.value = id
    historyError.value = false
    historyErrorKey.value = 'aiChat.historyLoadError'
    try {
      const turns = await listAiTurns(id, { limit: 50 })
      if (sequence !== turnRequestSequence || tenant.tenantId !== tenantId) return
      chat.restore(id, turns, t('aiChat.emptyAnswer'))
      followChat()
      oldestTurnNo.value = turns.length ? Math.min(...turns.map((turn) => turn.turnNo)) : null
      hasOlderTurns.value = turns.length === 50
    } catch (error) {
      if (sequence === turnRequestSequence && tenant.tenantId === tenantId) {
        if (isMissingConversation(error)) markConversationUnavailable(id)
        else historyError.value = true
      }
    } finally {
      if (sequence === turnRequestSequence) {
        historyTurnsLoading.value = false
        openingConversationId.value = null
      }
    }
  }

  async function loadOlderTurns() {
    if (!sessionId.value || oldestTurnNo.value == null) return
    const sequence = ++turnRequestSequence
    const tenantId = tenant.tenantId
    const selectedSessionId = sessionId.value
    historyTurnsLoading.value = true
    try {
      const turns = await listAiTurns(selectedSessionId, {
        beforeTurnNo: oldestTurnNo.value,
        limit: 50,
      })
      if (
        sequence !== turnRequestSequence ||
        tenant.tenantId !== tenantId ||
        sessionId.value !== selectedSessionId
      )
        return
      chat.prepend(turns, t('aiChat.emptyAnswer'))
      oldestTurnNo.value = turns.length ? Math.min(...turns.map((turn) => turn.turnNo)) : null
      hasOlderTurns.value = turns.length === 50
    } catch (error) {
      if (
        sequence === turnRequestSequence &&
        tenant.tenantId === tenantId &&
        sessionId.value === selectedSessionId
      ) {
        if (isMissingConversation(error)) markConversationUnavailable(selectedSessionId)
        else historyError.value = true
      }
    } finally {
      if (sequence === turnRequestSequence) historyTurnsLoading.value = false
    }
  }

  async function removeConversation(id: string) {
    try {
      await ElMessageBox.confirm(t('aiChat.deleteConfirm'), t('aiChat.deleteConversation'), {
        type: 'warning',
      })
    } catch {
      return
    }
    if (openingConversationId.value === id) {
      turnRequestSequence += 1
      historyTurnsLoading.value = false
      openingConversationId.value = null
    }
    await deleteAiConversation(id)
    if (sessionId.value === id) resetSession()
    await loadConversations()
  }

  async function send() {
    if (historyTurnsLoading.value) return
    if (await chat.send(t('aiChat.emptyAnswer'), undefined, t('aiChat.stopped'))) {
      void loadAudits()
      if (historyAvailable.value) void loadConversations()
    }
  }

  async function loadAudits() {
    const sequence = ++auditRequestSequence
    const tenantId = tenant.tenantId
    await runLoadAudits(async () => {
      const resp = await queryAiAuditsPage(
        tenant.tenantId,
        auditPageSize.value,
        auditCursor.value,
        {
          traceId: auditTraceApplied.value.trim() || undefined,
          operatorId: auditOperatorApplied.value.trim() || undefined,
          promptCategory: auditCategoryApplied.value.trim() || undefined,
        },
      )
      if (sequence !== auditRequestSequence || tenant.tenantId !== tenantId) return
      auditRows.value = resp.items ?? []
      auditTotal.value = resp.total ?? 0
      auditNextCursor.value = resp.nextCursor ?? null
      auditHasMore.value = Boolean(resp.hasMore)
    }).catch(() => {
      if (sequence !== auditRequestSequence || tenant.tenantId !== tenantId) return
      auditRows.value = []
      auditTotal.value = 0
      auditNextCursor.value = null
      auditHasMore.value = false
    })
  }

  function resetAuditCursor() {
    auditCursor.value = null
    auditNextCursor.value = null
    auditCursorStack.value = []
    auditHasMore.value = false
    auditPage.value = 1
  }

  async function resetAuditCursorAndLoad() {
    resetAuditCursor()
    await loadAudits()
  }

  async function nextAuditPage() {
    if (!auditHasMore.value || !auditNextCursor.value) return
    auditCursorStack.value.push(auditCursor.value)
    auditCursor.value = auditNextCursor.value
    auditPage.value += 1
    await loadAudits()
  }

  async function prevAuditPage() {
    const prev = auditCursorStack.value.pop()
    auditCursor.value = prev ?? null
    auditPage.value = Math.max(1, auditPage.value - 1)
    await loadAudits()
  }

  if (route.query.tab === 'audits') activeTab.value = 'audits'

  useTenantReload(async () => {
    historyRequestSequence += 1
    auditRequestSequence += 1
    resetSession(true)
    conversations.value = []
    historyNextCursor.value = null
    historyHasMore.value = false
    historyPageError.value = false
    costSummary.value = null
    await Promise.all([loadAudits(), loadConversations(), chat.loadImageCapabilities()])
  })

  watch(
    () => route.query.tab,
    (tab) => {
      activeTab.value = tab === 'audits' ? 'audits' : 'chat'
    },
  )

  watch(activeTab, (tab) => {
    void router.replace({
      path: '/system/ai-chat',
      query: tab === 'audits' ? { ...route.query, tab: 'audits' } : {},
    })
  })
</script>

<style scoped>
  :deep(.el-tabs__content) {
    min-width: 0;
    overflow: visible;
    padding-top: var(--page-block-gap);
    padding-bottom: var(--card-inner-padding);
    padding-left: var(--space-xs);
    padding-right: var(--space-xs);
  }

  :deep(.el-tab-pane) {
    min-width: 0;
    overflow: visible;
  }

  .chat-layout {
    display: grid;
    grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
    gap: var(--space-md);
    min-width: 0;
  }

  .conversation-list {
    min-width: 0;
    border-right: 1px solid var(--color-border-light);
    padding-right: var(--space-md);
  }

  .conversation-list__head,
  .conversation-list__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xs);
  }

  .conversation-list__items {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-xs);
    margin-top: var(--space-sm);
  }

  .conversation-list__item {
    min-width: 0;
  }

  .conversation-list__fallback {
    display: grid;
    justify-items: start;
    gap: var(--space-xs);
  }

  .conversation-list__open {
    min-width: 0;
    flex: 1;
    justify-content: flex-start;
    overflow: hidden;
  }

  .conversation-list__open :deep(span) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .conversation-list__delete {
    flex: none;
  }

  .conversation-list__loading {
    min-height: 80px;
  }
  .conversation-list__empty,
  .conversation-list__cost {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }
  .history-error {
    color: var(--color-danger);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-sm);
  }

  @media (max-width: 900px) {
    .chat-layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .conversation-list {
      border-right: 0;
      border-bottom: 1px solid var(--color-border-light);
      padding: 0 0 var(--space-md);
    }
    .conversation-list__items {
      max-height: 150px;
      overflow: auto;
    }
  }

  .chat-panel {
    width: 100%;
    box-sizing: border-box;
  }

  .audit-table-shell {
    width: auto;
    margin: 2px 4px;
    padding: var(--card-inner-padding);
    box-sizing: border-box;
  }

  .chat-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
    min-height: 280px;
    max-height: min(520px, calc(100vh - 420px));
    max-height: min(520px, calc(100dvh - 420px));
    overflow: auto;
    padding: var(--space-sm) 0;
  }

  .bubble {
    max-width: min(860px, 100%);
    padding: 10px 12px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: var(--color-bg-card);
    box-shadow: 0 1px 0 rgb(15 23 42 / 4%);
  }

  .bubble__body {
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
    color: var(--color-text-primary);
  }

  .bubble--user {
    align-self: flex-end;
    border-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-border) 78%);
    background: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-card) 93%);
  }

  .bubble--assistant {
    align-self: flex-start;
    background: var(--color-bg-card);
  }

  .bubble__meta {
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text-tertiary);
  }

  .gate-notice {
    margin-bottom: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-content);
    border: 1px solid color-mix(in srgb, var(--color-warning) 32%, var(--color-border) 68%);
    border-left: 3px solid color-mix(in srgb, var(--color-warning) 62%, var(--color-border) 38%);
    background: color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-card) 92%);
  }

  .gate-notice__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .gate-notice__title {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text-secondary);
  }

  .gate-notice__tag {
    padding: 1px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: color-mix(in srgb, var(--color-warning) 78%, var(--color-text-primary) 22%);
    background: color-mix(in srgb, var(--color-warning) 16%, var(--color-bg-card) 84%);
    border: 1px solid color-mix(in srgb, var(--color-warning) 30%, var(--color-border) 70%);
  }

  .bubble__model {
    margin-top: 6px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .composer {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 96%, var(--color-bg-canvas) 4%);
  }

  .composer__label {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: var(--color-text-secondary);
  }

  .composer :deep(.composer__editor .el-textarea__inner) {
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-canvas) 88%, #fff 12%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 55%);
    transition:
      box-shadow var(--motion-duration-md) var(--motion-ease-standard),
      border-color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .composer :deep(.composer__editor .el-textarea__inner:focus) {
    border-color: color-mix(in srgb, var(--color-primary) 42%, var(--color-border) 58%);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--color-primary) 14%, transparent 86%),
      inset 0 1px 0 rgb(255 255 255 / 55%);
  }

  .composer__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .composer__actions-right {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .composer__hint {
    font-size: 12px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    .composer__hint {
      display: none;
    }
  }
</style>
