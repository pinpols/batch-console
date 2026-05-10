<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs
        v-model="activeTab"
        tab-position="left"
        v-hover-tab-activate="true"
        class="pill-tabs"
      >
        <el-tab-pane label="AI 助手" name="chat">
          <div class="chat-layout">
            <div class="chat-panel">
              <div class="chat-list">
                <div
                  v-for="item in messages"
                  :key="item.id"
                  class="bubble"
                  :class="`bubble--${item.role}`"
                >
                  <div class="bubble__meta">{{ item.role === 'user' ? '我' : 'AI' }}</div>
                  <div class="bubble__body">{{ item.content }}</div>
                </div>
              </div>
              <el-form class="composer" @submit.prevent>
                <div class="composer__label">Prompt</div>
                <el-input
                  v-model="prompt"
                  type="textarea"
                  :rows="6"
                  placeholder="例如：解释某 Job 失败原因、查询某 Trace 关联步骤、总结今日告警…"
                  class="composer__editor"
                />
                <div class="composer__actions">
                  <el-input
                    class="query-w-240"
                    v-model="modelName"
                    placeholder="模型名（可空，走服务端默认）"
                  />
                  <div class="composer__actions-right">
                    <div class="composer__hint">Enter 换行，点击发送提交</div>
                    <el-button type="primary" :loading="sending" @click="send">发送</el-button>
                  </div>
                </div>
              </el-form>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="AI 审计" name="audits">
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
                    placeholder="链路 Trace Id，支持模糊"
                    @keyup.enter="onAuditSearch"
                  />
                </el-form-item>
                <el-form-item label="操作人">
                  <el-input
                    class="query-w-160"
                    v-model="auditOperatorDraft"
                    clearable
                    placeholder="操作人 Id，支持模糊"
                    @keyup.enter="onAuditSearch"
                  />
                </el-form-item>
                <el-form-item label="分类">
                  <el-select
                    class="query-w-200"
                    v-model="auditCategoryDraft"
                    clearable
                    filterable
                    allow-create
                    default-first-option
                    placeholder="选择或输入 promptCategory"
                    @keyup.enter="onAuditSearch"
                  >
                    <el-option
                      v-for="o in auditCategoryOptions"
                      :key="o.value"
                      :label="o.label"
                      :value="o.value"
                    />
                  </el-select>
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <DatetimeColumn prop="createdAt" label="时间" width="160" />
            <el-table-column prop="operatorId" label="操作人" width="120" />
            <el-table-column prop="promptCategory" label="分类" width="130" />
            <el-table-column prop="promptDecision" label="决策" width="120" />
            <el-table-column prop="modelName" label="模型" width="140" />
            <el-table-column
              prop="promptPreview"
              label="Prompt 预览"
              min-width="220"
              show-overflow-tooltip
            />
            <el-table-column
              prop="responsePreview"
              label="回答预览"
              min-width="260"
              show-overflow-tooltip
            />
            <el-table-column prop="traceId" label="Trace" min-width="150" show-overflow-tooltip />
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { fetchAllPageItems, toPageResult } from '@/api/adapters'
  import { chatWithAi } from '@/api/system'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { AiAuditLogResponse } from '@/types/console-api'

  interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
  }

  const tenant = useTenantStore()
  const route = useRoute()
  const router = useRouter()
  const activeTab = ref<'chat' | 'audits'>('chat')
  const prompt = ref('')
  const modelName = ref('')
  const sending = ref(false)
  const conversationId = ref('')
  const messages = ref<ChatMessage[]>([])

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
  const auditPageSize = ref(20)
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

  async function send() {
    const content = prompt.value.trim()
    if (!content) return
    messages.value.push({ id: `${Date.now()}-u`, role: 'user', content })
    sending.value = true
    try {
      const res = await chatWithAi({
        tenantId: tenant.tenantId,
        prompt: content,
        model: modelName.value.trim() || undefined,
        conversationId: conversationId.value || undefined,
      })
      if (res.conversationId) conversationId.value = res.conversationId
      messages.value.push({
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: res.answer || 'AI 未返回内容',
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
  :deep(.el-card__body) {
    overflow: visible;
  }

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
    border-radius: 14px;
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
    color: var(--color-text-tertiary, #909399);
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
    border-radius: 12px;
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
    color: var(--color-text-tertiary, #909399);
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    .composer__hint {
      display: none;
    }
  }
</style>
