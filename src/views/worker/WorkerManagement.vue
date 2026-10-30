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
    <el-alert
      v-if="workerStats.offline > 0"
      class="wk-offline-notice"
      type="warning"
      :closable="false"
      show-icon
      :title="
        t('workerManagement.offlineWorkersNotice', {
          count: workerStats.offline,
          workers: workerStats.offlineCodes,
        })
      "
    />

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
              <StatusSegment
                v-model="workerStatusSegmentValue"
                :items="workerStatusSegmentItems"
                :aria-label="t('workerManagement.statusLabel')"
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
            v-if="!workerTableBlocking && workerLoadError"
            variant="error"
            :title="t('workerManagement.loadFailed')"
            :description="t('error.subtitle')"
            :image-size="96"
          >
            <template #action>
              <el-button
                type="primary"
                :icon="Refresh"
                :loading="workerIsFetching"
                @click="onRefreshWorkers"
              >
                {{ t('common.retry') }}
              </el-button>
            </template>
          </EmptyState>

          <EmptyState
            v-else-if="!workerTableBlocking && workerTableRows.length === 0"
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
                  <div v-if="row.taskCapabilities?.length" class="wk-card__capabilities">
                    <div
                      v-for="capability in row.taskCapabilities"
                      :key="capability.taskType"
                      class="wk-card__capability"
                      :title="capability.resourceKinds.join(', ')"
                    >
                      <span class="wk-card__task-type">{{ capability.taskType }}</span>
                      <span>{{ capability.resourceKinds.join(', ') }}</span>
                      <span>{{
                        capability.idempotent
                          ? t('workerManagement.idempotent')
                          : t('workerManagement.nonIdempotent')
                      }}</span>
                      <span>{{
                        capability.cancellable
                          ? t('workerManagement.cancellable')
                          : t('workerManagement.notCancellable')
                      }}</span>
                      <span>{{ recommendedTimeoutText(capability.recommendedTimeoutMillis) }}</span>
                    </div>
                  </div>
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
                <el-button size="small" plain :icon="Eye" @click="openClaimedTasks(row)">
                  {{ t('workerManagement.actionClaimedTasks') }}
                </el-button>
                <el-button
                  v-if="canWorkerAction(row.status, 'drain')"
                  size="small"
                  :disabled="!canMutateConfig"
                  plain
                  type="warning"
                  @click="drain(row)"
                >
                  {{ t('workerManagement.actionDrain') }}
                </el-button>
                <el-button
                  v-if="canWorkerAction(row.status, 'offline')"
                  size="small"
                  :disabled="!canMutateConfig"
                  plain
                  type="danger"
                  @click="offline(row)"
                >
                  {{ t('workerManagement.actionOffline') }}
                </el-button>
                <el-button
                  v-if="canWorkerAction(row.status, 'takeover')"
                  size="small"
                  :disabled="!canMutateConfig"
                  plain
                  @click="takeover(row)"
                >
                  {{ t('workerManagement.actionTakeover') }}
                </el-button>
                <el-button
                  v-if="canWorkerAction(row.status, 'warmup')"
                  size="small"
                  :disabled="!canMutateConfig"
                  plain
                  type="success"
                  @click="warmup(row)"
                >
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
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    :icon="Eye"
                    @click="openChannelDetail(row)"
                  >
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
      v-model="claimedTasksVisible"
      :title="t('workerManagement.claimedTasksTitle')"
      size="920px"
    >
      <div v-if="claimedTasksWorker" class="claimed-tasks-context">
        {{ t('workerManagement.claimedTasksWorker', { code: claimedTasksWorker }) }}
        <span v-if="!claimedTasksLoading"> · {{ claimedTaskRows.length }}</span>
      </div>
      <el-alert
        v-if="claimedTasksError"
        type="error"
        :closable="false"
        show-icon
        :title="t('workerManagement.claimedTasksLoadFailed')"
      />
      <el-table v-else v-loading="claimedTasksLoading" :data="claimedTaskRows" size="small" stripe>
        <el-table-column prop="id" :label="t('workerManagement.claimedTaskId')" width="100" />
        <el-table-column
          prop="jobInstanceId"
          :label="t('workerManagement.claimedTaskJob')"
          width="120"
        />
        <el-table-column
          prop="jobPartitionId"
          :label="t('workerManagement.claimedTaskPartition')"
          width="120"
        />
        <el-table-column :label="t('workerManagement.claimedTaskTypeSeq')" width="160">
          <template #default="{ row }">{{ row.taskType }} / {{ row.taskSeq }}</template>
        </el-table-column>
        <el-table-column
          prop="taskStatus"
          :label="t('workerManagement.claimedTaskStatus')"
          width="130"
        />
        <el-table-column
          prop="errorCode"
          :label="t('workerManagement.claimedTaskErrorCode')"
          min-width="140"
        />
        <el-table-column :label="t('workerManagement.claimedTaskStarted')" min-width="170">
          <template #default="{ row }">{{ fmtDatetime(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column :label="t('workerManagement.claimedTaskUpdated')" min-width="170">
          <template #default="{ row }">{{ fmtDatetime(row.updatedAt) }}</template>
        </el-table-column>
        <template #empty>
          {{ t('workerManagement.claimedTasksEmpty') }}
        </template>
      </el-table>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="channelDetailVisible"
      :title="t('workerManagement.channelDetailTitle')"
      size="640px"
    >
      <el-descriptions v-if="channelDetailRow" :column="2" border size="small">
        <el-descriptions-item :label="t('workerManagement.channelCodeLabel')">{{
          channelDetailRow.channelCode
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workerManagement.channelTypeLabel')">{{
          channelDetailRow.channelType
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workerManagement.channelColEnabled')">
          {{ channelDetailRow.enabled ? t('workerManagement.yes') : t('workerManagement.no') }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('workerManagement.channelColTimeout')">{{
          channelDetailRow.timeoutSeconds ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('workerManagement.channelColUpdated')" :span="2">{{
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
  import { Eye } from '@lucide/vue'
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { RefreshCw as Refresh } from '@lucide/vue'

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
  import {
    drainWorker,
    forceWorkerOffline,
    listWorkerClaimedTasks,
    takeoverWorker,
    warmupWorker,
  } from '@/api/workers'
  import { getMetaEnums, type MetaOption } from '@/api/meta'
  import { queryFileChannels } from '@/api/fileChannelsQuery'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { uniqueFieldValues } from '@/utils/queryFormOptions'
  import { useTenantStore } from '@/stores/tenant'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { usePermission } from '@/composables/usePermission'
  import { useAuthStore } from '@/stores/auth'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import StatusSegment, { type StatusSegmentItem } from '@/components/table/StatusSegment.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import OpsListToolbar from '@/components/table/OpsListToolbar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import type {
    ConsoleWorkerClaimedTaskResponse,
    ConsoleWorkerRegistryResponse,
  } from '@/types/console-api'
  import { canWorkerAction, workerActionsForStatus, type WorkerAction } from './workerActions'
  import type { ConsoleFileChannelResponse } from '@/types/console-api'
  import { fmtDatetime, fmtDuration } from '@/utils/datetime'

  const tenant = useTenantStore()
  const { ensureWriteAvailable } = useWriteAvailability()
  const { canMutateConfig } = usePermission()
  const auth = useAuthStore()
  const actionScope = useTenantRequestScope()
  const channelScope = useTenantRequestScope()
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
  const workerErrorAt = ref(0)
  watch(
    workerLoadError,
    (error) => {
      if (error) workerErrorAt.value = Date.now()
    },
    { flush: 'sync' },
  )
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

  const workerStatusSegmentValue = computed({
    get: () => workerFilters.status,
    set: (value: string) => {
      workerFilters.status = value
      workerPage.value = 1
    },
  })

  const workerStatusSegmentItems = computed<StatusSegmentItem[]>(() => [
    { value: '', label: t('common.all'), tone: 'neutral' },
    ...workerStatusOptions.value.map((option) => {
      const value = String(option.value)
      const tone: StatusSegmentItem['tone'] =
        value === 'ONLINE'
          ? 'success'
          : value === 'DRAINING'
            ? 'warning'
            : value === 'OFFLINE'
              ? 'danger'
              : 'muted'
      return { value, label: option.label, tone }
    }),
  ])

  const filteredWorkers = computed(() => {
    let r = allWorkerData.value ?? []
    const g = workerFilters.workerGroup.trim()
    if (g) r = r.filter((x) => String(x.workerGroup ?? '') === g)
    const s = workerFilters.status.trim()
    if (s) {
      // 支持 CSV 多值,如 OpsSummary「离线 Worker」卡片传 "OFFLINE,DECOMMISSIONED"
      // 与计数语义(OFFLINE + DECOMMISSIONED)对齐
      const requestedStatuses = s.split(',')
      const normalizedStatuses = requestedStatuses.map((status) => {
        const trimmedStatus = status.trim()
        return trimmedStatus.toUpperCase()
      })
      const nonEmptyStatuses = normalizedStatuses.filter(Boolean)
      const wanted = new Set(nonEmptyStatuses)
      r = r.filter((worker) => wanted.has(normalizedWorkerStatus(worker.status)))
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
  const workerLastRefreshText = computed(() => fmtDatetime(live.lastRefreshedAt.value))

  const workerTableRows = computed(() => {
    const pr = toPageResult(filteredWorkers.value, workerPage.value, workerPageSize.value)
    return pr.records
  })

  // 状态统计卡(还原设计 workercards):按全量(未过滤)数据聚合,点击联动状态筛选
  function normalizedWorkerStatus(status: string | null | undefined): string {
    const statusText = String(status ?? '')
    return statusText.toUpperCase()
  }

  const workerStats = computed(() => {
    const all = allWorkerData.value ?? []
    const by = (status: string) =>
      all.filter((worker) => normalizedWorkerStatus(worker.status) === status).length
    const offlineRows = all.filter((worker) =>
      ['OFFLINE', 'DECOMMISSIONED'].includes(normalizedWorkerStatus(worker.status)),
    )
    const offlineCodeList = offlineRows.slice(0, 4).map((worker) => {
      const workerName = worker.workerCode ?? worker.workerGroup
      const displayedWorkerName = workerName ?? t('workerManagement.unknownWorker')
      return String(displayedWorkerName)
    })
    if (offlineRows.length > 4) {
      offlineCodeList.push(
        t('workerManagement.moreOfflineWorkers', { count: offlineRows.length - 4 }),
      )
    }
    return {
      online: by('ONLINE'),
      draining: by('DRAINING'),
      offline: offlineRows.length,
      offlineCodes: offlineCodeList.join(', '),
    }
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
      label: t('enum.workerStatus.DRAINING'),
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
    const s = normalizedWorkerStatus(status)
    if (s === 'DRAINING') return 'wk-card--draining'
    if (s === 'OFFLINE' || s === 'DECOMMISSIONED') return 'wk-card--offline'
    return ''
  }

  function recommendedTimeoutText(timeoutMillis: number): string {
    const formattedTimeout = fmtDuration(timeoutMillis)
    return t('workerManagement.recommendedTimeout', { value: formattedTimeout })
  }

  // mini bar 口径:相对当前筛选结果中的负载峰值(后端无容量分母,不编造 x/y)
  const workerLoadPeak = computed(() =>
    filteredWorkers.value.reduce((peak, worker) => {
      const currentLoad = Number(worker.currentLoad ?? 0)
      return Math.max(peak, currentLoad)
    }, 0),
  )

  function loadBarWidth(row: ConsoleWorkerRegistryResponse): string {
    const peak = workerLoadPeak.value
    const load = Number(row.currentLoad ?? 0)
    const loadCanBeDisplayed = Boolean(peak) && Number.isFinite(load) && load > 0
    if (!loadCanBeDisplayed) return '0%'
    const loadPercent = Math.round((load / peak) * 100)
    const boundedLoadPercent = Math.min(100, loadPercent)
    return `${boundedLoadPercent}%`
  }

  /** 心跳相对时间(设计「♥ 3s 前」) */
  function relTime(iso: string | null | undefined): string {
    if (!iso) return '—'
    const currentTime = Date.now()
    const heartbeatDate = new Date(iso)
    const heartbeatTime = heartbeatDate.getTime()
    const diff = currentTime - heartbeatTime
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
      const recentWorkerLoadErrorSuppressesReload =
        workerLoadError.value && Date.now() - workerErrorAt.value < 5_000
      if (recentWorkerLoadErrorSuppressesReload) return false
      try {
        await refetchWorkers()
      } finally {
        live.markRefreshed()
      }
    },
    scope: () => tenant.tenantId,
  })

  /** Worker 身份与当前租户、状态共同确定确认目标，不沿用切换前的卡片。 */
  function captureWorkerAction(row: ConsoleWorkerRegistryResponse, action: WorkerAction) {
    const scope = actionScope.begin()
    const operator = auth.userInfo?.username ?? auth.userInfo?.userId
    const isCurrentContext = () =>
      actionScope.isCurrent(scope) &&
      canMutateConfig.value &&
      operator === (auth.userInfo?.username ?? auth.userInfo?.userId)
    const isCurrent = () =>
      isCurrentContext() &&
      (allWorkerData.value ?? []).some(
        (worker) => worker.workerCode === row.workerCode && canWorkerAction(worker.status, action),
      )
    return { tenantId: scope.tenantId, isCurrent, isCurrentContext }
  }

  async function drain(row: ConsoleWorkerRegistryResponse) {
    if (!ensureWriteAvailable()) return
    const context = captureWorkerAction(row, 'drain')
    if (!context.isCurrent()) return
    try {
      await confirmDanger({
        verb: t('workerManagement.drainConfirmTitle'),
        target: '',
        consequence: t('workerManagement.drainConfirmText', { code: row.workerCode }),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
      if (!context.isCurrent()) return
      await drainWorker(row.workerCode, { tenantId: context.tenantId, reason: 'console drain' })
      if (!context.isCurrentContext()) return
      ElMessage.success(t('workerManagement.drainSuccess', { code: row.workerCode }))
      await queryClient.invalidateQueries({ queryKey: ['workers', context.tenantId] })
    } catch {
      /* cancel */
    }
  }

  async function takeover(row: ConsoleWorkerRegistryResponse) {
    if (!ensureWriteAvailable()) return
    const context = captureWorkerAction(row, 'takeover')
    if (!context.isCurrent()) return
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
      if (!context.isCurrent()) return
      await takeoverWorker(row.workerCode, {
        tenantId: context.tenantId,
        reason: 'console takeover',
      })
      if (!context.isCurrentContext()) return
      ElMessage.success(t('workerManagement.takeoverSuccess', { code: row.workerCode }))
      await queryClient.invalidateQueries({ queryKey: ['workers', context.tenantId] })
    } catch {
      /* cancel */
    }
  }

  async function warmup(row: ConsoleWorkerRegistryResponse) {
    if (!ensureWriteAvailable()) return
    const context = captureWorkerAction(row, 'warmup')
    if (!context.isCurrent()) return
    try {
      await warmupWorker(row.workerCode, context.tenantId)
      if (!context.isCurrentContext()) return
      ElMessage.success(t('workerManagement.warmupSuccess', { code: row.workerCode }))
      await queryClient.invalidateQueries({ queryKey: ['workers', context.tenantId] })
    } catch {
      /* cancel */
    }
  }

  async function offline(row: ConsoleWorkerRegistryResponse) {
    if (!ensureWriteAvailable()) return
    const context = captureWorkerAction(row, 'offline')
    if (!context.isCurrent()) return
    try {
      await confirmDanger({
        verb: t('workerManagement.offlineVerb'),
        target: t('workerManagement.offlineTarget', { code: row.workerCode }),
        consequence: t('workerManagement.offlineConsequence'),
        irreversible: true,
      })
      if (!context.isCurrent()) return
      await forceWorkerOffline(row.workerCode, {
        tenantId: context.tenantId,
        reason: 'console offline',
      })
      if (!context.isCurrentContext()) return
      ElMessage.success(t('workerManagement.offlineSuccess', { code: row.workerCode }))
      await queryClient.invalidateQueries({ queryKey: ['workers', context.tenantId] })
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
  const claimedTasksVisible = ref(false)
  const claimedTasksLoading = ref(false)
  const claimedTasksError = ref(false)
  const claimedTasksWorker = ref('')
  const claimedTaskRows = ref<ConsoleWorkerClaimedTaskResponse[]>([])
  let claimedTasksRequestSequence = 0
  const channelTotal = ref(0)
  const channelPage = ref(1)
  const channelPageSize = ref(15)

  async function openClaimedTasks(row: ConsoleWorkerRegistryResponse) {
    const sequence = ++claimedTasksRequestSequence
    const tenantId = tenant.tenantId
    claimedTasksVisible.value = true
    claimedTasksWorker.value = row.workerCode
    claimedTaskRows.value = []
    claimedTasksError.value = false
    if (!tenantId) {
      claimedTasksError.value = true
      return
    }
    claimedTasksLoading.value = true
    try {
      const rows = await listWorkerClaimedTasks(row.workerCode, tenantId)
      if (sequence !== claimedTasksRequestSequence || tenant.tenantId !== tenantId) return
      claimedTaskRows.value = rows ?? []
    } catch {
      if (sequence === claimedTasksRequestSequence) claimedTasksError.value = true
    } finally {
      if (sequence === claimedTasksRequestSequence) claimedTasksLoading.value = false
    }
  }

  watch(
    () => tenant.tenantId,
    () => {
      claimedTasksRequestSequence += 1
      claimedTaskRows.value = []
      claimedTasksWorker.value = ''
      claimedTasksLoading.value = false
      claimedTasksError.value = false
      claimedTasksVisible.value = false
    },
    { flush: 'sync' },
  )

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
    const scope = channelScope.begin()
    if (!scope.tenantId) return
    const isCurrent = () => channelScope.isCurrent(scope)
    await runLoadChannels(async () => {
      const channels = await queryFileChannels(scope.tenantId)
      if (!isCurrent()) return
      const enums = await getMetaEnums()
      if (!isCurrent()) return
      allChannelRows.value = channels
      channelTypeOptions.value = enums.channelType ?? []
      channelPage.value = 1
      sliceChannelPage()
    }, isCurrent)
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
      allChannelRows.value = []
      channelRows.value = []
      channelTypeOptions.value = []
      channelTotal.value = 0
      channelPage.value = 1
      channelLoading.value = false
      channelLoadError.value = null
      channelDetailVisible.value = false
      channelDetailRow.value = null
    },
    { flush: 'sync' },
  )

  watch(
    [activeTab, () => tenant.tenantId],
    ([tab, tenantId]) => {
      if (tab === 'channels' && tenantId) {
        void loadChannels().catch(() => {
          // 被动加载失败已由渠道表格错误态呈现，避免额外产生未处理的拒绝。
        })
      }
    },
    { immediate: true },
  )
</script>

<style scoped src="./WorkerManagement.css"></style>
