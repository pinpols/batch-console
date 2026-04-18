<template>
  <PageContainer>
    <PageHeader
      title="AI 助手"
      description="对话走控制台 AI 接口；审计表支持按 Trace、操作人与分类筛选，分类选项由已加载数据归纳。"
    />

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
              <el-form @submit.prevent>
                <el-form-item label="Prompt">
                  <el-input
                    v-model="prompt"
                    type="textarea"
                    :rows="5"
                    placeholder="例如：解释某 Job 失败原因、查询某 Trace 关联步骤、总结今日告警…"
                  />
                </el-form-item>
                <div class="chat-actions">
                  <el-input
                    v-model="modelName"
                    placeholder="模型名，可空（走服务端默认）"
                    style="width: 240px"
                  />
                  <el-button type="primary" :loading="sending" @click="send">发送</el-button>
                </div>
              </el-form>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="AI 审计" name="audits">
          <ProTable
            class="audit-table-shell"
            :data="auditTableRows"
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
                @refresh="loadAudits"
              >
                <el-form-item label="Trace">
                  <el-input
                    v-model="auditTraceDraft"
                    clearable
                    placeholder="链路 Trace Id，支持模糊"
                    style="width: 200px"
                    @keyup.enter="onAuditSearch"
                  />
                </el-form-item>
                <el-form-item label="操作人">
                  <el-input
                    v-model="auditOperatorDraft"
                    clearable
                    placeholder="操作人 Id，支持模糊"
                    style="width: 160px"
                    @keyup.enter="onAuditSearch"
                  />
                </el-form-item>
                <el-form-item label="分类">
                  <el-select
                    v-model="auditCategoryDraft"
                    clearable
                    filterable
                    allow-create
                    default-first-option
                    placeholder="选择或输入 promptCategory"
                    style="width: 200px"
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

  const auditLoading = ref(false)
  const {
    filterBusy: auditQueryBusy,
    tableBlocking: auditTableBlocking,
    runSearch: runAuditSearch,
    runReset: runAuditReset,
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

  const auditTableRows = computed(() => auditRows.value as unknown as Record<string, unknown>[])

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
    auditLoading.value = true
    try {
      auditAll.value = await fetchAllPageItems<AiAuditLogResponse>(
        '/api/console/queries/ai-audits',
        {
          tenantId: tenant.tenantId,
        },
      )
      auditPage.value = 1
      sliceAuditPage()
    } catch {
      auditAll.value = []
      sliceAuditPage()
    } finally {
      auditLoading.value = false
    }
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
    background: var(--color-bg-card);
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
    max-height: 420px;
    overflow: auto;
  }

  .bubble {
    max-width: 80%;
    padding: 12px;
    border-radius: var(--radius-content);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .bubble--user {
    align-self: flex-end;
    background: color-mix(in srgb, var(--color-primary) 10%, white 90%);
  }

  .bubble--assistant {
    align-self: flex-start;
    background: var(--color-bg-page, #f6f8fb);
  }

  .bubble__meta {
    margin-bottom: 6px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .chat-actions {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
</style>
