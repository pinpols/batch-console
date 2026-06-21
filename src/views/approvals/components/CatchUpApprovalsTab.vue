<template>
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
    <el-table-column prop="requestId" :label="t('approvals.catchUpColRequestId')" min-width="180" />
    <el-table-column prop="jobCode" :label="t('approvals.catchUpColJobCode')" min-width="140" />
    <el-table-column prop="bizDate" :label="t('approvals.catchUpColBizDate')" width="120" />
    <el-table-column prop="requestStatus" :label="t('approvals.colStatus')" width="120">
      <template #default="{ row }">
        <StatusTag :value="String(row.requestStatus ?? '')" category="approval" />
      </template>
    </el-table-column>
    <el-table-column
      prop="traceId"
      :label="t('approvals.catchUpColTrace')"
      min-width="150"
      show-overflow-tooltip
    />
    <DatetimeColumn prop="createdAt" :label="t('approvals.catchUpColCreatedAt')" width="160" />
    <DatetimeColumn prop="updatedAt" :label="t('approvals.catchUpColUpdatedAt')" width="160" />
  </ProTable>
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

  useTenantReload(() => {
    page.value = 1
    void load()
  })
</script>
