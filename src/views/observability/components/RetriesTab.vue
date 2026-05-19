<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingRetry"
      @search="applyFilter"
      @reset="resetFilter"
      @refresh="() => runRefresh(loadRetries)"
    >
      <el-form-item :label="t('observability.retryRelatedTypeLabel')">
        <el-select
          class="query-w-180"
          v-model="retryDraft.relatedType"
          clearable
          filterable
          :placeholder="t('observability.retryRelatedTypePlaceholder')"
        >
          <el-option v-for="opt in retryRelatedTypeOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('observability.retryRelatedIdLabel')">
        <el-input
          class="query-w-200"
          v-model="retryDraft.relatedId"
          clearable
          :placeholder="t('observability.retryRelatedIdPlaceholder')"
          @keyup.enter="applyFilter"
        />
      </el-form-item>
      <el-form-item :label="t('observability.retryStatusLabel')">
        <el-select
          class="query-w-180"
          v-model="retryDraft.status"
          clearable
          filterable
          :placeholder="t('observability.retryStatusPlaceholder')"
        >
          <el-option v-for="opt in retryStatusOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </el-form-item>
    </ListPageQueryBar>
    <DataState
      :loading="loadingRetry"
      :error="loadRetryError"
      :has-data="pagedRetries.records.length > 0"
      :on-retry="loadRetries"
    >
      <el-table
        v-loading="loadingRetry"
        :data="pagedRetries.records"
        stripe
        border
        :empty-text="t('common.noData')"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column
          prop="relatedType"
          :label="t('observability.retryColRelatedType')"
          width="120"
        />
        <el-table-column
          prop="relatedId"
          :label="t('observability.retryColRelatedId')"
          width="100"
        />
        <el-table-column
          prop="retryStatus"
          :label="t('observability.retryColStatus')"
          width="120"
        />
        <DatetimeColumn
          prop="nextRetryAt"
          :label="t('observability.retryColNextRetry')"
          width="160"
        />
        <el-table-column
          prop="retryCount"
          :label="t('observability.retryColRetryCount')"
          width="90"
        />
        <el-table-column
          prop="maxRetryCount"
          :label="t('observability.retryColMaxRetry')"
          width="90"
        />
        <DatetimeColumn prop="createdAt" :label="t('observability.retryColCreated')" width="160" />
        <el-table-column :label="t('observability.retryColActions')" width="120" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row)">
                {{ t('observability.retryActionDetail') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </DataState>
    <TablePagerBar
      :page="retryPage"
      :page-size="retryPageSize"
      :total="pagedRetries.total"
      @update:page="(p: number) => (retryPage = p)"
      @update:page-size="onPageSizeChange"
    />

    <DetailDrawer
      v-model:visible="detailVisible"
      :title="t('observability.retryDetailTitle')"
      :raw="detailRow"
      :meta-rows="detailMetaRows"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import { queryRetries } from '@/api/observabilityQueries'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'
  import type { ConsoleRetryScheduleResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const { loading: loadingRetry, error: loadRetryError, run: runLoadRetry } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingRetry)
  const retryRows = ref<ConsoleRetryScheduleResponse[]>([])
  const retryPage = ref(1)
  const retryPageSize = ref(15)
  const retryDraft = reactive({ relatedType: '', relatedId: '', status: '' })
  const retryApplied = reactive({ relatedType: '', relatedId: '', status: '' })

  const detailVisible = ref(false)
  const detailRow = ref<ConsoleRetryScheduleResponse | null>(null)

  const retryRelatedTypeOptions = computed(() =>
    Array.from(
      new Set(
        retryRows.value
          .map((x) => String(x.relatedType ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )

  const retryStatusOptions = computed(() =>
    Array.from(
      new Set(
        retryRows.value
          .map((x) => String(x.retryStatus ?? '').trim())
          .filter((x) => x && x !== 'null' && x !== 'undefined'),
      ),
    ).sort(),
  )

  const filteredRetries = computed(() => {
    let rows = retryRows.value
    const rt = retryApplied.relatedType.trim()
    if (rt) rows = rows.filter((x) => String(x.relatedType ?? '') === rt)
    const rid = retryApplied.relatedId.trim()
    if (rid) rows = rows.filter((x) => String(x.relatedId ?? '') === rid)
    const st = retryApplied.status.trim()
    if (st) rows = rows.filter((x) => String(x.retryStatus ?? '') === st)
    return rows
  })

  const pagedRetries = computed(() =>
    toPageResult(filteredRetries.value, retryPage.value, retryPageSize.value),
  )

  const detailMetaRows = computed(() => {
    const r = detailRow.value
    if (!r) return []
    return [
      { label: t('observability.retryMetaRelatedType'), value: r.relatedType ?? '' },
      { label: t('observability.retryMetaRelatedId'), value: String(r.relatedId ?? '') },
      { label: t('observability.retryMetaStatus'), value: r.retryStatus ?? '' },
    ]
  })

  async function loadRetries() {
    await runLoadRetry(async () => {
      retryRows.value = await queryRetries(tenant.tenantId)
    }).catch(() => {
      retryRows.value = []
    })
  }

  function applyFilter() {
    return runSearch(() => {
      retryApplied.relatedType = retryDraft.relatedType.trim()
      retryApplied.relatedId = retryDraft.relatedId.trim()
      retryApplied.status = retryDraft.status.trim()
      retryPage.value = 1
    })
  }

  function resetFilter() {
    return runReset(() => {
      retryDraft.relatedType = ''
      retryDraft.relatedId = ''
      retryDraft.status = ''
      retryApplied.relatedType = ''
      retryApplied.relatedId = ''
      retryApplied.status = ''
      retryPage.value = 1
    })
  }

  function onPageSizeChange(s: number) {
    retryPageSize.value = s
    retryPage.value = 1
  }

  function openDetail(row: ConsoleRetryScheduleResponse) {
    detailRow.value = row
    detailVisible.value = true
  }

  useTenantReload(() => {
    retryPage.value = 1
    void loadRetries()
  })
</script>
