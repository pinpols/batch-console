<template>
  <PageContainer>
    <PageHeader
      title="Worker 列表"
      description="租户 Worker 注册表；组名与状态以下拉为准（选项来自当前已加载数据或固定枚举）。"
    />

    <SectionCard>
      <ProTable
        :data="tableRows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="() => {}"
      >
        <template #query>
          <ListPageQueryBar
            :model="filters"
            :filter-busy="queryActionBusy"
            :refresh-busy="isFetching"
            :disabled="isPending"
            @search="onSearch"
            @reset="reset"
            @refresh="onRefreshWorkers"
          >
            <el-form-item label="组">
              <el-select
                class="query-w-180"
                v-model="filters.workerGroup"
                clearable
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入 workerGroup"
              >
                <el-option
                  v-for="o in workerGroupOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select
                class="query-w-200"
                v-model="filters.status"
                clearable
                placeholder="全部连接状态"
              >
                <el-option
                  v-for="opt in workerStatusOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="编码">
              <el-input
                class="query-w-180"
                v-model="filters.keyword"
                clearable
                placeholder="按 workerCode 模糊匹配"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="workerCode" label="Worker" min-width="140">
          <template #default="{ row }">
            <CopyableText :text="row.workerCode" />
          </template>
        </el-table-column>
        <el-table-column prop="workerGroup" label="组" width="120" />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.status ?? '')" category="worker" />
          </template>
        </el-table-column>
        <el-table-column prop="currentLoad" label="负载" width="80" />
        <DatetimeColumn prop="heartbeatAt" label="心跳" width="160" />
        <el-table-column label="治理" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="warning" @click="drain(row)">Drain</el-button>
              <el-button size="small" plain type="danger" @click="offline(row)">强制下线</el-button>
              <el-button size="small" plain @click="takeover(row)">接管</el-button>
              <el-button size="small" plain type="success" @click="warmup(row)">预热</el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useQueryClient } from '@tanstack/vue-query'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useWorkers } from '@/composables/queries/useWorkers'
  import {
    useConsoleMetaEnumsQuery,
    useMetaWorkerGroupsQuery,
  } from '@/composables/queries/useConsoleMeta'
  import { drainWorker, forceWorkerOffline, takeoverWorker, warmupWorker } from '@/api/workers'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { uniqueFieldValues } from '@/utils/queryFormOptions'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import type { ConsoleWorkerRegistryResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const queryClient = useQueryClient()
  const page = ref(1)
  const pageSize = ref(20)

  const { data: allData, isPending, isFetching, refetch } = useWorkers()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const { data: workerGroupMeta } = useMetaWorkerGroupsQuery()

  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(isPending)

  const filters = reactive({
    workerGroup: '',
    status: '',
    keyword: '',
  })

  const workerGroupOptions = computed(() => {
    const api = workerGroupMeta.value ?? []
    if (api.length) return api
    return uniqueFieldValues(allData.value ?? [], (x) => x.workerGroup).map((value) => ({
      value,
      label: value,
    }))
  })

  const workerStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'workerStatus'))

  const filtered = computed(() => {
    let r = allData.value ?? []
    const g = filters.workerGroup.trim()
    if (g) r = r.filter((x) => String(x.workerGroup ?? '') === g)
    const s = filters.status.trim()
    if (s) r = r.filter((x) => String(x.status ?? '').toUpperCase() === s.toUpperCase())
    const k = filters.keyword.trim()
    if (k) r = r.filter((x) => String(x.workerCode ?? '').includes(k))
    return r
  })

  const total = computed(() => filtered.value.length)

  const tableRows = computed(() => {
    const pr = toPageResult(filtered.value, page.value, pageSize.value)
    return pr.records
  })

  function onSearch() {
    return runSearch(() => {
      page.value = 1
    })
  }

  function reset() {
    return runReset(() => {
      filters.workerGroup = ''
      filters.status = ''
      filters.keyword = ''
      page.value = 1
    })
  }

  function onRefreshWorkers() {
    void refetch()
  }

  async function drain(row: ConsoleWorkerRegistryResponse) {
    try {
      await ElMessageBox.confirm(`对 ${row.workerCode} 发起 drain？`, 'Drain', { type: 'warning' })
      await drainWorker(row.workerCode, { tenantId: tenant.tenantId, reason: 'console drain' })
      ElMessage.success(`已对 ${row.workerCode} 发起 Drain`)
      await queryClient.invalidateQueries({ queryKey: ['workers', tenant.tenantId] })
    } catch {
      /* cancel */
    }
  }

  async function takeover(row: ConsoleWorkerRegistryResponse) {
    try {
      await ElMessageBox.confirm(`接管 ${row.workerCode} 的任务？`, '接管', { type: 'warning' })
      await takeoverWorker(row.workerCode, {
        tenantId: tenant.tenantId,
        reason: 'console takeover',
      })
      ElMessage.success(`已接管 ${row.workerCode}`)
      await queryClient.invalidateQueries({ queryKey: ['workers', tenant.tenantId] })
    } catch {
      /* cancel */
    }
  }

  async function warmup(row: ConsoleWorkerRegistryResponse) {
    try {
      await warmupWorker(row.workerCode, tenant.tenantId)
      ElMessage.success(`已对 ${row.workerCode} 发起预热`)
    } catch {
      /* cancel */
    }
  }

  async function offline(row: ConsoleWorkerRegistryResponse) {
    try {
      await ElMessageBox.confirm(`强制下线 ${row.workerCode}？`, '强制下线', { type: 'warning' })
      await forceWorkerOffline(row.workerCode, {
        tenantId: tenant.tenantId,
        reason: 'console offline',
      })
      ElMessage.success(`已强制下线 ${row.workerCode}`)
      await queryClient.invalidateQueries({ queryKey: ['workers', tenant.tenantId] })
    } catch {
      /* cancel */
    }
  }
</script>
