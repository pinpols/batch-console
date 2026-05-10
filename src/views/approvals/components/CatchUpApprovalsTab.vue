<template>
  <ProTable
    :data="rows"
    :loading="tableBlocking"
    :total="total"
    v-model:page="page"
    v-model:page-size="pageSize"
    @change="slicePage"
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
            placeholder="requestId / jobCode / traceId"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item :label="t('approvals.catchUpStatus')">
          <MetaSelect
            class="query-w-180"
            v-model="statusDraft"
            clearable
            filterable
            allow-create
            default-first-option
            enum-key="approvalStatus"
            :placeholder="t('approvals.catchUpStatusPlaceholder')"
            @keyup.enter="onSearch"
            :options="catchUpStatusOptions"
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
    <el-table-column prop="traceId" label="Trace" min-width="150" show-overflow-tooltip />
    <DatetimeColumn prop="createdAt" :label="t('approvals.catchUpColCreatedAt')" width="160" />
    <DatetimeColumn prop="updatedAt" label="updatedAt" width="160" />
  </ProTable>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { fetchAllPageItems, toPageResult } from '@/api/adapters'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { ConsolePendingCatchUpResponse } from '@/types/console-api'
  import MetaSelect from '@/components/common/MetaSelect.vue'
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
  const allRows = ref<ConsolePendingCatchUpResponse[]>([])
  const rows = ref<ConsolePendingCatchUpResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const kwDraft = ref('')
  const statusDraft = ref('')
  const bizDateDraft = ref<string | null>(null)
  const kwApplied = ref('')
  const statusApplied = ref('')
  const bizDateApplied = ref('')

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const catchUpStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'approvalStatus'))

  const filtered = computed(() => {
    let r = allRows.value
    const k = kwApplied.value.trim().toLowerCase()
    if (k) {
      r = r.filter(
        (row) =>
          row.requestId?.toLowerCase().includes(k) ||
          row.jobCode?.toLowerCase().includes(k) ||
          row.traceId?.toLowerCase().includes(k),
      )
    }
    const s = statusApplied.value.trim()
    if (s) r = r.filter((row) => String(row.requestStatus ?? '') === s)
    const b = bizDateApplied.value.trim()
    if (b) r = r.filter((row) => String(row.bizDate ?? '') === b)
    return r
  })

  function slicePage() {
    const list = filtered.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    rows.value = pr.records as ConsolePendingCatchUpResponse[]
  }

  function onSearch() {
    return runSearch(() => {
      kwApplied.value = kwDraft.value.trim()
      statusApplied.value = statusDraft.value.trim()
      bizDateApplied.value = (bizDateDraft.value ?? '').trim()
      page.value = 1
      slicePage()
    })
  }

  function onReset() {
    return runReset(() => {
      kwDraft.value = ''
      statusDraft.value = ''
      bizDateDraft.value = null
      kwApplied.value = ''
      statusApplied.value = ''
      bizDateApplied.value = ''
      page.value = 1
      slicePage()
    })
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      allRows.value = await fetchAllPageItems<ConsolePendingCatchUpResponse>(
        '/api/console/queries/catch-up-approvals',
        { tenantId: tenant.tenantId },
      )
      page.value = 1
      slicePage()
    } catch (err) {
      loadError.value = err
      allRows.value = []
      slicePage()
    } finally {
      loading.value = false
    }
  }

  useTenantReload(() => {
    page.value = 1
    void load()
  })
</script>
