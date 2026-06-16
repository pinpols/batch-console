<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingDL"
      @search="applyFilter"
      @reset="resetFilter"
      @refresh="() => runRefresh(loadDeadLetters)"
    >
      <el-form-item :label="t('observability.dlqSourceTypeLabel')">
        <el-select
          class="query-w-180"
          v-model="dlDraft.sourceType"
          clearable
          filterable
          :placeholder="t('observability.dlqSourceTypePlaceholder')"
        >
          <el-option v-for="opt in dlSourceTypeOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('observability.dlqSourceIdLabel')">
        <el-input
          class="query-w-200"
          v-model="dlDraft.sourceId"
          clearable
          :placeholder="t('observability.dlqSourceIdPlaceholder')"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
      <el-form-item :label="t('observability.dlqKeywordLabel')">
        <el-input
          class="query-w-220"
          v-model="dlDraft.keyword"
          clearable
          :placeholder="t('observability.dlqKeywordPlaceholder')"
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
      <BulkActionBar
        v-if="bulk.count.value > 0"
        :count="bulk.count.value"
        :running="bulk.running.value"
        @clear="bulk.clear"
      >
        <template #default="{ running }">
          <el-button size="small" type="primary" plain :loading="running" @click="onBulkReplay">
            {{ t('observability.dlqBulkReplay') }}
          </el-button>
        </template>
      </BulkActionBar>
      <el-table
        ref="dlTableRef"
        v-loading="loadingDL"
        :data="pagedDL.records"
        stripe
        border
        :empty-text="t('common.noData')"
        size="small"
        class="console-table"
        @selection-change="bulk.onSelectionChange"
      >
        <el-table-column type="selection" width="44" :selectable="() => true" />
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column
          prop="sourceType"
          :label="t('observability.dlqColSourceType')"
          width="120"
        />
        <el-table-column prop="sourceId" :label="t('observability.dlqColSourceId')" width="100" />
        <el-table-column
          prop="deadLetterReason"
          :label="t('observability.dlqColReason')"
          min-width="250"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="createdAt" :label="t('observability.dlqColFailedAt')" width="160" />
        <el-table-column
          prop="replayCount"
          :label="t('observability.dlqColRetryCount')"
          width="90"
        />
        <el-table-column prop="replayStatus" :label="t('observability.dlqColStatus')" width="100" />
        <el-table-column :label="t('observability.dlqColActions')" width="180" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row)">
                {{ t('observability.dlqActionDetail') }}
              </el-button>
              <el-button
                v-if="isReplayable(row)"
                size="small"
                plain
                type="warning"
                @click="onReplay(row)"
              >
                {{ t('observability.dlqReplay') }}
              </el-button>
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
      v-model:visible="detailVisible"
      :title="t('observability.dlqDetailTitle')"
      :raw="detailRow"
      :meta-rows="detailMetaRows"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { queryDeadLetters, replayDeadLetter } from '@/api/observabilityQueries'

  const { t } = useI18n({ useScope: 'global' })
  import { toPageResult } from '@/api/adapters'
  import BulkActionBar from '@/components/table/BulkActionBar.vue'
  import { useBulkSelection } from '@/composables/useBulkSelection'
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
  const dlPageSize = ref(15)
  const dlDraft = reactive({ sourceType: '', sourceId: '', keyword: '' })
  const dlApplied = reactive({ sourceType: '', sourceId: '', keyword: '' })

  const detailVisible = ref(false)
  const detailRow = ref<ConsoleDeadLetterTaskResponse | null>(null)

  // ── 批量重放:多选 + 单项重放 / 批量重放 ──────────────────────────────
  // 可重放 = replayStatus 为 NEW / FAILED;SUCCESS(已成功)与 GIVE_UP(已放弃)不再重放
  const REPLAYABLE_STATUSES = ['NEW', 'FAILED']
  function isReplayable(row: ConsoleDeadLetterTaskResponse): boolean {
    return REPLAYABLE_STATUSES.includes(String(row.replayStatus ?? '').toUpperCase())
  }
  const dlTableRef = ref<{ clearSelection?: () => void } | null>(null)
  const bulk = useBulkSelection<ConsoleDeadLetterTaskResponse>()
  onMounted(() => bulk.bindTable(dlTableRef.value))

  async function onReplay(row: ConsoleDeadLetterTaskResponse) {
    const label = t('observability.dlqReplay')
    const confirmed = await ElMessageBox.confirm(
      t('observability.dlqReplayConfirm', { id: row.id }),
      label,
      { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') },
    ).catch(() => false)
    if (confirmed === false) return
    try {
      await replayDeadLetter(tenant.tenantId, row.id)
      ElMessage.success(t('observability.dlqReplaySuccess'))
    } catch {
      ElMessage.error(t('observability.dlqReplayFailed'))
    }
    void loadDeadLetters()
  }

  async function onBulkReplay() {
    const eligible = bulk.selected.value.filter(isReplayable)
    if (!eligible.length) {
      ElMessage.warning(t('observability.dlqBulkReplayNone'))
      return
    }
    const label = t('observability.dlqBulkReplay')
    const confirmed = await ElMessageBox.confirm(
      t('bulk.confirmBody', { label, n: eligible.length }),
      label,
      { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') },
    ).catch(() => false)
    if (confirmed === false) return
    await bulk.runBulk(eligible, (r) => replayDeadLetter(tenant.tenantId, r.id), {
      actionLabel: label,
    })
    void loadDeadLetters()
  }

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
      { label: t('observability.dlqMetaSourceType'), value: r.sourceType ?? '' },
      { label: t('observability.dlqMetaSourceId'), value: String(r.sourceId ?? '') },
      { label: t('observability.dlqMetaStatus'), value: r.replayStatus ?? '' },
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
