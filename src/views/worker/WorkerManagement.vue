<template>
  <PageContainer>
    <PageHeader />

    <!-- 照设计 proto-workers dump:统计卡位于 tab pill 之上、常显(执行通道 tab 也可见);
         横排状态统计卡(色点 + 标签 + mono 大数),点击联动状态筛选并切回 Workers tab -->
    <div class="wk-stats">
      <button
        v-for="s in statCards"
        :key="s.status"
        type="button"
        class="wk-stat"
        :class="{ 'is-active': workerFilters.status === s.status }"
        @click="toggleStatusFilter(s.status)"
      >
        <span class="wk-stat__dot" :style="{ background: s.color }" />
        <span class="wk-stat__label">{{ s.label }}</span>
        <span class="wk-stat__spacer" />
        <span class="wk-stat__num" :style="s.value > 0 ? { color: s.numColor } : undefined">
          {{ s.value }}
        </span>
      </button>
    </div>

    <!-- 还原设计:tabs 与内容直铺底色,无外层卡片壳 -->
    <div>
      <el-tabs v-model="activeTab" class="pill-tabs">
        <el-tab-pane :label="t('workerManagement.tabWorkers')" name="workers">
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

          <OpsListToolbar
            :status="live.status.value"
            :last-refreshed-at="live.lastRefreshedAt.value"
          />

          <EmptyState
            v-if="!workerTableBlocking && workerTableRows.length === 0"
            variant="tenant-empty"
            :title="t('workerManagement.emptyTitle')"
            :description="workerEmptyDescription"
            :image-size="96"
          >
            <template #action>
              <div class="worker-empty-actions">
                <el-button
                  type="primary"
                  :icon="Refresh"
                  :loading="workerIsFetching"
                  @click="onRefreshWorkers"
                >
                  {{ t('common.refresh') }}
                </el-button>
                <el-button @click="resetWorkers">
                  {{ t('workerManagement.clearFilters') }}
                </el-button>
              </div>
              <div class="worker-empty-meta">
                {{ t('workerManagement.emptyLastRefresh', { time: workerLastRefreshText }) }}
              </div>
            </template>
          </EmptyState>

          <div v-else v-loading="workerTableBlocking" class="wk-grid">
            <div
              v-for="row in workerTableRows"
              :key="row.id"
              class="wk-card"
              :class="cardStateClass(row.status)"
            >
              <div class="wk-card__head">
                <div class="wk-card__id">
                  <CopyableText class="wk-card__code" :text="row.workerCode" />
                  <div class="wk-card__group">{{ row.workerGroup }}</div>
                </div>
              </div>
              <div class="wk-card__meta">
                <StatusTag :value="String(row.status ?? '')" category="worker" />
                <span class="wk-card__spacer" />
                <span class="wk-card__hb" :title="String(row.heartbeatAt ?? '')">
                  ♥ {{ relTime(row.heartbeatAt) }}
                </span>
              </div>
              <!-- 负载:后端仅有 currentLoad(无容量分母),显示真实数字;
                   mini bar 为相对当前列表峰值的比例,title 注明口径,不编造 x/y 分母 -->
              <div class="wk-card__loadrow" :title="t('workerManagement.loadBarTitle')">
                <div class="wk-card__bar">
                  <div class="wk-card__bar-fill" :style="{ width: loadBarWidth(row) }" />
                </div>
                <span class="wk-card__load">{{ row.currentLoad ?? 0 }}</span>
              </div>
              <div class="wk-card__actions">
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
            </div>
          </div>

          <TablePagerBar
            :page="workerPage"
            :page-size="workerPageSize"
            :total="workerTotal"
            @update:page="(p: number) => (workerPage = p)"
            @update:page-size="
              (s: number) => {
                workerPageSize = s
                workerPage = 1
              }
            "
          />
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
    </div>

    <el-drawer
      :append-to-body="true"
      v-model="channelDetailVisible"
      :title="t('workerManagement.channelDetailTitle')"
      size="640px"
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
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { RefreshCw as Refresh } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { useQueryClient } from '@tanstack/vue-query'
  import { useRoute } from 'vue-router'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const route = useRoute()
  import { useListLoadState } from '@/composables/useListLoadState'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantReload } from '@/composables/useTenantReload'
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
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import type { ConsoleWorkerRegistryResponse } from '@/types/console-api'
  import type { ConsoleFileChannelResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const queryClient = useQueryClient()
  const activeTab = ref('workers')

  // ═══════════════════════════════════════
  // Worker 列表
  // ═══════════════════════════════════════
  const workerPage = ref(1)
  const workerPageSize = ref(15)

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
    if (s) {
      // 支持 CSV 多值,如 OpsSummary「离线 Worker」卡片传 "OFFLINE,DECOMMISSIONED"
      // 与计数语义(OFFLINE + DECOMMISSIONED)对齐
      const wanted = new Set(
        s
          .split(',')
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean),
      )
      r = r.filter((x) => wanted.has(String(x.status ?? '').toUpperCase()))
    }
    const k = workerFilters.keyword.trim()
    if (k) r = r.filter((x) => String(x.workerCode ?? '').includes(k))
    return r
  })

  const workerTotal = computed(() => filteredWorkers.value.length)
  const workerHasActiveFilters = computed(() =>
    Boolean(
      workerFilters.workerGroup.trim() ||
      workerFilters.status.trim() ||
      workerFilters.keyword.trim(),
    ),
  )
  const workerFilteredEmptyText = computed(() => t('workerManagement.emptyFiltered'))
  const workerEmptyDescription = computed(() =>
    t('workerManagement.emptyDescription', { tenant: tenant.tenantId || '—' }),
  )
  const workerLastRefreshText = computed(() =>
    live.lastRefreshedAt.value ? live.lastRefreshedAt.value.toLocaleString() : '—',
  )

  const workerTableRows = computed(() => {
    const pr = toPageResult(filteredWorkers.value, workerPage.value, workerPageSize.value)
    return pr.records
  })

  // 状态统计卡(还原设计 workercards):按全量(未过滤)数据聚合,点击联动状态筛选
  const workerStats = computed(() => {
    const all = allWorkerData.value ?? []
    const by = (s: string) => all.filter((x) => String(x.status ?? '').toUpperCase() === s).length
    return { online: by('ONLINE'), draining: by('DRAINING'), offline: by('OFFLINE') }
  })

  function toggleStatusFilter(status: string) {
    workerFilters.status = workerFilters.status === status ? '' : status
    workerPage.value = 1
    // 统计卡常显(含执行通道 tab):点击筛选时切回 Workers tab 展示结果
    activeTab.value = 'workers'
  }

  // 照 dump 统计卡三件套(在线/Draining/离线):色点 + 标签 + mono 数值
  const statCards = computed(() => [
    {
      status: 'ONLINE',
      label: t('workerManagement.statOnline'),
      value: workerStats.value.online,
      color: 'var(--color-success)',
      numColor: 'var(--color-text-primary)',
    },
    {
      status: 'DRAINING',
      label: 'Draining',
      value: workerStats.value.draining,
      color: 'var(--color-warning)',
      numColor: 'var(--color-warning)',
    },
    {
      status: 'OFFLINE',
      label: t('workerManagement.statOffline'),
      value: workerStats.value.offline,
      color: 'var(--color-danger)',
      numColor: 'var(--color-danger)',
    },
  ])

  /** 卡片描边跟状态走(dump:Draining=warning 边、离线=danger 边) */
  function cardStateClass(status: string | null | undefined) {
    const s = String(status ?? '').toUpperCase()
    if (s === 'DRAINING') return 'wk-card--draining'
    if (s === 'OFFLINE' || s === 'DECOMMISSIONED') return 'wk-card--offline'
    return ''
  }

  // mini bar 口径:相对当前筛选结果中的负载峰值(后端无容量分母,不编造 x/y)
  const workerLoadPeak = computed(() =>
    filteredWorkers.value.reduce((m, x) => Math.max(m, Number(x.currentLoad ?? 0)), 0),
  )

  function loadBarWidth(row: ConsoleWorkerRegistryResponse): string {
    const peak = workerLoadPeak.value
    const load = Number(row.currentLoad ?? 0)
    if (!peak || !Number.isFinite(load) || load <= 0) return '0%'
    return `${Math.min(100, Math.round((load / peak) * 100))}%`
  }

  /** 心跳相对时间(设计「♥ 3s 前」) */
  function relTime(iso: string | null | undefined): string {
    if (!iso) return '—'
    const diff = Date.now() - new Date(iso).getTime()
    if (!Number.isFinite(diff) || diff < 0) return '—'
    const s = Math.floor(diff / 1000)
    if (s < 60) return t('workerManagement.hbSecondsAgo', { n: s })
    const m = Math.floor(s / 60)
    if (m < 60) return t('workerManagement.hbMinutesAgo', { n: m })
    const h = Math.floor(m / 60)
    return t('workerManagement.hbHoursAgo', { n: h })
  }

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
    // TanStack refetch 返回 Promise<QueryObserverResult>,runWorkerRefresh 期望 void;
    // 这里把返回值丢弃,只关心副作用刷新。
    return runWorkerRefresh(async () => {
      await refetchWorkers()
    })
  }

  const live = useSseAutoReload({
    domain: 'workers',
    reload: async () => {
      try {
        await refetchWorkers()
      } finally {
        live.markRefreshed()
      }
    },
    scope: () => tenant.tenantId,
  })

  async function drain(row: ConsoleWorkerRegistryResponse) {
    try {
      await confirmDanger({
        verb: t('workerManagement.drainConfirmTitle'),
        target: '',
        consequence: t('workerManagement.drainConfirmText', { code: row.workerCode }),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
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
  const channelPageSize = ref(15)

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
    if (!tenant.tenantId) return
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

  useTenantReload(loadChannels)
</script>

<style scoped>
  .worker-empty-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .worker-empty-meta {
    width: 100%;
    margin-top: 4px;
    text-align: center;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  /* ── 照设计 proto-workers dump(docs/redesign/proto-workers.html) ── */
  /* 统计卡:横排 色点 + 标签 + spacer + mono 22px 数值,卡底 r12 padding 14 18 */
  .wk-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }

  .wk-stat {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition:
      border-color 120ms ease,
      background 120ms ease;
  }

  .wk-stat:hover {
    border-color: var(--color-border-strong, rgba(255, 255, 255, 0.16));
    background: color-mix(in srgb, var(--color-bg-card) 94%, var(--color-primary) 6%);
  }

  .wk-stat.is-active {
    border-color: var(--color-primary);
  }

  .wk-stat__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .wk-stat__label {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .wk-stat__spacer,
  .wk-card__spacer {
    flex: 1;
  }

  .wk-stat__num {
    font-family: var(--font-mono);
    font-size: 22px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  /* Worker 卡片:r14 padding 16 18,auto-fill 网格 */
  .wk-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
    margin-top: 4px;
  }

  .wk-card {
    display: flex;
    flex-direction: column;
    padding: 16px 18px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    box-shadow: var(--shadow-card);
  }

  .wk-card--draining {
    border-color: var(--color-warning);
  }

  .wk-card--offline {
    border-color: var(--color-danger);
  }

  .wk-card__head {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .wk-card__id {
    min-width: 0;
    flex: 1;
  }

  .wk-card__code {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wk-card__group {
    margin-top: 2px;
    font-size: 11.5px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wk-card__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
  }

  .wk-card__hb {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  /* 负载行:mini bar(5px 圆角轨道)+ 真实负载数(mono,右对齐) */
  .wk-card__loadrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }

  .wk-card__bar {
    flex: 1;
    height: 5px;
    border-radius: 3px;
    background: var(--color-bg-elevated);
    overflow: hidden;
  }

  .wk-card__bar-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--color-primary);
  }

  .wk-card__load {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-secondary);
    min-width: 24px;
    text-align: right;
  }

  .wk-card__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 14px;
    padding-top: 13px;
    border-top: 1px solid var(--color-border);
  }

  .wk-card__actions .el-button + .el-button {
    margin-left: 0;
  }

  @media (max-width: 900px) {
    .wk-stats {
      grid-template-columns: 1fr;
    }
  }
</style>
