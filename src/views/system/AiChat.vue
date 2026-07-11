<template>
  <PageContainer>
    <PageHeader />

    <div>
      <el-tabs v-model="activeTab" tab-position="left" class="pill-tabs">
        <el-tab-pane :label="t('aiChat.tabChat')" name="chat">
          <div class="chat-layout">
            <div class="chat-panel">
              <div class="chat-list">
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
                    <div v-if="item.refusalReason" class="gate-notice__reason">
                      {{ item.refusalReason }}
                    </div>
                  </div>
                  <div class="bubble__body">{{ item.content }}</div>
                  <div v-if="item.role === 'assistant' && item.modelName" class="bubble__model">
                    {{ t('aiChat.modelBy', { model: item.modelName }) }}
                  </div>
                </div>
              </div>
              <el-form class="composer" @submit.prevent>
                <div class="composer__label">Prompt</div>
                <el-input
                  v-model="prompt"
                  type="textarea"
                  :rows="6"
                  :placeholder="t('aiChat.inputPlaceholder')"
                  class="composer__editor"
                />
                <div class="composer__actions">
                  <el-button :disabled="sending || !messages.length" @click="resetSession">
                    {{ t('aiChat.btnNewSession') }}
                  </el-button>
                  <div class="composer__actions-right">
                    <div class="composer__hint">{{ t('aiChat.composerHint') }}</div>
                    <el-button type="primary" :loading="sending" @click="send">
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
            v-model:page="auditPage"
            v-model:page-size="auditPageSize"
            @change="sliceAuditPage"
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

  const { t } = useI18n({ useScope: 'global' })
  import { fetchAllPageItems, toPageResult } from '@/api/adapters'
  import { chatWithAi } from '@/api/system'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { AiAuditLogResponse, AiChatResponse } from '@/types/console-api'

  type PromptDecision = AiChatResponse['promptDecision']

  interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    decision?: PromptDecision
    refusalReason?: string | null
    modelName?: string
  }

  const tenant = useTenantStore()
  const route = useRoute()
  const router = useRouter()
  const activeTab = ref<'chat' | 'audits'>('chat')
  const prompt = ref('')
  const sending = ref(false)
  const sessionId = ref('')
  const messages = ref<ChatMessage[]>([])

  const DECISION_LABEL_KEY: Record<Exclude<PromptDecision, 'APPROVED'>, string> = {
    REJECTED_SCOPE: 'aiChat.decision.rejectedScope',
    REJECTED_AUTH: 'aiChat.decision.rejectedAuth',
    REJECTED_DISABLED: 'aiChat.decision.rejectedDisabled',
    REJECTED_SAFETY: 'aiChat.decision.rejectedSafety',
    FAILED: 'aiChat.decision.failed',
  }

  function decisionLabel(decision: PromptDecision): string {
    if (decision === 'APPROVED') return ''
    return t(DECISION_LABEL_KEY[decision])
  }

  const { loading: auditLoading, error: auditLoadError, run: runLoadAudits } = useListLoadState()
  const {
    filterBusy: auditQueryBusy,
    tableBlocking: auditTableBlocking,
    runSearch: runAuditSearch,
    runReset: runAuditReset,
    runRefresh: runAuditRefresh,
  } = useListFilterFeedback(auditLoading)
  const auditAll = ref<AiAuditLogResponse[]>([])
  const auditRows = ref<AiAuditLogResponse[]>([])
  const auditTotal = ref(0)
  const auditPage = ref(1)
  const auditPageSize = ref(15)
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

  const auditFiltered = computed(() => {
    let r = auditAll.value
    const t = auditTraceApplied.value.trim()
    if (t) r = r.filter((row) => row.traceId?.includes(t))
    const o = auditOperatorApplied.value.trim()
    if (o) r = r.filter((row) => row.operatorId?.includes(o))
    const c = auditCategoryApplied.value.trim()
    if (c) r = r.filter((row) => String(row.promptCategory ?? '') === c)
    return r
  })

  function sliceAuditPage() {
    const list = auditFiltered.value
    auditTotal.value = list.length
    const pr = toPageResult(list, auditPage.value, auditPageSize.value)
    auditRows.value = pr.records as AiAuditLogResponse[]
  }

  function onAuditSearch() {
    return runAuditSearch(() => {
      auditTraceApplied.value = auditTraceDraft.value.trim()
      auditOperatorApplied.value = auditOperatorDraft.value.trim()
      auditCategoryApplied.value = auditCategoryDraft.value.trim()
      auditPage.value = 1
      sliceAuditPage()
    })
  }

  function onAuditReset() {
    return runAuditReset(() => {
      auditTraceDraft.value = ''
      auditOperatorDraft.value = ''
      auditCategoryDraft.value = ''
      auditTraceApplied.value = ''
      auditOperatorApplied.value = ''
      auditCategoryApplied.value = ''
      auditPage.value = 1
      sliceAuditPage()
    })
  }

  function resetSession() {
    sessionId.value = ''
    messages.value = []
  }

  async function send() {
    const content = prompt.value.trim()
    if (!content) return
    messages.value.push({ id: `${Date.now()}-u`, role: 'user', content })
    sending.value = true
    try {
      const res = await chatWithAi({
        tenantId: tenant.tenantId,
        prompt: content,
        sessionId: sessionId.value || undefined,
      })
      if (res.sessionId) sessionId.value = res.sessionId
      messages.value.push({
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: res.answer || t('aiChat.emptyAnswer'),
        decision: res.promptDecision,
        refusalReason: res.refusalReason,
        modelName: res.modelName,
      })
      prompt.value = ''
      void loadAudits()
    } finally {
      sending.value = false
    }
  }

  async function loadAudits() {
    await runLoadAudits(async () => {
      auditAll.value = await fetchAllPageItems<AiAuditLogResponse>(
        '/api/console/queries/ai-audits',
        {
          tenantId: tenant.tenantId,
        },
      )
      auditPage.value = 1
      sliceAuditPage()
    }).catch(() => {
      auditAll.value = []
      sliceAuditPage()
    })
  }

  if (route.query.tab === 'audits') activeTab.value = 'audits'

  useTenantReload(loadAudits)

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
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
  }

  .chat-panel {
    width: 100%;
    padding: var(--space-md);
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 94%, var(--color-bg-canvas) 6%);
    box-sizing: border-box;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 55%),
      0 1px 2px rgb(15 23 42 / 6%);
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
    max-height: min(520px, calc(100vh - 420px));
    max-height: min(520px, calc(100dvh - 420px));
    overflow: auto;
    padding: 14px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 55%),
      0 1px 2px rgb(15 23 42 / 6%);
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

  .gate-notice__reason {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--color-text-secondary);
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
