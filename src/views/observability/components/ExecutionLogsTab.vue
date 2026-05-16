<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingExec"
      @search="applyFilter"
      @reset="resetFilter"
      @refresh="() => runRefresh(loadExecutionLogs)"
    >
      <el-form-item :label="t('observability.execOperationTypeLabel')">
        <el-select
          class="query-w-200"
          v-model="execDraft.operationType"
          clearable
          filterable
          :placeholder="t('observability.execOperationTypePlaceholder')"
        >
          <el-option v-for="opt in execOperationTypeOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('observability.execResultLabel')">
        <el-select
          class="query-w-180"
          v-model="execDraft.result"
          clearable
          filterable
          :placeholder="t('observability.execResultPlaceholder')"
        >
          <el-option v-for="opt in execResultOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item label="Trace">
        <el-input
          class="query-w-220"
          v-model="execDraft.traceId"
          clearable
          :placeholder="t('observability.execKeywordPlaceholder')"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
    </ListPageQueryBar>
    <DataState
      :loading="loadingExec"
      :error="loadExecError"
      :has-data="pagedExec.records.length > 0"
      :empty-text="execEmptyText"
      :on-retry="loadExecutionLogs"
    >
      <el-table
        v-loading="loadingExec"
        :data="pagedExec.records"
        stripe
        border
        :empty-text="t('common.noData')"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column
          prop="operationType"
          :label="t('observability.execColOperationType')"
          width="140"
        >
          <template #default="{ row }">
            {{ resolveEnumLabel('operationType', row.operationType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="operationResult"
          :label="t('observability.execColResult')"
          width="100"
        >
          <template #default="{ row }">
            {{ resolveEnumLabel('operationResult', row.operationResult) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="operatorId"
          :label="t('observability.execColOperator')"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="detailSummary"
          :label="t('observability.execColSummary')"
          min-width="300"
          show-overflow-tooltip
        />
        <el-table-column
          prop="traceId"
          :label="t('observability.execColTrace')"
          width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <router-link
              v-if="row.traceId"
              class="cell-link"
              :to="`/observability/trace?traceId=${row.traceId}`"
            >
              {{ row.traceId }}
            </router-link>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="createdAt" :label="t('observability.execColTime')" width="160" />
        <el-table-column :label="t('observability.execColActions')" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row)">
                {{ t('observability.execActionDetail') }}
              </el-button>
              <el-button
                v-if="row.traceId"
                size="small"
                plain
                type="info"
                @click="goTrace(String(row.traceId))"
                >Trace</el-button
              >
            </div>
          </template>
        </el-table-column>
      </el-table>
    </DataState>
    <TablePagerBar
      :page="execPage"
      :page-size="execPageSize"
      :total="pagedExec.total"
      @update:page="(p: number) => (execPage = p)"
      @update:page-size="onPageSizeChange"
    />

    <DetailDrawer
      v-model:visible="detailVisible"
      :title="t('observability.execDetailTitle')"
      :raw="detailRow"
      :meta-rows="detailMetaRows"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { queryExecutionLogs } from '@/api/observabilityQueries'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return ''
    const key = `enum.${group}.${value}`
    return te(key) ? t(key) : value
  }
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'

  const tenant = useTenantStore()
  const router = useRouter()
  const route = useRoute()

  const { loading: loadingExec, error: loadExecError, run: runLoadExec } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingExec)
  const execRows = ref<Record<string, unknown>[]>([])
  const execPage = ref(1)
  const execPageSize = ref(20)
  const initialTrace = typeof route.query.traceId === 'string' ? route.query.traceId.trim() : ''
  const execDraft = reactive({ operationType: '', result: '', traceId: initialTrace })
  const execApplied = reactive({ operationType: '', result: '', traceId: initialTrace })

  const detailVisible = ref(false)
  const detailRow = ref<Record<string, unknown> | null>(null)

  const execOperationTypeOptions = computed(() =>
    Array.from(
      new Set(
        execRows.value
          .map((x) => String(x.operationType ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )

  const execResultOptions = computed(() =>
    Array.from(
      new Set(
        execRows.value
          .map((x) => String(x.operationResult ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )

  const filteredExec = computed(() => {
    let rows = execRows.value
    const ot = execApplied.operationType.trim()
    if (ot) rows = rows.filter((x) => String(x.operationType ?? '') === ot)
    const res = execApplied.result.trim()
    if (res) rows = rows.filter((x) => String(x.operationResult ?? '') === res)
    const t = execApplied.traceId.trim().toLowerCase()
    if (t)
      rows = rows.filter((x) =>
        String(x.traceId ?? '')
          .toLowerCase()
          .includes(t),
      )
    return rows
  })

  const pagedExec = computed(() =>
    toPageResult(filteredExec.value, execPage.value, execPageSize.value),
  )

  const execEmptyText = computed(() =>
    execApplied.traceId.trim()
      ? t('observability.execEmptyTrace')
      : t('observability.execEmptyDefault'),
  )

  const detailMetaRows = computed(() => {
    const r = detailRow.value ?? {}
    return [
      { label: t('observability.execMetaOperationType'), value: pickString(r, 'operationType') },
      { label: t('observability.execMetaResult'), value: pickString(r, 'operationResult') },
      { label: 'Trace', value: pickString(r, 'traceId') },
    ]
  })

  function pickString(row: Record<string, unknown>, key: string): string {
    const v = row[key]
    if (v == null) return ''
    return typeof v === 'string' ? v : String(v)
  }

  async function loadExecutionLogs() {
    await runLoadExec(async () => {
      execRows.value = (await queryExecutionLogs(tenant.tenantId, {
        traceId: execApplied.traceId.trim() || undefined,
        operationType: execApplied.operationType.trim() || undefined,
        operationResult: execApplied.result.trim() || undefined,
      })) as Record<string, unknown>[]
    }).catch(() => {
      execRows.value = []
    })
  }

  async function applyFilter() {
    return runSearch(async () => {
      execApplied.operationType = execDraft.operationType.trim()
      execApplied.result = execDraft.result.trim()
      execApplied.traceId = execDraft.traceId.trim()
      execPage.value = 1
      await loadExecutionLogs()
    })
  }

  async function resetFilter() {
    return runReset(async () => {
      execDraft.operationType = ''
      execDraft.result = ''
      execDraft.traceId = ''
      execApplied.operationType = ''
      execApplied.result = ''
      execApplied.traceId = ''
      execPage.value = 1
      await loadExecutionLogs()
    })
  }

  function onPageSizeChange(s: number) {
    execPageSize.value = s
    execPage.value = 1
  }

  function openDetail(row: Record<string, unknown>) {
    detailRow.value = row
    detailVisible.value = true
  }

  function goTrace(traceId: string) {
    if (!traceId.trim()) return
    router.push({ path: '/observability/trace', query: { traceId } })
  }

  useTenantReload(() => {
    execPage.value = 1
    void loadExecutionLogs()
  })
</script>
