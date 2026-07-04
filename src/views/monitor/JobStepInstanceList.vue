<template>
  <PageContainer>
    <PageHeader />

    <div>
      <ProTable
        :data="rows"
        :loading="loading"
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
            @search="onQuerySearch"
            @reset="onQueryReset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('monitor.stepInstanceIdLabel')">
              <el-input
                class="query-w-160"
                v-model="filterInstanceId"
                clearable
                :placeholder="t('monitor.stepInstanceIdPlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('monitor.stepStatusLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="filterStepStatus"
                clearable
                filterable
                enum-key="partitionStatus"
                :placeholder="t('monitor.stepStatusPlaceholder')"
                :options="stepStatusOptions"
              />
            </el-form-item>
            <el-form-item>
              <p class="query-hint">{{ t('monitor.stepHint') }}</p>
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="jobInstanceId" :label="t('monitor.stepColInstanceId')" width="100">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/monitor/job-instances/${row.jobInstanceId}`">
              {{ row.jobInstanceId }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column :label="t('monitor.stepColStep')" width="180">
          <template #default="{ row }">
            <div class="cell-stack">
              <span class="cell-main">{{ row.stepCode }}</span>
              <span v-if="row.stepType" class="cell-sub">{{ row.stepType }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="stepStatus" :label="t('monitor.stepColStatus')" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.stepStatus ?? '')" category="partition" />
          </template>
        </el-table-column>
        <el-table-column
          prop="retryCount"
          :label="t('monitor.stepColRetry')"
          width="80"
          align="right"
        />
        <DatetimeColumn prop="startedAt" :label="t('monitor.stepColStarted')" width="160" />
        <DatetimeColumn prop="finishedAt" :label="t('monitor.stepColFinished')" width="160" />
        <el-table-column :label="t('monitor.stepColError')" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.errorCode" class="mono">[{{ row.errorCode }}]</span>
            <span v-if="row.errorMessage">{{ row.errorMessage }}</span>
            <span v-if="!row.errorCode && !row.errorMessage" class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('monitor.stepColActions')" width="110" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="goInstance(row.jobInstanceId)">
                {{ t('monitor.stepActionInstance') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { fetchAllPageItems, toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { ConsoleJobStepInstanceResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  const allRows = ref<ConsoleJobStepInstanceResponse[]>([])
  const filterInstanceId = ref('')
  const filterStepStatus = ref('')
  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const stepStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'partitionStatus'))
  const page = ref(1)
  const pageSize = ref(15)
  const total = ref(0)
  const rows = ref<ConsoleJobStepInstanceResponse[]>([])

  const displayRows = computed(() => {
    let r = allRows.value
    const id = filterInstanceId.value.trim()
    if (id) {
      const n = Number(id)
      if (Number.isFinite(n)) r = r.filter((row) => row.jobInstanceId === n)
    }
    const st = filterStepStatus.value.trim()
    if (st) r = r.filter((row) => String(row.stepStatus ?? '') === st)
    return r
  })

  function slicePage() {
    const list = displayRows.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    rows.value = pr.records as ConsoleJobStepInstanceResponse[]
  }

  function onQuerySearch() {
    return runSearch(() => {
      page.value = 1
      slicePage()
    })
  }

  function onQueryReset() {
    return runReset(() => {
      filterInstanceId.value = ''
      filterStepStatus.value = ''
      page.value = 1
      slicePage()
    })
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      allRows.value = await fetchAllPageItems<ConsoleJobStepInstanceResponse>(
        '/api/console/queries/job-step-instances',
        { tenantId: tenant.tenantId },
      )
      page.value = 1
      slicePage()
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function goInstance(jobInstanceId: number) {
    router.push(`/monitor/job-instances/${jobInstanceId}`)
  }

  {
    const q = route.query.jobInstanceId as string | undefined
    if (q) filterInstanceId.value = q
  }

  useTenantReload(load)
</script>
