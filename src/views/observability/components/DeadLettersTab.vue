<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingDL"
      @search="applyFilter"
      @reset="resetFilter"
      @refresh="() => runRefresh(loadDeadLetters)"
    >
      <el-form-item label="来源类型">
        <el-select
          class="query-w-180"
          v-model="dlDraft.sourceType"
          clearable
          filterable
          placeholder="全部"
        >
          <el-option v-for="opt in dlSourceTypeOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源 ID">
        <el-input
          class="query-w-200"
          v-model="dlDraft.sourceId"
          clearable
          placeholder="精确匹配"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
      <el-form-item label="关键字">
        <el-input
          class="query-w-220"
          v-model="dlDraft.keyword"
          clearable
          placeholder="原因 / 状态 模糊匹配"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
    </ListPageQueryBar>
    <DataState
      :loading="loadingDL"
      :error="loadDLError"
      :has-data="pagedDL.records.length > 0"
      :on-retry="loadDeadLetters"
    >
      <el-table
        v-loading="loadingDL"
        :data="pagedDL.records"
        stripe
        border
        empty-text="暂无数据"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="sourceType" label="来源类型" width="120" />
        <el-table-column prop="sourceId" label="来源 ID" width="100" />
        <el-table-column
          prop="deadLetterReason"
          label="原因"
          min-width="250"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="createdAt" label="失败时间" width="160" />
        <el-table-column prop="replayCount" label="重试次数" width="90" />
        <el-table-column prop="replayStatus" label="状态" width="100" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row)">详情</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </DataState>
    <TablePagerBar
      :page="dlPage"
      :page-size="dlPageSize"
      :total="pagedDL.total"
      @update:page="(p: number) => (dlPage = p)"
      @update:page-size="onPageSizeChange"
    />

    <DetailDrawer
      v-model="detailVisible"
      title="Dead Letter 详情"
      :raw="detailRow"
      :meta-rows="detailMetaRows"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { queryDeadLetters } from '@/api/observabilityQueries'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'
  import type { ConsoleDeadLetterTaskResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const { loading: loadingDL, error: loadDLError, run: runLoadDL } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingDL)
  const dlRows = ref<ConsoleDeadLetterTaskResponse[]>([])
  const dlPage = ref(1)
  const dlPageSize = ref(20)
  const dlDraft = reactive({ sourceType: '', sourceId: '', keyword: '' })
  const dlApplied = reactive({ sourceType: '', sourceId: '', keyword: '' })

  const detailVisible = ref(false)
  const detailRow = ref<ConsoleDeadLetterTaskResponse | null>(null)

  const dlSourceTypeOptions = computed(() =>
    Array.from(
      new Set(
        dlRows.value
          .map((x) => String(x.sourceType ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )

  const filteredDL = computed(() => {
    let rows = dlRows.value
    const st = dlApplied.sourceType.trim()
    if (st) rows = rows.filter((x) => String(x.sourceType ?? '') === st)
    const sid = dlApplied.sourceId.trim()
    if (sid) rows = rows.filter((x) => String(x.sourceId ?? '') === sid)
    const k = dlApplied.keyword.trim().toLowerCase()
    if (k) {
      rows = rows.filter((x) => {
        const hay = `${x.deadLetterReason ?? ''} ${x.replayStatus ?? ''}`.toLowerCase()
        return hay.includes(k)
      })
    }
    return rows
  })

  const pagedDL = computed(() => toPageResult(filteredDL.value, dlPage.value, dlPageSize.value))

  const detailMetaRows = computed(() => {
    const r = detailRow.value
    if (!r) return []
    return [
      { label: '来源类型', value: r.sourceType ?? '' },
      { label: '来源 ID', value: String(r.sourceId ?? '') },
      { label: '状态', value: r.replayStatus ?? '' },
    ]
  })

  async function loadDeadLetters() {
    await runLoadDL(async () => {
      dlRows.value = await queryDeadLetters(tenant.tenantId)
    }).catch(() => {
      dlRows.value = []
    })
  }

  function applyFilter() {
    return runSearch(() => {
      dlApplied.sourceType = dlDraft.sourceType.trim()
      dlApplied.sourceId = dlDraft.sourceId.trim()
      dlApplied.keyword = dlDraft.keyword.trim()
      dlPage.value = 1
    })
  }

  function resetFilter() {
    return runReset(() => {
      dlDraft.sourceType = ''
      dlDraft.sourceId = ''
      dlDraft.keyword = ''
      dlApplied.sourceType = ''
      dlApplied.sourceId = ''
      dlApplied.keyword = ''
      dlPage.value = 1
    })
  }

  function onPageSizeChange(s: number) {
    dlPageSize.value = s
    dlPage.value = 1
  }

  function openDetail(row: ConsoleDeadLetterTaskResponse) {
    detailRow.value = row
    detailVisible.value = true
  }

  useTenantReload(() => {
    dlPage.value = 1
    void loadDeadLetters()
  })
</script>
