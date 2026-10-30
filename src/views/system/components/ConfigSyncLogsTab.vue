<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingSyncLogs"
      :disabled="loadingSyncLogs || reconcilingId !== null"
      @refresh="() => runRefresh(loadSyncLogs)"
      @search="() => runSearch(loadSyncLogs)"
      @reset="() => runReset(loadSyncLogs)"
    />
    <DataState
      :loading="loadingSyncLogs"
      :error="loadSyncLogsError"
      :has-data="total > 0"
      :on-retry="loadSyncLogs"
    >
      <el-table
        v-loading="loadingSyncLogs"
        :data="syncLogs"
        stripe
        border
        :empty-text="t('common.noData')"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" :label="t('configSyncLogsTab.colId')" width="72" align="center">
          <template #default="{ row }">
            <span class="mono-id">#{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSyncLogsTab.colType')" width="110">
          <template #default="{ row }">
            <el-tag
              v-if="row.syncDirection"
              :type="typeTag(row.syncDirection)"
              size="small"
              effect="light"
              round
            >
              {{ row.syncDirection }}
            </el-tag>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSyncLogsTab.colStatus')" width="110">
          <template #default="{ row }">
            <el-tag
              v-if="row.syncStatus"
              :type="statusTag(row.syncStatus)"
              size="small"
              effect="light"
              round
            >
              {{ row.syncStatus }}
            </el-tag>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSyncLogsTab.colOperator')" width="130">
          <template #default="{ row }">
            <span v-if="row.operatorId" class="op-id">{{ row.operatorId }}</span>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSyncLogsTab.colSummary')" min-width="260">
          <template #default="{ row }">
            <span v-if="row.syncStatus === 'RUNNING'" class="cell-empty">
              {{ t('configSyncLogsTab.metricTotal') }} {{ row.totalItems ?? '—' }} ·
              {{ t('configSyncLogsTab.outcomePending') }}
            </span>
            <template v-else-if="hasMetrics(row)">
              <span class="sync-metrics">
                <template v-for="(seg, idx) in summarySegments(row)" :key="seg.label">
                  <span v-if="idx > 0" class="m-sep">·</span>
                  {{ seg.label }}
                  <strong :class="seg.cls">{{ seg.value }}</strong>
                </template>
              </span>
            </template>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="createdAt" :label="t('configSyncLogsTab.colTime')" width="170" />
        <el-table-column
          v-if="auth.hasPermission('ROLE_ADMIN')"
          :label="t('configSyncLogsTab.colActions')"
          width="120"
        >
          <template #default="{ row }">
            <el-button
              v-if="row.syncDirection === 'IMPORT' && row.syncStatus === 'RUNNING'"
              link
              type="primary"
              :loading="reconcilingId === row.id"
              :disabled="writesFrozen || loadingSyncLogs || reconcilingId !== null"
              @click="reconcileLog(row)"
            >
              {{ t('configSyncLogsTab.reconcile') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <TablePagerBar
        :page="pageNo"
        :page-size="pageSize"
        :total="total"
        :disabled="loadingSyncLogs || reconcilingId !== null"
        @update:page="onPageChange"
        @update:page-size="onPageSizeChange"
      />
    </DataState>
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { listConfigSyncLogs, reconcileConfigSyncLog } from '@/api/configReleases'

  const { t } = useI18n({ useScope: 'global' })
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import DataState from '@/components/common/DataState.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'

  const tenant = useTenantStore()
  const auth = useAuthStore()
  const { writesFrozen, ensureWriteAvailable } = useWriteAvailability()
  const loadingSyncLogs = ref(false)
  const loadSyncLogsError = ref<unknown>(null)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingSyncLogs)
  const syncLogs = ref<Record<string, unknown>[]>([])
  const pageNo = ref(1)
  const pageSize = ref(15)
  const total = ref(0)
  const reconcilingId = ref<number | null>(null)
  let tenantGeneration = 0
  let loadSequence = 0

  function hasMetrics(row: Record<string, unknown>): boolean {
    return (
      Number(row.totalItems ?? 0) +
        Number(row.successItems ?? 0) +
        Number(row.failedItems ?? 0) +
        Number(row.skippedItems ?? 0) >
      0
    )
  }

  function summarySegments(row: Record<string, unknown>) {
    const failed = Number(row.failedItems ?? 0)
    return [
      { label: t('configSyncLogsTab.metricTotal'), value: Number(row.totalItems ?? 0), cls: '' },
      {
        label: t('configSyncLogsTab.metricSuccess'),
        value: Number(row.successItems ?? 0),
        cls: 'm-ok',
      },
      {
        label: t('configSyncLogsTab.metricFailed'),
        value: failed,
        cls: failed > 0 ? 'm-bad' : 'm-ok',
      },
      {
        label: t('configSyncLogsTab.metricSkipped'),
        value: Number(row.skippedItems ?? 0),
        cls: 'm-dim',
      },
    ]
  }

  /** EXPORT/IMPORT 双向同步,颜色区分 */
  function typeTag(v: unknown): 'primary' | 'success' | 'info' {
    const rawType = String(v ?? '')
    const s = rawType.toUpperCase()
    if (s.includes('EXPORT')) return 'info'
    if (s.includes('IMPORT')) return 'primary'
    return 'success'
  }

  /** SUCCESS/FAILED/PARTIAL/RUNNING 状态颜色 */
  function statusTag(v: unknown): 'success' | 'danger' | 'warning' | 'info' {
    const rawStatus = String(v ?? '')
    const s = rawStatus.toUpperCase()
    if (s === 'SUCCESS' || s === 'OK' || s === 'COMPLETED') return 'success'
    if (s === 'FAILED' || s === 'ERROR') return 'danger'
    if (s === 'PARTIAL_FAILED' || s === 'PARTIAL' || s === 'WARNING') return 'warning'
    return 'info'
  }

  async function loadSyncLogs() {
    if (reconcilingId.value !== null) return
    const sequence = ++loadSequence
    const tenantId = tenant.tenantId
    if (!tenantId) return
    loadingSyncLogs.value = true
    loadSyncLogsError.value = null
    try {
      const page = await listConfigSyncLogs(tenantId, pageNo.value, pageSize.value)
      if (sequence !== loadSequence || tenantId !== tenant.tenantId) return
      syncLogs.value = page.items as Record<string, unknown>[]
      total.value = page.total
    } catch (error) {
      if (sequence !== loadSequence || tenantId !== tenant.tenantId) return
      loadSyncLogsError.value = error
      syncLogs.value = []
      total.value = 0
    } finally {
      if (sequence === loadSequence) loadingSyncLogs.value = false
    }
  }

  async function reconcileLog(row: Record<string, unknown>) {
    const syncLogReconciliationIsUnavailable =
      !auth.hasPermission('ROLE_ADMIN') ||
      reconcilingId.value !== null ||
      row.syncDirection !== 'IMPORT' ||
      row.syncStatus !== 'RUNNING' ||
      !ensureWriteAvailable()
    if (syncLogReconciliationIsUnavailable) return
    const tenantId = tenant.tenantId
    const logId = Number(row.id)
    const syncLogIdentityIsInvalid =
      row.tenantId !== tenantId || !Number.isSafeInteger(logId) || logId < 1
    if (syncLogIdentityIsInvalid) return
    const generation = tenantGeneration
    reconcilingId.value = logId
    try {
      const result = await reconcileConfigSyncLog(tenantId, logId)
      if (generation !== tenantGeneration || tenantId !== tenant.tenantId) return
      if (result.id !== logId || result.tenantId !== tenantId) {
        throw new Error('Config sync audit identity mismatch')
      }
      syncLogs.value = syncLogs.value.map((item) => (item.id === logId ? result : item))
      if (result.syncStatus === 'RUNNING') {
        ElMessage.warning(t('configSyncLogsTab.outcomePending'))
      } else if (result.syncStatus === 'SUCCESS') {
        ElMessage.success(t('configSyncLogsTab.reconciled'))
      } else {
        ElMessage.warning(t('configSyncLogsTab.reviewResult'))
      }
    } catch {
      if (generation === tenantGeneration && tenantId === tenant.tenantId) {
        ElMessage.error(t('configSyncLogsTab.reconcileFailed'))
      }
    } finally {
      if (generation === tenantGeneration) reconcilingId.value = null
    }
  }

  function onPageChange(value: number) {
    pageNo.value = value
    void loadSyncLogs()
  }

  function onPageSizeChange(value: number) {
    pageSize.value = value
    pageNo.value = 1
    void loadSyncLogs()
  }

  watch(
    () => tenant.tenantId,
    () => {
      tenantGeneration++
      loadSequence++
      reconcilingId.value = null
      syncLogs.value = []
      total.value = 0
      pageNo.value = 1
      loadingSyncLogs.value = false
      loadSyncLogsError.value = null
    },
    { flush: 'sync' },
  )
  useTenantReload(loadSyncLogs)

  onBeforeUnmount(() => {
    tenantGeneration++
    loadSequence++
  })
</script>

<style scoped>
  .mono-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .op-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    color: var(--color-text-primary);
  }

  .cell-empty {
    color: var(--color-text-tertiary);
  }

  .sync-metrics :deep(.m-ok) {
    color: var(--color-success);
  }

  .sync-metrics :deep(.m-bad) {
    color: var(--color-danger);
  }

  .sync-metrics :deep(.m-dim) {
    color: var(--color-text-tertiary);
  }
</style>
