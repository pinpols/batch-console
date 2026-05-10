<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingReceipts"
      @search="applyFilter"
      @reset="resetFilter"
      @refresh="() => runRefresh(loadChannelReceipts)"
    >
      <el-form-item label="渠道">
        <el-input
          class="query-w-220"
          v-model="receiptDraft.channelCode"
          clearable
          placeholder="模糊匹配"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
      <el-form-item label="文件 ID">
        <el-input
          class="query-w-200"
          v-model="receiptDraft.fileId"
          clearable
          placeholder="精确匹配"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
      <el-form-item label="回执状态">
        <el-select
          class="query-w-180"
          v-model="receiptDraft.status"
          clearable
          filterable
          placeholder="全部"
        >
          <el-option v-for="opt in receiptStatusOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
    </ListPageQueryBar>
    <DataState
      :loading="loadingReceipts"
      :error="loadReceiptsError"
      :has-data="pagedReceipts.records.length > 0"
      :on-retry="loadChannelReceipts"
    >
      <el-table
        v-loading="loadingReceipts"
        :data="pagedReceipts.records"
        stripe
        border
        empty-text="暂无数据"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="channelCode" label="渠道" min-width="160" show-overflow-tooltip />
        <el-table-column prop="fileId" label="文件 ID" width="100" />
        <el-table-column prop="dispatchStatus" label="投递状态" width="100" />
        <el-table-column prop="receiptStatus" label="回执状态" width="100" />
        <el-table-column
          prop="errorMessage"
          label="错误信息"
          min-width="250"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="dispatchedAt" label="投递时间" width="160" />
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
      :page="receiptPage"
      :page-size="receiptPageSize"
      :total="pagedReceipts.total"
      @update:page="(p: number) => (receiptPage = p)"
      @update:page-size="onPageSizeChange"
    />

    <DetailDrawer
      v-model="detailVisible"
      title="Channel 回执详情"
      :raw="detailRow"
      :meta-rows="detailMetaRows"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { queryChannelReceipts } from '@/api/observabilityQueries'
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
  const {
    loading: loadingReceipts,
    error: loadReceiptsError,
    run: runLoadReceipts,
  } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingReceipts)
  const receiptRows = ref<Record<string, unknown>[]>([])
  const receiptPage = ref(1)
  const receiptPageSize = ref(20)
  const receiptDraft = reactive({ channelCode: '', fileId: '', status: '' })
  const receiptApplied = reactive({ channelCode: '', fileId: '', status: '' })

  const detailVisible = ref(false)
  const detailRow = ref<Record<string, unknown> | null>(null)

  const receiptStatusOptions = computed(() =>
    Array.from(
      new Set(
        receiptRows.value
          .map((x) => String(x.receiptStatus ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )

  const filteredReceipts = computed(() => {
    let rows = receiptRows.value
    const cc = receiptApplied.channelCode.trim().toLowerCase()
    if (cc)
      rows = rows.filter((x) =>
        String(x.channelCode ?? '')
          .toLowerCase()
          .includes(cc),
      )
    const fid = receiptApplied.fileId.trim()
    if (fid) rows = rows.filter((x) => String(x.fileId ?? '') === fid)
    const st = receiptApplied.status.trim()
    if (st) rows = rows.filter((x) => String(x.receiptStatus ?? '') === st)
    return rows
  })

  const pagedReceipts = computed(() =>
    toPageResult(filteredReceipts.value, receiptPage.value, receiptPageSize.value),
  )

  const detailMetaRows = computed(() => {
    const r = detailRow.value ?? {}
    return [
      { label: '渠道', value: pickString(r, 'channelCode') },
      { label: '文件 ID', value: pickString(r, 'fileId') },
      { label: '回执状态', value: pickString(r, 'receiptStatus') },
    ]
  })

  function pickString(row: Record<string, unknown>, key: string): string {
    const v = row[key]
    if (v == null) return ''
    return typeof v === 'string' ? v : String(v)
  }

  async function loadChannelReceipts() {
    await runLoadReceipts(async () => {
      receiptRows.value = (await queryChannelReceipts(tenant.tenantId)) as Record<string, unknown>[]
    }).catch(() => {
      receiptRows.value = []
    })
  }

  function applyFilter() {
    return runSearch(() => {
      receiptApplied.channelCode = receiptDraft.channelCode.trim()
      receiptApplied.fileId = receiptDraft.fileId.trim()
      receiptApplied.status = receiptDraft.status.trim()
      receiptPage.value = 1
    })
  }

  function resetFilter() {
    return runReset(() => {
      receiptDraft.channelCode = ''
      receiptDraft.fileId = ''
      receiptDraft.status = ''
      receiptApplied.channelCode = ''
      receiptApplied.fileId = ''
      receiptApplied.status = ''
      receiptPage.value = 1
    })
  }

  function onPageSizeChange(s: number) {
    receiptPageSize.value = s
    receiptPage.value = 1
  }

  function openDetail(row: Record<string, unknown>) {
    detailRow.value = row
    detailVisible.value = true
  }

  useTenantReload(() => {
    receiptPage.value = 1
    void loadChannelReceipts()
  })
</script>
