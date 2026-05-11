<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('workerManagement.tabWorkers')" name="workers">
          <ProTable
            :data="workerTableRows"
            :loading="workerTableBlocking"
            :error="workerLoadError"
            :on-retry="refetchWorkers"
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
                <el-form-item :label="t('workerManagement.groupLabel')">
                  <MetaSelect
                    class="query-w-180"
                    v-model="workerFilters.workerGroup"
                    clearable
                    filterable
                    allow-create
                    default-first-option
                    :placeholder="t('workerManagement.groupPlaceholder')"
                    :options="workerGroupOptions"
                  />
                </el-form-item>
                <el-form-item :label="t('workerManagement.statusLabel')">
                  <MetaSelect
                    class="query-w-200"
                    v-model="workerFilters.status"
                    clearable
                    enum-key="workerStatus"
                    :placeholder="t('workerManagement.statusPlaceholder')"
                    :options="workerStatusOptions"
                  />
                </el-form-item>
                <el-form-item :label="t('workerManagement.keywordLabel')">
                  <el-input
                    class="query-w-200"
                    v-model="workerFilters.keyword"
                    clearable
                    :placeholder="t('workerManagement.keywordPlaceholder')"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>

            <el-table-column
              prop="workerCode"
              :label="t('workerManagement.colWorker')"
              min-width="140"
            >
              <template #default="{ row }">
                <CopyableText :text="row.workerCode" />
              </template>
            </el-table-column>
            <el-table-column
              prop="workerGroup"
              :label="t('workerManagement.colGroup')"
              width="120"
            />
            <el-table-column prop="status" :label="t('workerManagement.colStatus')" width="110">
              <template #default="{ row }">
                <StatusTag :value="String(row.status ?? '')" category="worker" />
              </template>
            </el-table-column>
            <el-table-column prop="currentLoad" :label="t('workerManagement.colLoad')" width="80" />
            <DatetimeColumn
              prop="heartbeatAt"
              :label="t('workerManagement.colHeartbeat')"
              width="160"
            />
            <el-table-column :label="t('workerManagement.colActions')" width="220" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="warning" @click="drain(row)">
                    {{ t('workerManagement.actionDrain') }}
                  </el-button>
                  <el-button size="small" plain type="danger" @click="offline(row)">
                    {{ t('workerManagement.actionOffline') }}
                  </el-button>
                  <el-button size="small" plain @click="takeover(row)">
                    {{ t('workerManagement.actionTakeover') }}
                  </el-button>
                  <el-button size="small" plain type="success" @click="warmup(row)">
                    {{ t('workerManagement.actionWarmup') }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>

        <el-tab-pane :label="t('workerManagement.tabChannels')" name="channels">
          <ProTable
            :data="channelRows"
            :loading="channelTableBlocking"
            :error="channelLoadError"
            :on-retry="loadChannels"
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
                <el-form-item :label="t('workerManagement.channelCodeLabel')">
                  <el-input
                    class="query-w-180"
                    v-model="channelFilters.channelCode"
                    clearable
                    :placeholder="t('workerManagement.channelCodePlaceholder')"
                  />
                </el-form-item>
                <el-form-item :label="t('workerManagement.channelTypeLabel')">
                  <MetaSelect
                    class="query-w-160"
                    v-model="channelFilters.channelType"
                    clearable
                    filterable
                    enum-key="channelType"
                    :placeholder="t('workerManagement.channelTypePlaceholder')"
                    :options="channelTypeOptions"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column
              prop="channelCode"
              :label="t('workerManagement.channelColCode')"
              min-width="140"
            />
            <el-table-column
              prop="channelType"
              :label="t('workerManagement.channelColType')"
              width="120"
            />
            <el-table-column :label="t('workerManagement.channelColEnabled')" width="90">
              <template #default="{ row }">
                <StatusTag :value="String(row.enabled)" category="yn" />
              </template>
            </el-table-column>
            <el-table-column
              prop="timeoutSeconds"
              :label="t('workerManagement.channelColTimeout')"
              width="100"
            />
            <DatetimeColumn
              prop="updatedAt"
              :label="t('workerManagement.channelColUpdated')"
              width="160"
            />
            <el-table-column
              :label="t('workerManagement.channelColActions')"
              width="100"
              fixed="right"
            >
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button size="small" plain type="primary" @click="openChannelDetail(row)">
                    {{ t('workerManagement.channelActionDetail') }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <el-drawer
      v-model="channelDetailVisible"
      :title="t('workerManagement.channelDetailTitle')"
      size="680px"
    >
      <el-descriptions v-if="channelDetailRow" :column="2" border size="small">
        <el-descriptions-item label="channelCode">{{
          channelDetailRow.channelCode
        }}</el-descriptions-item>
        <el-descriptions-item label="channelType">{{
          channelDetailRow.channelType
        }}</el-descriptions-item>
        <el-descriptions-item label="enabled">
          {{ channelDetailRow.enabled ? t('workerManagement.yes') : t('workerManagement.no') }}
        </el-descriptions-item>
        <el-descriptions-item label="timeoutSeconds">{{
          channelDetailRow.timeoutSeconds ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="updatedAt" :span="2">{{
          channelDetailRow.updatedAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workerManagement.channelDetailRawResponse')" :span="2">
          <JsonPreview :data="channelDetailRow" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { useQueryClient } from '@tanstack/vue-query'
  import { useRoute } from 'vue-router'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const route = useRoute()
  import { useListLoadState } from '@/composables/useListLoadState'
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
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
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
    error: workerLoadError,
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

  // 接受 ?workerCode / ?status / ?group 深链(从其他页或邮件跳入时自动过滤)
  const workerFilters = reactive({
    workerGroup: (route.query.group as string) || '',
    status: (route.query.status as string) || '',
    keyword: (route.query.workerCode as string) || '',
  })

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
      await ElMessageBox.confirm(
        t('workerManagement.drainConfirmText', { code: row.workerCode }),
        t('workerManagement.drainConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await drainWorker(row.workerCode, { tenantId: tenant.tenantId, reason: 'console drain' })
      ElMessage.success(t('workerManagement.drainSuccess', { code: row.workerCode }))
      await queryClient.invalidateQueries({ queryKey: ['workers', tenant.tenantId] })
    } catch {
      /* cancel */
    }
  }

  async function takeover(row: ConsoleWorkerRegistryResponse) {
    try {
      await ElMessageBox.confirm(
        t('workerManagement.takeoverConfirmText', { code: row.workerCode }),
        t('workerManagement.takeoverConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await takeoverWorker(row.workerCode, {
        tenantId: tenant.tenantId,
        reason: 'console takeover',
      })
      ElMessage.success(t('workerManagement.takeoverSuccess', { code: row.workerCode }))
      await queryClient.invalidateQueries({ queryKey: ['workers', tenant.tenantId] })
    } catch {
      /* cancel */
    }
  }

  async function warmup(row: ConsoleWorkerRegistryResponse) {
    try {
      await warmupWorker(row.workerCode, tenant.tenantId)
      ElMessage.success(t('workerManagement.warmupSuccess', { code: row.workerCode }))
    } catch {
      /* cancel */
    }
  }

  async function offline(row: ConsoleWorkerRegistryResponse) {
    try {
      await confirmDanger({
        verb: t('workerManagement.offlineVerb'),
        target: t('workerManagement.offlineTarget', { code: row.workerCode }),
        consequence: t('workerManagement.offlineConsequence'),
        irreversible: true,
      })
      await forceWorkerOffline(row.workerCode, {
        tenantId: tenant.tenantId,
        reason: 'console offline',
      })
      ElMessage.success(t('workerManagement.offlineSuccess', { code: row.workerCode }))
      await queryClient.invalidateQueries({ queryKey: ['workers', tenant.tenantId] })
    } catch {
      /* cancel */
    }
  }

  // ═══════════════════════════════════════
  // 文件渠道
  // ═══════════════════════════════════════
  const {
    loading: channelLoading,
    error: channelLoadError,
    run: runLoadChannels,
  } = useListLoadState()
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
    await runLoadChannels(async () => {
      allChannelRows.value = await queryFileChannels(tenant.tenantId)
      const enums = await getMetaEnums()
      channelTypeOptions.value = enums.channelType ?? []
      channelPage.value = 1
      sliceChannelPage()
    })
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
