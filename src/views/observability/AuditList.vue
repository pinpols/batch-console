<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="display"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
        :error="loadError"
        :on-retry="load"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            :disabled="loading"
            @search="search"
            @reset="reset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('auditList.traceLabel')">
              <el-input
                class="query-w-200"
                v-model="filters.traceId"
                clearable
                :placeholder="t('auditList.tracePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('auditList.operationTypeLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="filters.operationType"
                clearable
                filterable
                allow-create
                default-first-option
                enum-key="operationType"
                :placeholder="t('auditList.operationTypePlaceholder')"
                :options="operationTypeOptions"
              />
            </el-form-item>
            <el-form-item :label="t('auditList.operatorLabel')">
              <el-input
                class="query-w-160"
                v-model="filters.operatorId"
                clearable
                :placeholder="t('auditList.operatorPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('auditList.fileIdLabel')">
              <el-input
                class="query-w-140"
                v-model="filters.fileId"
                clearable
                :placeholder="t('auditList.fileIdPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('auditList.resultLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="filters.operationResult"
                clearable
                filterable
                enum-key="operationResult"
                :placeholder="t('auditList.resultPlaceholder')"
                :options="operationResultSelectOptions"
              />
            </el-form-item>
            <el-form-item :label="t('auditList.timeRangeLabel')">
              <el-date-picker
                class="query-w-340"
                v-model="timeRange"
                type="datetimerange"
                value-format="YYYY-MM-DD HH:mm:ss"
                :range-separator="t('auditList.timeRangeSeparator')"
                :start-placeholder="t('auditList.startTimePlaceholder')"
                :end-placeholder="t('auditList.endTimePlaceholder')"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <DatetimeColumn prop="createdAt" :label="t('auditList.colTime')" width="160" />
        <el-table-column prop="operationType" :label="t('auditList.colOperationType')" width="120">
          <template #default="{ row }">
            {{ resolveEnumLabel('operationType', row.operationType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="operationResult"
          :label="t('auditList.colOperationResult')"
          width="120"
        >
          <template #default="{ row }">
            {{ resolveEnumLabel('operationResult', row.operationResult) }}
          </template>
        </el-table-column>
        <el-table-column prop="operatorType" :label="t('auditList.colOperatorType')" width="110" />
        <el-table-column prop="operatorId" :label="t('auditList.colOperatorId')" width="120" />
        <el-table-column prop="fileId" :label="t('auditList.colFileId')" width="100" />
        <el-table-column
          prop="traceId"
          :label="t('auditList.colTrace')"
          min-width="130"
          show-overflow-tooltip
        />
        <el-table-column
          prop="evidenceRef"
          :label="t('auditList.colEvidence')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="detailSummary"
          :label="t('auditList.colSummary')"
          min-width="180"
          show-overflow-tooltip
        />
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return ''
    const key = `enum.${group}.${value}`
    return te(key) ? t(key) : value
  }
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { queryAudits } from '@/api/observabilityQueries'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import type { ConsoleAuditLogResponse } from '@/types/console-api'

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
  const all = ref<ConsoleAuditLogResponse[]>([])
  const display = ref<ConsoleAuditLogResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const timeRange = ref<[string, string] | []>([])
  const filters = reactive({
    traceId: '',
    operationType: '',
    operatorId: '',
    fileId: '',
    operationResult: '',
    startTime: '',
    endTime: '',
  })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const operationTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'operationType'))

  const operationResultSelectOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'operationResult'),
  )

  function filterAll() {
    return all.value.filter((row) => {
      if (filters.traceId.trim() && !row.traceId?.includes(filters.traceId.trim())) return false
      if (
        filters.operationType.trim() &&
        String(row.operationType ?? '') !== filters.operationType.trim()
      ) {
        return false
      }
      if (filters.operatorId.trim() && !row.operatorId?.includes(filters.operatorId.trim())) {
        return false
      }
      if (filters.fileId.trim() && !String(row.fileId ?? '').includes(filters.fileId.trim())) {
        return false
      }
      if (
        filters.operationResult.trim() &&
        String(row.operationResult ?? '').toUpperCase() !==
          filters.operationResult.trim().toUpperCase()
      ) {
        return false
      }
      const createdAt = String(row.createdAt ?? '')
      if (filters.startTime && createdAt < filters.startTime) return false
      if (filters.endTime && createdAt > filters.endTime) return false
      return true
    })
  }

  function slicePage() {
    const r = filterAll()
    total.value = r.length
    const pr = toPageResult(r, page.value, pageSize.value)
    display.value = pr.records as ConsoleAuditLogResponse[]
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      all.value = await queryAudits(tenant.tenantId, {
        traceId: filters.traceId.trim() || undefined,
        operationType: filters.operationType.trim() || undefined,
        operatorId: filters.operatorId.trim() || undefined,
        fileId: filters.fileId.trim() || undefined,
        operationResult: filters.operationResult.trim() || undefined,
        startTime: filters.startTime || undefined,
        endTime: filters.endTime || undefined,
      })
      slicePage()
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function search() {
    return runSearch(() => {
      page.value = 1
      slicePage()
    })
  }

  function reset() {
    return runReset(() => {
      filters.traceId = ''
      filters.operationType = ''
      filters.operatorId = ''
      filters.fileId = ''
      filters.operationResult = ''
      filters.startTime = ''
      filters.endTime = ''
      timeRange.value = []
      page.value = 1
      slicePage()
    })
  }

  watch(timeRange, (value) => {
    filters.startTime = value[0] ?? ''
    filters.endTime = value[1] ?? ''
  })

  useTenantReload(load)
</script>
