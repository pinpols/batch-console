<template>
  <PageContainer>
    <PageHeader
      title="作业步骤"
      description="多页聚合为全量后在浏览器筛选；步骤状态为分区状态枚举下拉。"
    />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="loading"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            @search="onQuerySearch"
            @reset="onQueryReset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item label="实例 Id">
              <el-input
                class="query-w-160"
                v-model="filterInstanceId"
                clearable
                placeholder="精确匹配 jobInstanceId"
              />
            </el-form-item>
            <el-form-item label="步骤状态">
              <el-select
                class="query-w-200"
                v-model="filterStepStatus"
                clearable
                filterable
                placeholder="全部步骤状态"
              >
                <el-option
                  v-for="opt in stepStatusOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <p class="query-hint">
                数据为接口分页拉全量后的本地过滤；实例多时首次加载可能较慢，建议填实例 Id
                缩小范围后再查。
              </p>
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="jobInstanceId" label="实例 Id" width="100">
          <template #default="{ row }">
            <router-link class="cell-link" :to="`/monitor/job-instances/${row.jobInstanceId}`">
              {{ row.jobInstanceId }}
            </router-link>
          </template>
        </el-table-column>
        <el-table-column prop="stepCode" label="步骤" width="140" />
        <el-table-column prop="stepStatus" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.stepStatus ?? '')" category="partition" />
          </template>
        </el-table-column>
        <el-table-column prop="errorMessage" label="错误" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="goInstance(row.jobInstanceId)"
                >实例</el-button
              >
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { fetchAllPageItems, toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import type { ConsoleJobStepInstanceResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
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
  const pageSize = ref(20)
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
    try {
      allRows.value = await fetchAllPageItems<ConsoleJobStepInstanceResponse>(
        '/api/console/queries/job-step-instances',
        { tenantId: tenant.tenantId },
      )
      page.value = 1
      slicePage()
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
