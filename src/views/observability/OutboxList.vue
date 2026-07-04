<template>
  <PageContainer>
    <!-- 照设计 #outbox:头部统计 pill + 彩点计数 tab 行 + 实时条(proto dump: docs/redesign/proto-outbox.html)。
         dump 的「全部重试」批量钮无后端端点,不做(批量重投走表格多选 BulkActionBar)。 -->
    <PageHeader>
      <template #actions>
        <div class="ob-stat">
          <span class="ob-stat__dot" />
          <span class="ob-stat__label">{{ t('observability.outboxStatSuccess') }}</span>
          <span class="ob-stat__value">{{ successCount.toLocaleString() }}</span>
        </div>
      </template>
    </PageHeader>

    <div class="ob-tabs">
      <button
        v-for="tb in obTabs"
        :key="tb.key"
        type="button"
        class="ob-tab"
        :class="{ 'is-active': tab === tb.key }"
        @click="tab = tb.key"
      >
        <span class="ob-tab__dot" :style="{ background: tb.dot }" />
        <span>{{ tb.label }}</span>
        <span v-if="tb.count !== null" class="ob-tab__count">{{ tb.count }}</span>
      </button>
    </div>

    <div class="ob-live">
      <span class="ob-live__dot" :class="{ 'is-off': live.status.value !== 'live' }" />
      <span class="ob-live__title">{{ t('jobInstanceList.liveTitle') }}</span>
      <span class="ob-live__sub">{{ t('jobInstanceList.liveEvery') }}</span>
      <span class="ob-live__spacer" />
      <span class="ob-live__time">{{ t('jobInstanceList.liveLast') }} {{ lastRefreshText }}</span>
    </div>

    <div v-show="tab === 'retry'">
      <ProTable
        ref="retryTableRef"
        :data="retryRows"
        :loading="tableBlocking"
        :total="retryTotal"
        v-model:page="retryPage"
        v-model:page-size="retryPageSize"
        @change="sliceRetry"
        @selection-change="bulk.onSelectionChange"
        :error="loadError"
        :on-retry="loadTab"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            :disabled="loading"
            @search="onRetrySearch"
            @reset="onRetryReset"
            @refresh="() => runRefresh(loadTab)"
          >
            <el-form-item :label="t('observability.outboxKeywordLabel')">
              <el-input
                class="query-w-220"
                v-model="retryKwDraft"
                clearable
                :placeholder="t('observability.outboxRetryKeywordPlaceholder')"
                @keyup.enter="onRetrySearch"
              />
            </el-form-item>
            <el-form-item :label="t('observability.outboxStatusLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="retryStatusDraft"
                clearable
                filterable
                allow-create
                default-first-option
                enum-key="outboxPublishStatus"
                :placeholder="t('observability.outboxRetryStatusPlaceholder')"
                @keyup.enter="onRetrySearch"
                :options="retryStatusSelectOptions"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <template #toolbar>
          <!-- 实时状态已上移到页级 ob-live 条(照 jr-live/al-live 模式),toolbar 只留批量栏 -->
          <BulkActionBar
            :count="bulk.count.value"
            :running="bulk.running.value"
            @clear="bulk.clear"
          >
            <template #default="{ running }">
              <el-button
                size="small"
                type="warning"
                plain
                :loading="running"
                @click="onBulkRepublish"
              >
                {{ t('observability.outboxBulkRepublish') }}
              </el-button>
            </template>
          </BulkActionBar>
        </template>
        <el-table-column type="selection" width="44" :selectable="() => true" />
        <el-table-column
          prop="eventType"
          :label="t('observability.outboxColEventType')"
          width="140"
        />
        <el-table-column
          prop="eventKey"
          :label="t('observability.outboxColKey')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="retryStatus" :label="t('observability.outboxColStatus')" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.retryStatus ?? '')" category="outboxPublishStatus" />
          </template>
        </el-table-column>
        <el-table-column
          prop="retryCount"
          :label="t('observability.outboxColCount')"
          width="70"
          align="right"
        />
        <el-table-column
          prop="retryPolicy"
          :label="t('observability.outboxColPolicy')"
          width="120"
          show-overflow-tooltip
        />
        <DatetimeColumn
          prop="nextRetryAt"
          :label="t('observability.outboxColNextRetry')"
          width="160"
        />
        <el-table-column :label="t('observability.outboxColActions')" width="120" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail('retry', row)">
                {{ t('observability.outboxActionDetail') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </div>
    <div v-show="tab === 'delivery'">
      <ProTable
        :data="deliveryRows"
        :loading="tableBlocking"
        :total="deliveryTotal"
        v-model:page="deliveryPage"
        v-model:page-size="deliveryPageSize"
        @change="sliceDelivery"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            :disabled="loading"
            @search="onDeliverySearch"
            @reset="onDeliveryReset"
            @refresh="() => runRefresh(loadTab)"
          >
            <el-form-item :label="t('observability.outboxKeywordLabel')">
              <el-input
                class="query-w-220"
                v-model="deliveryKwDraft"
                clearable
                :placeholder="t('observability.outboxDeliveryKeywordPlaceholder')"
                @keyup.enter="onDeliverySearch"
              />
            </el-form-item>
            <el-form-item :label="t('observability.outboxStatusLabel')">
              <MetaSelect
                class="query-w-200"
                v-model="deliveryStatusDraft"
                clearable
                filterable
                allow-create
                default-first-option
                enum-key="outboxPublishStatus"
                :placeholder="t('observability.outboxDeliveryStatusPlaceholder')"
                @keyup.enter="onDeliverySearch"
                :options="deliveryStatusSelectOptions"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column
          prop="eventType"
          :label="t('observability.outboxColEventType')"
          width="140"
        />
        <el-table-column
          prop="eventKey"
          :label="t('observability.outboxColKey')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="deliveryStatus"
          :label="t('observability.outboxColStatus')"
          width="120"
        >
          <template #default="{ row }">
            <StatusTag :value="String(row.deliveryStatus ?? '')" category="outboxPublishStatus" />
          </template>
        </el-table-column>
        <el-table-column
          prop="targetTopic"
          :label="t('observability.outboxColTopic')"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="deliveryAttempt"
          :label="t('observability.outboxColAttempt')"
          width="70"
          align="right"
        />
        <el-table-column
          prop="errorMessage"
          :label="t('observability.outboxColError')"
          min-width="180"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="updatedAt" :label="t('observability.outboxColUpdated')" width="160" />
        <el-table-column :label="t('observability.outboxColActions')" width="120" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail('delivery', row)">
                {{ t('observability.outboxActionDetail') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </div>

    <DetailDrawer
      v-model:visible="detailVisible"
      :title="detailTitle"
      :meta-rows="detailMetaRows"
      :raw="detailRow"
    />
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { queryOutboxDeliveries, queryOutboxRetries } from '@/api/observabilityQueries'
  import { republishOutbox } from '@/api/ops'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DetailDrawer from '@/components/common/DetailDrawer.vue'
  import BulkActionBar from '@/components/table/BulkActionBar.vue'
  import { useBulkSelection } from '@/composables/useBulkSelection'
  import type {
    ConsoleOutboxDeliveryLogResponse,
    ConsoleOutboxRetryLogResponse,
  } from '@/types/console-api'

  const tenant = useTenantStore()
  const route = useRoute()
  const router = useRouter()
  const tab = ref<'retry' | 'delivery'>(route.query.tab === 'delivery' ? 'delivery' : 'retry')
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)

  const retriesAll = ref<ConsoleOutboxRetryLogResponse[]>([])
  const deliveriesAll = ref<ConsoleOutboxDeliveryLogResponse[]>([])
  // 各 tab 是否已拉过数据:未拉过时 tab 计数不显示(0 会误导)
  const retryLoaded = ref(false)
  const deliveryLoaded = ref(false)

  const detailVisible = ref(false)
  const detailKind = ref<'retry' | 'delivery'>('retry')
  const detailRow = ref<ConsoleOutboxRetryLogResponse | ConsoleOutboxDeliveryLogResponse | null>(
    null,
  )
  const detailTitle = computed(() =>
    detailKind.value === 'retry'
      ? t('observability.outboxRetryDetailTitle')
      : t('observability.outboxDeliveryDetailTitle'),
  )
  const detailMetaRows = computed(() => {
    if (!detailRow.value) return []
    const rows = [
      { label: t('observability.outboxColEventType'), value: detailRow.value.eventType ?? '' },
      { label: t('observability.outboxColKey'), value: detailRow.value.eventKey ?? '' },
    ]
    if (detailKind.value === 'delivery') {
      rows.push({
        label: t('observability.outboxColTopic'),
        value: (detailRow.value as ConsoleOutboxDeliveryLogResponse).targetTopic ?? '',
      })
    }
    return rows
  })

  function openDetail(
    kind: 'retry' | 'delivery',
    row: ConsoleOutboxRetryLogResponse | ConsoleOutboxDeliveryLogResponse,
  ) {
    detailKind.value = kind
    detailRow.value = row
    detailVisible.value = true
  }

  const retryRows = ref<ConsoleOutboxRetryLogResponse[]>([])
  const retryTotal = ref(0)
  const retryPage = ref(1)
  const retryPageSize = ref(15)
  const retryKwDraft = ref('')
  const retryStatusDraft = ref(tab.value === 'retry' ? String(route.query.status ?? '') : '')
  const retryKwApplied = ref('')
  const retryStatusApplied = ref(retryStatusDraft.value)

  // ── 批量操作:多选 + 批量重投(仅未发布/可重试的 outbox 事件)──────────────
  const retryTableRef = ref<{ clearSelection?: () => void } | null>(null)
  const bulk = useBulkSelection<ConsoleOutboxRetryLogResponse>()
  onMounted(() => bulk.bindTable(retryTableRef.value))
  // 终态(已发布/已放弃)不可重投;其余(NEW/PENDING/FAILED/RETRYING/EXHAUSTED 等)视为可重投
  const TERMINAL_RETRY_STATUSES = ['PUBLISHED', 'PUBLISHING', 'SUCCEEDED', 'SUCCESS', 'GIVE_UP']

  async function onBulkRepublish() {
    const eligible = bulk.selected.value.filter(
      (r) => !TERMINAL_RETRY_STATUSES.includes(String(r.retryStatus ?? '')),
    )
    if (!eligible.length) {
      ElMessage.warning(t('observability.outboxBulkRepublishNone'))
      return
    }
    const label = t('observability.outboxBulkRepublish')
    try {
      await confirmDanger({
        verb: label,
        target: '',
        consequence: t('bulk.confirmBody', { label, n: eligible.length }),
      })
    } catch {
      return
    }
    await bulk.runBulk(eligible, (r) => republishOutbox(tenant.tenantId, [r.id]), {
      actionLabel: label,
    })
    void loadTab()
  }

  const deliveryRows = ref<ConsoleOutboxDeliveryLogResponse[]>([])
  const deliveryTotal = ref(0)
  const deliveryPage = ref(1)
  const deliveryPageSize = ref(15)
  const deliveryKwDraft = ref('')
  const deliveryStatusDraft = ref(tab.value === 'delivery' ? String(route.query.status ?? '') : '')
  const deliveryKwApplied = ref('')
  const deliveryStatusApplied = ref(deliveryStatusDraft.value)

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const retryStatusSelectOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'outboxPublishStatus'),
  )

  const deliveryStatusSelectOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'outboxPublishStatus'),
  )

  const filteredRetries = computed(() => {
    let r = retriesAll.value
    const k = retryKwApplied.value.trim().toLowerCase()
    if (k) {
      r = r.filter(
        (row) =>
          row.eventType?.toLowerCase().includes(k) || row.eventKey?.toLowerCase().includes(k),
      )
    }
    const s = retryStatusApplied.value.trim()
    if (s) r = r.filter((row) => String(row.retryStatus ?? '') === s)
    return r
  })

  const filteredDeliveries = computed(() => {
    let r = deliveriesAll.value
    const k = deliveryKwApplied.value.trim().toLowerCase()
    if (k) {
      r = r.filter(
        (row) =>
          row.eventType?.toLowerCase().includes(k) ||
          row.eventKey?.toLowerCase().includes(k) ||
          String(row.targetTopic ?? '')
            .toLowerCase()
            .includes(k),
      )
    }
    const s = deliveryStatusApplied.value.trim()
    if (s) r = r.filter((row) => String(row.deliveryStatus ?? '') === s)
    return r
  })

  function sliceRetry() {
    const pr = toPageResult(filteredRetries.value, retryPage.value, retryPageSize.value)
    retryRows.value = pr.records as ConsoleOutboxRetryLogResponse[]
    retryTotal.value = pr.total
  }

  function sliceDelivery() {
    const pr = toPageResult(filteredDeliveries.value, deliveryPage.value, deliveryPageSize.value)
    deliveryRows.value = pr.records as ConsoleOutboxDeliveryLogResponse[]
    deliveryTotal.value = pr.total
  }

  function onRetrySearch() {
    return runSearch(() => {
      retryKwApplied.value = retryKwDraft.value.trim()
      retryStatusApplied.value = retryStatusDraft.value.trim()
      retryPage.value = 1
      sliceRetry()
    })
  }

  function onRetryReset() {
    return runReset(() => {
      retryKwDraft.value = ''
      retryStatusDraft.value = ''
      retryKwApplied.value = ''
      retryStatusApplied.value = ''
      retryPage.value = 1
      sliceRetry()
    })
  }

  function onDeliverySearch() {
    return runSearch(() => {
      deliveryKwApplied.value = deliveryKwDraft.value.trim()
      deliveryStatusApplied.value = deliveryStatusDraft.value.trim()
      deliveryPage.value = 1
      sliceDelivery()
    })
  }

  function onDeliveryReset() {
    return runReset(() => {
      deliveryKwDraft.value = ''
      deliveryStatusDraft.value = ''
      deliveryKwApplied.value = ''
      deliveryStatusApplied.value = ''
      deliveryPage.value = 1
      sliceDelivery()
    })
  }

  async function loadTab() {
    loading.value = true
    loadError.value = null
    try {
      if (tab.value === 'retry') {
        retriesAll.value = await queryOutboxRetries(tenant.tenantId, {
          retryStatus: retryStatusApplied.value.trim() || undefined,
        })
        retryLoaded.value = true
        retryPage.value = 1
        sliceRetry()
      } else {
        deliveriesAll.value = await queryOutboxDeliveries(tenant.tenantId, {
          deliveryStatus: deliveryStatusApplied.value.trim() || undefined,
        })
        deliveryLoaded.value = true
        deliveryPage.value = 1
        sliceDelivery()
      }
    } finally {
      loading.value = false
      live.markRefreshed()
    }
  }

  useTenantReload(loadTab)

  watch(tab, () => loadTab())

  const live = useSseAutoReload({
    domain: 'outbox-retries',
    reload: () => (tab.value === 'retry' ? loadTab() : Promise.resolve()),
    scope: () => tenant.tenantId,
  })

  useSseAutoReload({
    domain: 'outbox-deliveries',
    reload: () => (tab.value === 'delivery' ? loadTab() : Promise.resolve()),
    scope: () => tenant.tenantId,
  })

  // ── 照设计 #outbox:彩点 + mono 计数 pill tab 行(jr-tabs / al-tabs 同款)──────
  const obTabs = computed(
    () =>
      [
        {
          key: 'retry',
          dot: 'var(--color-warning)',
          label: t('observability.outboxTabRetry'),
          count: retryLoaded.value ? filteredRetries.value.length : null,
        },
        {
          key: 'delivery',
          dot: 'var(--color-primary)',
          label: t('observability.outboxTabDelivery'),
          count: deliveryLoaded.value ? filteredDeliveries.value.length : null,
        },
      ] as const,
  )

  // 头部「投递成功」统计 pill:从当前 tab 已加载数据里数成功态(dump 的「今日成功」
  // 后端无独立汇总端点,取已加载集合口径)
  const OUTBOX_SUCCESS_STATUSES = ['PUBLISHED', 'SUCCEEDED', 'SUCCESS']
  const successCount = computed(() =>
    tab.value === 'retry'
      ? retriesAll.value.filter((r) =>
          OUTBOX_SUCCESS_STATUSES.includes(String(r.retryStatus ?? '')),
        ).length
      : deliveriesAll.value.filter((r) =>
          OUTBOX_SUCCESS_STATUSES.includes(String(r.deliveryStatus ?? '')),
        ).length,
  )

  const lastRefreshText = computed(() => {
    const v = live.lastRefreshedAt.value
    if (!v) return '—'
    const d = v instanceof Date ? v : new Date(v)
    if (Number.isNaN(d.getTime())) return '—'
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  })

  // URL state:tab + 当前活动 tab 的 status / page / pageSize round-trip
  function syncFiltersToUrl() {
    const params: Record<string, string> = { tab: tab.value }
    if (tab.value === 'retry') {
      if (retryStatusApplied.value) params.status = retryStatusApplied.value
      if (retryPage.value > 1) params.page = String(retryPage.value)
      if (retryPageSize.value !== 15) params.pageSize = String(retryPageSize.value)
    } else {
      if (deliveryStatusApplied.value) params.status = deliveryStatusApplied.value
      if (deliveryPage.value > 1) params.page = String(deliveryPage.value)
      if (deliveryPageSize.value !== 15) params.pageSize = String(deliveryPageSize.value)
    }
    void router.replace({ query: params })
  }
  onMounted(() => {
    const q = route.query
    if (q.page) {
      const p = Number(q.page)
      if (Number.isFinite(p) && p > 0) {
        if (tab.value === 'retry') retryPage.value = p
        else deliveryPage.value = p
      }
    }
    if (q.pageSize) {
      const ps = Number(q.pageSize)
      if (Number.isFinite(ps) && ps > 0) {
        if (tab.value === 'retry') retryPageSize.value = ps
        else deliveryPageSize.value = ps
      }
    }
  })
  watch(
    [
      tab,
      retryStatusApplied,
      retryPage,
      retryPageSize,
      deliveryStatusApplied,
      deliveryPage,
      deliveryPageSize,
    ],
    syncFiltersToUrl,
  )
</script>

<style scoped>
  /* ── 照设计 #outbox dump(docs/redesign/proto-outbox.html):
     头部统计 pill / 彩点+mono计数 tab 行(28h/r14,jr-tabs 同款)/ 实时条 ── */
  .ob-stat {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 13px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-card);
  }

  .ob-stat__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-success);
  }

  .ob-stat__label {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .ob-stat__value {
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--color-text-primary);
  }

  .ob-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 6px 0 14px;
    flex-wrap: wrap;
  }

  .ob-tab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 28px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 12.5px;
    white-space: nowrap;
    cursor: pointer;
  }

  .ob-tab.is-active {
    border-color: var(--color-text-secondary);
    background: var(--color-bg-elevated);
    font-weight: 600;
  }

  .ob-tab__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .ob-tab__count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .ob-live {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    margin-bottom: 10px;
    border: 1px solid var(--color-border);
    border-radius: 9px;
    background: var(--color-bg-card);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .ob-live__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-success);
  }

  .ob-live__dot.is-off {
    background: var(--color-text-tertiary);
  }

  .ob-live__title {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .ob-live__sub {
    color: var(--color-text-tertiary);
  }

  .ob-live__spacer {
    flex: 1;
  }

  .ob-live__time {
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
  }
</style>
