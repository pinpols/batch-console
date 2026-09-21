<template>
  <div class="catch-up-tab">
    <ProTable
      :data="rows"
      :loading="tableBlocking"
      :total="total"
      v-model:page="page"
      v-model:page-size="pageSize"
      @change="load"
      @row-click="openDetail"
      :error="loadError"
      :on-retry="load"
      class="catch-up-table"
    >
      <template #query>
        <ListPageQueryBar
          :filter-busy="queryActionBusy"
          :refresh-busy="loading"
          :disabled="loading"
          @search="onSearch"
          @reset="onReset"
          @refresh="() => runRefresh(load)"
        >
          <el-form-item :label="t('approvals.keywordLabel')">
            <el-input
              class="query-w-240"
              v-model="kwDraft"
              clearable
              :placeholder="t('approvals.catchUpKeywordPlaceholder')"
              @keyup.enter="onSearch"
            />
          </el-form-item>
          <el-form-item :label="t('approvals.catchUpColBizDate')">
            <el-date-picker
              class="query-w-160"
              v-model="bizDateDraft"
              type="date"
              value-format="YYYY-MM-DD"
              clearable
              :placeholder="t('approvals.catchUpColBizDate')"
              @keyup.enter="onSearch"
            />
          </el-form-item>
        </ListPageQueryBar>
      </template>
      <el-table-column prop="requestId" :label="t('approvals.catchUpColRequestId')" min-width="180">
        <template #default="{ row }">
          <!-- dump:单号 mono 蓝 -->
          <span class="cu-no">{{ row.requestId }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="jobCode" :label="t('approvals.catchUpColJobCode')" min-width="140">
        <template #default="{ row }">
          <span class="cu-mono">{{ row.jobCode }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="bizDate" :label="t('approvals.catchUpColBizDate')" width="120">
        <template #default="{ row }">
          <span class="cu-mono">{{ row.bizDate }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="requestStatus" :label="t('approvals.colStatus')" width="120">
        <template #default="{ row }">
          <StatusTag :value="String(row.requestStatus ?? '')" category="approval" />
        </template>
      </el-table-column>
      <DatetimeColumn prop="createdAt" :label="t('approvals.catchUpColCreatedAt')" width="160" />
      <el-table-column :label="t('approvals.colActions')" width="96" fixed="right" align="center">
        <template #default="{ row }">
          <el-button size="small" text type="primary" @click.stop="openDetail(row)">
            {{ t('approvals.actionDetail') }}
          </el-button>
        </template>
      </el-table-column>
    </ProTable>

    <DetailDrawer
      v-model:visible="detailVisible"
      :title="t('approvals.catchUpDetailTitle')"
      size="min(40rem, 92vw)"
    >
      <div v-if="detailRow" class="catch-up-detail">
        <div class="catch-up-detail__hero">
          <div>
            <div class="catch-up-detail__label">{{ t('approvals.catchUpColRequestId') }}</div>
            <CopyableText class="cu-no" :text="detailRow.requestId" />
          </div>
          <StatusTag :value="String(detailRow.requestStatus ?? '')" category="approval" />
        </div>
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('approvals.catchUpColJobCode')">
            {{ detailRow.jobCode }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('approvals.catchUpColBizDate')">
            {{ detailRow.bizDate }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('approvals.colApprovalNo')">
            {{ detailRow.approvalNo || '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('approvals.colStatus')">
            {{ detailRow.approvalStatus || detailRow.requestStatus || '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('approvals.catchUpColTrace')">
            <CopyableText :text="detailRow.traceId || '—'" />
          </el-descriptions-item>
          <el-descriptions-item :label="t('approvals.catchUpColCreatedAt')">
            {{ fmtDatetime(detailRow.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('approvals.catchUpColUpdatedAt')">
            {{ fmtDatetime(detailRow.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </DetailDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { queryCatchUpApprovalsPage } from '@/api/approvals'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import type { ConsolePendingCatchUpResponse } from '@/types/console-api'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { fmtDatetime } from '@/utils/datetime'

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
  const rows = ref<ConsolePendingCatchUpResponse[]>([])
  const detailVisible = ref(false)
  const detailRow = ref<ConsolePendingCatchUpResponse | null>(null)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const kwDraft = ref('')
  const bizDateDraft = ref<string | null>(null)
  // applied:实际生效的筛选(传后端),与 draft 解耦,翻页时不受未点搜索的 draft 影响
  const kwApplied = ref('')
  const bizDateApplied = ref('')

  // 服务端分页 + 服务端筛选(bizDate 精确 / keyword 跨 requestId·jobCode·traceId 模糊)。
  // catch-up 列表后端恒为 ACCEPTED 状态,故无 status 维度。
  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const resp = await queryCatchUpApprovalsPage(tenant.tenantId, page.value, pageSize.value, {
        keyword: kwApplied.value || undefined,
        bizDate: bizDateApplied.value || undefined,
      })
      rows.value = (resp.items ?? []) as ConsolePendingCatchUpResponse[]
      total.value = Number(resp.total ?? rows.value.length)
    } catch (err) {
      loadError.value = err
      rows.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  function onSearch() {
    return runSearch(async () => {
      kwApplied.value = kwDraft.value.trim()
      bizDateApplied.value = (bizDateDraft.value ?? '').trim()
      page.value = 1
      await load()
    })
  }

  function onReset() {
    return runReset(async () => {
      kwDraft.value = ''
      bizDateDraft.value = null
      kwApplied.value = ''
      bizDateApplied.value = ''
      page.value = 1
      await load()
    })
  }

  function openDetail(row: ConsolePendingCatchUpResponse) {
    detailRow.value = row
    detailVisible.value = true
  }

  useTenantReload(() => {
    page.value = 1
    void load()
  })
</script>

<style scoped>
  /* dump proto-approvals:单号 mono 蓝、目标 mono */
  .cu-no {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-primary);
  }

  .cu-mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .catch-up-table :deep(.el-table__row) {
    cursor: pointer;
  }

  .catch-up-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .catch-up-detail__hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-md);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-subtle);
  }

  .catch-up-detail__label {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
  }
</style>
