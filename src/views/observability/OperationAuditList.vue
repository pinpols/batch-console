<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
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
            <el-form-item :label="t('operationAuditList.actionLabel')">
              <el-input
                class="query-w-200"
                v-model="filters.action"
                clearable
                :placeholder="t('operationAuditList.actionPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('operationAuditList.aggregateTypeLabel')">
              <el-select
                class="query-w-160"
                v-model="filters.aggregateType"
                clearable
                filterable
                :placeholder="t('operationAuditList.aggregateTypePlaceholder')"
              >
                <el-option
                  v-for="opt in aggregateTypeOptions"
                  :key="opt"
                  :label="opt"
                  :value="opt"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('operationAuditList.aggregateIdLabel')">
              <el-input
                class="query-w-140"
                v-model="filters.aggregateId"
                clearable
                :placeholder="t('operationAuditList.aggregateIdPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('operationAuditList.operatorLabel')">
              <el-input
                class="query-w-140"
                v-model="filters.operatorId"
                clearable
                :placeholder="t('operationAuditList.operatorPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('operationAuditList.resultLabel')">
              <el-select
                class="query-w-120"
                v-model="filters.result"
                clearable
                :placeholder="t('operationAuditList.resultPlaceholder')"
              >
                <el-option label="SUCCESS" value="SUCCESS" />
                <el-option label="FAILED" value="FAILED" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('operationAuditList.traceLabel')">
              <el-input
                class="query-w-200"
                v-model="filters.traceId"
                clearable
                :placeholder="t('operationAuditList.tracePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('operationAuditList.timeRangeLabel')">
              <DateRangePresetPicker
                v-model="timeRange"
                type="datetimerange"
                default-preset="today"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <DatetimeColumn prop="createdAt" :label="t('operationAuditList.colTime')" width="160" />
        <el-table-column prop="action" :label="t('operationAuditList.colAction')" width="180">
          <template #default="{ row }">
            <el-tag :type="row.result === 'FAILED' ? 'danger' : 'info'" size="small">
              {{ row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="aggregateType"
          :label="t('operationAuditList.colAggregateType')"
          width="120"
        />
        <el-table-column
          prop="aggregateId"
          :label="t('operationAuditList.colAggregateId')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column prop="operatorId" :label="t('operationAuditList.colOperator')" width="140">
          <template #default="{ row }">
            <span>{{ row.operatorId || '—' }}</span>
            <span v-if="row.operatorRole" class="operator-role"> · {{ row.operatorRole }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="result" :label="t('operationAuditList.colResult')" width="100">
          <template #default="{ row }">
            <el-tag :type="row.result === 'SUCCESS' ? 'success' : 'danger'" size="small">
              {{ row.result }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="traceId"
          :label="t('operationAuditList.colTrace')"
          min-width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <RouterLink
              v-if="row.traceId"
              class="trace-link"
              :to="{ path: '/observability/trace', query: { traceId: row.traceId } }"
            >
              {{ row.traceId }}
            </RouterLink>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="params"
          :label="t('operationAuditList.colParams')"
          min-width="220"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <code v-if="row.params" class="params-cell">{{ row.params }}</code>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="errorMessage"
          :label="t('operationAuditList.colError')"
          min-width="160"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span v-if="row.errorCode || row.errorMessage" class="error-cell">
              <span v-if="row.errorCode" class="error-code">[{{ row.errorCode }}]</span>
              {{ row.errorMessage }}
            </span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { queryOperationAudits, type OperationAuditResponse } from '@/api/operationAudits'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DateRangePresetPicker from '@/components/common/DateRangePresetPicker.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'

  const { t } = useI18n({ useScope: 'global' })

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

  const rows = ref<OperationAuditResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const timeRange = ref<[string, string] | null>(null)

  // 共 11 个聚合根类型,跟后端 @AuditAction 的 aggregateType 一一对应
  const aggregateTypeOptions = [
    'alert',
    'approval',
    'job_instance',
    'job_partition',
    'worker',
    'outbox',
    'auth',
    'api_key',
    'alert_routing',
    'config_release',
    'tenant',
  ]

  const filters = reactive({
    action: '',
    aggregateType: '',
    aggregateId: '',
    operatorId: '',
    result: '',
    traceId: '',
    startTime: '',
    endTime: '',
  })

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const resp = await queryOperationAudits({
        tenantId: tenant.tenantId,
        action: filters.action.trim() || undefined,
        aggregateType: filters.aggregateType || undefined,
        aggregateId: filters.aggregateId.trim() || undefined,
        operatorId: filters.operatorId.trim() || undefined,
        result: (filters.result as 'SUCCESS' | 'FAILED' | '') || undefined,
        traceId: filters.traceId.trim() || undefined,
        startTime: filters.startTime || undefined,
        endTime: filters.endTime || undefined,
        pageNo: page.value,
        pageSize: pageSize.value,
      })
      rows.value = resp.items
      total.value = resp.total
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
      return load()
    })
  }

  function reset() {
    return runReset(() => {
      filters.action = ''
      filters.aggregateType = ''
      filters.aggregateId = ''
      filters.operatorId = ''
      filters.result = ''
      filters.traceId = ''
      filters.startTime = ''
      filters.endTime = ''
      timeRange.value = null
      page.value = 1
      return load()
    })
  }

  watch(timeRange, (value) => {
    filters.startTime = value?.[0] ?? ''
    filters.endTime = value?.[1] ?? ''
  })

  useTenantReload(load)
</script>

<style scoped>
  .operator-role {
    color: var(--color-text-tertiary);
    font-size: 12px;
  }
  .trace-link {
    color: var(--color-primary);
    text-decoration: none;
  }
  .trace-link:hover {
    text-decoration: underline;
  }
  .params-cell {
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
    color: var(--color-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    max-width: 100%;
  }
  .error-cell {
    color: var(--el-color-danger);
    font-size: 12px;
  }
  .error-code {
    font-weight: 600;
    margin-right: 4px;
  }
  .muted {
    color: var(--color-text-tertiary);
  }
</style>
