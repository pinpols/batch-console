<template>
  <PageContainer>
    <PageHeader title="Worker" description="Worker 注册列表与文件渠道管理。" />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <!-- Worker 列表 -->
        <el-tab-pane label="Worker 列表" name="workers">
          <ProTable
            :data="workerTableRows"
            :loading="workerTableBlocking"
            :total="workerTotal"
            v-model:page="workerPage"
            v-model:page-size="workerPageSize"
            @change="() => {}"
          >
            <template #query>
              <ListPageQueryBar
                :model="workerFilters"
                :filter-busy="workerQueryBusy"
                :refresh-busy="workerIsFetching"
                :disabled="workerIsPending"
                @search="onWorkerSearch"
                @reset="resetWorkers"
                @refresh="onRefreshWorkers"
              >
                <el-form-item label="组">
                  <el-select
                    class="query-w-180"
                    v-model="workerFilters.workerGroup"
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
                    v-model="workerFilters.status"
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
                <el-form-item label="关键字">
                  <el-input
                    class="query-w-200"
                    v-model="workerFilters.keyword"
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
                  <el-button size="small" plain type="danger" @click="offline(row)"
                    >强制下线</el-button
                  >
                  <el-button size="small" plain @click="takeover(row)">接管</el-button>
                  <el-button size="small" plain type="success" @click="warmup(row)">预热</el-button>
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>

        <!-- 文件渠道 -->
        <el-tab-pane label="文件渠道" name="channels">
          <ProTable
            :data="channelRows"
            :loading="channelTableBlocking"
            :total="channelTotal"
            v-model:page="channelPage"
            v-model:page-size="channelPageSize"
            @change="sliceChannelPage"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="channelQueryBusy"
                :refresh-busy="channelLoading"
                :disabled="channelLoading"
                @search="onChannelSearch"
                @reset="resetChannels"
                @refresh="() => runChannelRefresh(loadChannels)"
              >
                <el-form-item label="渠道编码">
                  <el-input
                    class="query-w-180"
                    v-model="channelFilters.channelCode"
                    clearable
                    placeholder="渠道编码，模糊匹配"
                  />
                </el-form-item>
                <el-form-item label="类型">
                  <el-select
                    class="query-w-160"
                    v-model="channelFilters.channelType"
                    clearable
                    filterable
                    placeholder="全部渠道类型"
                  >
                    <el-option
                      v-for="option in channelTypeOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="channelCode" label="渠道编码" min-width="140" />
            <el-table-column prop="channelType" label="类型" width="120" />
            <el-table-column label="启用" width="90">
              <template #default="{ row }">
                <StatusTag :value="String(row.enabled)" category="yn" />
              </template>
            </el-table-column>
            <el-table-column prop="timeoutSeconds" label="超时(s)" width="100" />
            <DatetimeColumn prop="updatedAt" label="更新" width="160" />
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openChannelDetail(row)"
                    >详情</el-button
                  >
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <!-- 渠道详情抽屉 -->
    <el-drawer v-model="channelDetailVisible" title="渠道详情" size="680px">
      <el-descriptions v-if="channelDetailRow" :column="2" border size="small">
        <el-descriptions-item label="channelCode">{{
          channelDetailRow.channelCode
        }}</el-descriptions-item>
        <el-descriptions-item label="channelType">{{
          channelDetailRow.channelType
        }}</el-descriptions-item>
        <el-descriptions-item label="enabled">{{
          channelDetailRow.enabled ? '是' : '否'
        }}</el-descriptions-item>
        <el-descriptions-item label="timeoutSeconds">{{
          channelDetailRow.timeoutSeconds ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="updatedAt" :span="2">{{
          channelDetailRow.updatedAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="原始响应" :span="2">
          <pre class="json-preview">{{ JSON.stringify(channelDetailRow, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch, onMounted } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useQueryClient } from '@tanstack/vue-query'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useWorkers } from '@/composables/queries/useWorkers'
  import {
    useConsoleMetaEnumsQuery,
    useMetaWorkerGroupsQuery,
  } from '@/composables/queries/useConsoleMeta'
  import { drainWorker, forceWorkerOffline, takeoverWorker, warmupWorker } from '@/api/workers'
  import { getMetaEnums, type MetaOption } from '@/api/meta'
  import { queryFileChannels } from '@/api/fileChannelsQuery'
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
  import type { ConsoleFileChannelResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const queryClient = useQueryClient()
  const activeTab = ref('workers')

  // ═══════════════════════════════════════
  // Worker 列表
  // ═══════════════════════════════════════
  const workerPage = ref(1)
  const workerPageSize = ref(20)

  const {
    data: allWorkerData,
    isPending: workerIsPending,
    isFetching: workerIsFetching,
    refetch: refetchWorkers,
  } = useWorkers()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const { data: workerGroupMeta } = useMetaWorkerGroupsQuery()

  const {
    filterBusy: workerQueryBusy,
    tableBlocking: workerTableBlocking,
    runSearch: runWorkerSearch,
    runReset: runWorkerReset,
    runRefresh: runWorkerRefresh,
  } = useListFilterFeedback(workerIsPending)

  const workerFilters = reactive({ workerGroup: '', status: '', keyword: '' })

  const workerGroupOptions = computed(() => {
    const api = workerGroupMeta.value ?? []
    if (api.length) return api
    return uniqueFieldValues(allWorkerData.value ?? [], (x) => x.workerGroup).map((value) => ({
      value,
      label: value,
    }))
  })

  const workerStatusOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'workerStatus'))

  const filteredWorkers = computed(() => {
    let r = allWorkerData.value ?? []
    const g = workerFilters.workerGroup.trim()
    if (g) r = r.filter((x) => String(x.workerGroup ?? '') === g)
    const s = workerFilters.status.trim()
    if (s) r = r.filter((x) => String(x.status ?? '').toUpperCase() === s.toUpperCase())
    const k = workerFilters.keyword.trim()
    if (k) r = r.filter((x) => String(x.workerCode ?? '').includes(k))
    return r
  })

  const workerTotal = computed(() => filteredWorkers.value.length)

  const workerTableRows = computed(() => {
    const pr = toPageResult(filteredWorkers.value, workerPage.value, workerPageSize.value)
    return pr.records
  })

  function onWorkerSearch() {
    return runWorkerSearch(() => {
      workerPage.value = 1
    })
  }

  function resetWorkers() {
    return runWorkerReset(() => {
      workerFilters.workerGroup = ''
      workerFilters.status = ''
      workerFilters.keyword = ''
      workerPage.value = 1
    })
  }

  function onRefreshWorkers() {
    return runWorkerRefresh(() => refetchWorkers())
  }

  useSseAutoReload({
    domain: 'workers',
    reload: () => refetchWorkers(),
    scope: () => tenant.tenantId,
  })

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

  // ═══════════════════════════════════════
  // 文件渠道
  // ═══════════════════════════════════════
  const channelLoading = ref(false)
  const {
    filterBusy: channelQueryBusy,
    tableBlocking: channelTableBlocking,
    runSearch: runChannelSearch,
    runReset: runChannelReset,
    runRefresh: runChannelRefresh,
  } = useListFilterFeedback(channelLoading)
  const allChannelRows = ref<ConsoleFileChannelResponse[]>([])
  const channelRows = ref<ConsoleFileChannelResponse[]>([])
  const channelTypeOptions = ref<MetaOption[]>([])
  const channelDetailVisible = ref(false)
  const channelDetailRow = ref<ConsoleFileChannelResponse | null>(null)
  const channelTotal = ref(0)
  const channelPage = ref(1)
  const channelPageSize = ref(20)

  const channelFilters = reactive({ channelCode: '', channelType: '' })

  const filteredChannels = computed(() => {
    let r = allChannelRows.value
    const c = channelFilters.channelCode.trim()
    if (c) r = r.filter((x) => String(x.channelCode ?? '').includes(c))
    const t = channelFilters.channelType.trim()
    if (t) r = r.filter((x) => String(x.channelType ?? '').includes(t))
    return r
  })

  function sliceChannelPage() {
    const list = filteredChannels.value
    channelTotal.value = list.length
    const pr = toPageResult(list, channelPage.value, channelPageSize.value)
    channelRows.value = pr.records as ConsoleFileChannelResponse[]
  }

  async function loadChannels() {
    channelLoading.value = true
    try {
      allChannelRows.value = await queryFileChannels(tenant.tenantId)
      const enums = await getMetaEnums()
      channelTypeOptions.value = enums.channelType ?? []
      channelPage.value = 1
      sliceChannelPage()
    } finally {
      channelLoading.value = false
    }
  }

  function onChannelSearch() {
    return runChannelSearch(() => {
      channelPage.value = 1
      sliceChannelPage()
    })
  }

  function resetChannels() {
    return runChannelReset(() => {
      channelFilters.channelCode = ''
      channelFilters.channelType = ''
      channelPage.value = 1
      sliceChannelPage()
    })
  }

  function openChannelDetail(row: ConsoleFileChannelResponse) {
    channelDetailRow.value = row
    channelDetailVisible.value = true
  }

  watch(channelFilters, () => {
    channelPage.value = 1
    sliceChannelPage()
  })

  watch(
    () => tenant.tenantId,
    () => {
      void loadChannels()
    },
  )

  onMounted(() => {
    void loadChannels()
  })
</script>

<style scoped></style>
