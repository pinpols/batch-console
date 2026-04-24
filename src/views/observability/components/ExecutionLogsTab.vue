<template>
  <div>
    <ListPageQueryBar
      :filter-busy="false"
      :refresh-busy="loadingExec"
      @search="applyFilter"
      @reset="resetFilter"
      @refresh="loadExecutionLogs"
    >
      <el-form-item label="操作类型">
        <el-select
          class="query-w-200"
          v-model="execDraft.operationType"
          clearable
          filterable
          placeholder="全部"
        >
          <el-option v-for="opt in execOperationTypeOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item label="结果">
        <el-select
          class="query-w-180"
          v-model="execDraft.result"
          clearable
          filterable
          placeholder="全部"
        >
          <el-option v-for="opt in execResultOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item label="Trace">
        <el-input
          class="query-w-220"
          v-model="execDraft.traceId"
          clearable
          placeholder="模糊匹配"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
    </ListPageQueryBar>
    <el-table
      v-loading="loadingExec"
      :data="pagedExec.records"
      stripe
      border
      empty-text="暂无数据"
      size="small"
      class="console-table"
    >
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="operationType" label="操作类型" width="140" />
      <el-table-column prop="operationResult" label="结果" width="100" />
      <el-table-column prop="operatorId" label="操作人" width="140" show-overflow-tooltip />
      <el-table-column prop="detailSummary" label="摘要" min-width="300" show-overflow-tooltip />
      <el-table-column prop="traceId" label="Trace ID" width="180" show-overflow-tooltip />
      <DatetimeColumn prop="createdAt" label="时间" width="160" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" plain type="primary" @click="openDetail(row)">详情</el-button>
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
    <TablePagerBar
      :page="execPage"
      :page-size="execPageSize"
      :total="pagedExec.total"
      @update:page="(p: number) => (execPage = p)"
      @update:page-size="onPageSizeChange"
    />

    <QueryDetailDrawer
      v-model:visible="detailVisible"
      title="执行日志详情"
      :row="detailRow"
      :meta-rows="detailMetaRows"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { queryExecutionLogs } from '@/api/observabilityQueries'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import QueryDetailDrawer from './QueryDetailDrawer.vue'

  const tenant = useTenantStore()
  const router = useRouter()

  const loadingExec = ref(false)
  const execRows = ref<Record<string, unknown>[]>([])
  const execPage = ref(1)
  const execPageSize = ref(20)
  const execDraft = reactive({ operationType: '', result: '', traceId: '' })
  const execApplied = reactive({ operationType: '', result: '', traceId: '' })

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

  const detailMetaRows = computed(() => {
    const r = detailRow.value ?? {}
    return [
      { label: '操作类型', value: pickString(r, 'operationType') },
      { label: '结果', value: pickString(r, 'operationResult') },
      { label: 'Trace', value: pickString(r, 'traceId') },
    ]
  })

  function pickString(row: Record<string, unknown>, key: string): string {
    const v = row[key]
    if (v == null) return ''
    return typeof v === 'string' ? v : String(v)
  }

  async function loadExecutionLogs() {
    loadingExec.value = true
    try {
      execRows.value = (await queryExecutionLogs(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      execRows.value = []
    } finally {
      loadingExec.value = false
    }
  }

  function applyFilter() {
    execApplied.operationType = execDraft.operationType.trim()
    execApplied.result = execDraft.result.trim()
    execApplied.traceId = execDraft.traceId.trim()
    execPage.value = 1
  }

  function resetFilter() {
    execDraft.operationType = ''
    execDraft.result = ''
    execDraft.traceId = ''
    execApplied.operationType = ''
    execApplied.result = ''
    execApplied.traceId = ''
    execPage.value = 1
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
    router.push({ path: '/logs', query: { traceId } })
  }

  useTenantReload(() => {
    execPage.value = 1
    void loadExecutionLogs()
  })
</script>
