<template>
  <PageContainer>
    <PageHeader :title="t('executionLog.title')" />
    <SectionCard>
      <ProTable
        :data="display"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
        :show-pager="true"
        :error="loadError"
        :on-retry="load"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            :disabled="loading"
            @search="onSearch"
            @reset="reset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('executionLog.traceLabel')">
              <el-input
                class="query-w-200"
                v-model="traceDraft"
                clearable
                :placeholder="t('executionLog.tracePlaceholder')"
                @keyup.enter="onSearch"
              />
            </el-form-item>
            <el-form-item :label="t('executionLog.opTypeLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="opDraft"
                clearable
                filterable
                allow-create
                default-first-option
                :placeholder="t('executionLog.opTypePlaceholder')"
                @keyup.enter="onSearch"
                :options="operationTypeOptions"
              />
            </el-form-item>
            <el-form-item :label="t('executionLog.opResultLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="opResultDraft"
                clearable
                filterable
                :placeholder="t('executionLog.opResultPlaceholder')"
                @keyup.enter="onSearch"
                :options="opResultOptions"
              />
            </el-form-item>
            <el-form-item>
              <el-switch v-model="poll" :active-text="t('executionLog.pollLabel')" />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <DatetimeColumn prop="createdAt" :label="t('executionLog.colTime')" width="160" />
        <el-table-column prop="operationType" :label="t('executionLog.colOpType')" width="120" />
        <el-table-column prop="operationResult" :label="t('executionLog.colOpResult')" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.operationResult ?? '')" category="operationResult" />
          </template>
        </el-table-column>
        <el-table-column
          prop="operatorType"
          :label="t('executionLog.colOperatorType')"
          width="110"
        />
        <el-table-column prop="operatorId" :label="t('executionLog.colOperator')" width="120" />
        <el-table-column prop="fileId" :label="t('executionLog.colFileId')" width="100" />
        <el-table-column
          prop="traceId"
          :label="t('executionLog.colTrace')"
          min-width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="evidenceRef"
          :label="t('executionLog.colEvidence')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="detailSummary"
          :label="t('executionLog.colSummary')"
          min-width="160"
          show-overflow-tooltip
        />
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute } from 'vue-router'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { queryAuditsPage } from '@/api/observabilityQueries'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleAuditLogResponse } from '@/types/console-api'

  const route = useRoute()
  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  const traceDraft = ref('')
  const opDraft = ref('')
  const opResultDraft = ref('')
  const traceApplied = ref('')
  const opApplied = ref('')
  const opResultApplied = ref('')
  const poll = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const page = ref(1)
  const pageSize = ref(15)
  const total = ref(0)
  const display = ref<ConsoleAuditLogResponse[]>([])

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const operationTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'operationType'))

  const opResultOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'operationResult'))

  function decodeHtmlEntities(value: string): string {
    return value
      .replace(/&quot;|&#34;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  }

  function formatDetailSummary(value?: string | null): string {
    if (!value) return ''
    const decoded = decodeHtmlEntities(value)
    try {
      const parsed = JSON.parse(decoded)
      return JSON.stringify(parsed)
    } catch {
      return decoded
    }
  }

  async function onSearch() {
    return runSearch(async () => {
      traceApplied.value = traceDraft.value.trim()
      opApplied.value = opDraft.value.trim()
      opResultApplied.value = opResultDraft.value.trim()
      page.value = 1
      await load()
    })
  }

  async function reset() {
    return runReset(async () => {
      traceDraft.value = ''
      opDraft.value = ''
      opResultDraft.value = ''
      traceApplied.value = ''
      opApplied.value = ''
      opResultApplied.value = ''
      page.value = 1
      await load()
    })
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const response = await queryAuditsPage(tenant.tenantId, page.value, pageSize.value, {
        traceId: traceApplied.value.trim() || undefined,
        operationType: opApplied.value.trim() || undefined,
        operationResult: opResultApplied.value.trim() || undefined,
      })
      display.value = (response.items ?? []).map((row) => ({
        ...row,
        detailSummary: formatDetailSummary(row.detailSummary),
      }))
      total.value = response.total ?? 0
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  watch(poll, (on) => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (on) {
      timer = setInterval(() => load(), 30_000)
    }
  })

  {
    const q = route.query
    if (q.traceId) {
      traceDraft.value = String(q.traceId)
      traceApplied.value = String(q.traceId)
    }
  }

  useTenantReload(load)

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })
</script>
