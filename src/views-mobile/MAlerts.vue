<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <!-- 紧凑标题 + 搜索按钮(默认收起,点开 inline 显示)-->
      <div class="m-page__header">
        <div class="m-page__title">{{ t('mobile.alerts.title') }}</div>
        <button
          type="button"
          class="m-page__title-action"
          :class="{ 'm-page__title-action--active': searchOpen }"
          :aria-label="t('mobile.common.search')"
          @click="toggleSearch"
        >
          <el-icon><Search /></el-icon>
        </button>
      </div>

      <MSearchBar
        v-if="searchOpen"
        ref="searchBarRef"
        v-model="keyword"
        :placeholder="t('mobile.alerts.searchPlaceholder')"
      />
      <p v-if="searchOpen" class="m-alert-search-scope">{{ t('mobile.alerts.searchScope') }}</p>

      <!-- 共享 .m-tabs / .m-tab / .m-tab__badge — 跟 MWorkers 一套样式 -->
      <div class="m-tabs" role="tablist">
        <button
          v-for="opt in filterOptions"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="filter === opt.value"
          class="m-tab"
          :class="{ 'm-tab--active': filter === opt.value }"
          @click="filter = opt.value as typeof filter"
        >
          <span class="m-tab__label">{{ opt.label }}</span>
          <span v-if="counts[opt.value] > 0" class="m-tab__badge" :class="badgeToneFor(opt.value)">
            {{ counts[opt.value] > 99 ? '99+' : counts[opt.value] }}
          </span>
        </button>
      </div>

      <MSkeleton v-if="loading && filtered.length === 0" :count="3" />
      <div v-else-if="!loadError && filtered.length === 0" class="m-empty">
        {{ t('mobile.alerts.empty') }}
      </div>

      <!-- 同类告警合并：与桌面端同一规则，只展示最新一条，其余可展开 -->
      <template v-for="group in alertGroups" :key="group.key">
        <div v-for="row in visibleGroupRows(group)" :key="row.id" class="m-card">
          <div class="m-card__row">
            <div class="m-card__title">
              {{ row.title || row.alertType }}
            </div>
            <span :class="['m-chip', severityChipClass(row.severity)]">
              {{ resolveEnumLabel('severity', row.severity) }}
            </span>
          </div>
          <div class="m-card__sub">{{ row.serviceName }} · {{ row.alertType }}</div>
          <div class="m-card__meta">
            <div>
              <span class="m-card__meta-key">{{ t('common.status') }}</span>
              {{ resolveEnumLabel('alertStatus', row.status) }}
            </div>
            <div>
              <span class="m-card__meta-key">{{ t('mobile.alerts.occurrences') }}</span>
              {{ row.occurrenceCount }}
            </div>
            <div>
              <span class="m-card__meta-key">{{ t('mobile.alerts.lastSeen') }}</span>
              {{ fmt(row.lastSeenAt) }}
            </div>
            <div v-if="row.traceId">
              <span class="m-card__meta-key">{{ t('common.trace') }}</span>
              <button
                type="button"
                class="m-copy-text"
                :aria-label="`${t('common.copy')} ${t('common.trace')} ${row.traceId}`"
                @click.stop="copy(row.traceId, 'traceId')"
              >
                {{ row.traceId }}
              </button>
            </div>
          </div>
          <div v-if="row.traceId" class="m-card__actions">
            <button
              class="m-btn"
              @click="
                $router.push({ path: '/observability/trace', query: { traceId: row.traceId } })
              "
            >
              <ScanSearch :size="16" aria-hidden="true" />
              {{ t('mobile.alerts.viewLogs') }}
            </button>
          </div>
          <div v-if="row.status === 'OPEN'" class="m-card__actions">
            <button
              class="m-btn m-btn--plain-primary"
              :disabled="writesFrozen"
              data-track="alerts.ack"
              @click="ack(row)"
            >
              <CircleCheck :size="16" aria-hidden="true" />
              {{ t('mobile.alerts.ack') }}
            </button>
            <button
              class="m-btn m-btn--plain-warning"
              :disabled="writesFrozen"
              data-track="alerts.silence"
              @click="silence(row)"
            >
              <BellOff :size="16" aria-hidden="true" />
              {{ t('mobile.alerts.silence') }}
            </button>
            <button
              class="m-btn m-btn--plain-danger"
              :disabled="writesFrozen"
              data-track="alerts.close"
              @click="close(row)"
            >
              <CircleX :size="16" aria-hidden="true" />
              {{ t('mobile.alerts.close') }}
            </button>
          </div>
        </div>
        <button
          v-if="group.rows.length > 1"
          type="button"
          class="m-group-toggle"
          :aria-expanded="expandedGroups.has(group.key)"
          @click="toggleGroup(group.key)"
        >
          {{
            expandedGroups.has(group.key)
              ? t('alertList.groupCollapse')
              : t('alertList.groupMore', { count: group.rows.length - 1 })
          }}
        </button>
      </template>
      <div v-if="loadError" class="m-alert-error" role="alert">
        <span>{{ t('mobile.common.loadFail') }}</span>
        <button class="m-btn" type="button" :disabled="loading" @click="load(retryReset)">
          {{ t('common.retry') }}
        </button>
      </div>
      <div v-if="rows.length > 0 && !loadError" class="m-load-more">
        <button v-if="hasMore" class="m-btn" :disabled="loading" @click="loadMore">
          {{ loading ? t('mobile.common.loadingMore') : t('mobile.common.loadMore') }}
        </button>
        <span v-else>{{ t('mobile.common.noMore') }}</span>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { groupSimilarAlerts, type AlertGroup } from '@/utils/alertGrouping'
  import { computed, nextTick, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { BellOff, CircleCheck, CircleX, ScanSearch, Search } from '@lucide/vue'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { REFRESH_INTERVAL_WARM_MS } from '@/layout-mobile/composables/refreshIntervals'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useCopy } from '@/composables/useCopy'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MSearchBar from '@/layout-mobile/MSearchBar.vue'
  import { queryAlertsPage } from '@/api/alertsQuery'
  import { acknowledgeAlert, silenceAlert, closeAlert } from '@/api/alertsCommands'
  import type { ConsoleAlertEventResponse } from '@/types/console-api'
  import { fmtDatetime } from '@/utils/datetime'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const { copy } = useCopy()
  const { writesFrozen, ensureWriteAvailable } = useWriteAvailability()
  const loading = ref(false)
  const loadError = ref(false)
  const retryReset = ref(true)
  const rows = ref<ConsoleAlertEventResponse[]>([])
  const page = ref(1)
  const pageSize = 30
  const total = ref(0)
  const hasMore = ref(false)
  const statusTotals = ref<Record<string, number>>({})
  const filter = ref<'all' | 'open' | 'acked' | 'closed'>('open')

  const filterOptions = computed(() => [
    { value: 'open', label: t('mobile.alerts.filterOpen') },
    { value: 'acked', label: t('mobile.alerts.filterAcked') },
    { value: 'closed', label: t('mobile.alerts.filterClosed') },
    { value: 'all', label: t('mobile.alerts.filterAll') },
  ])

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const openCount = computed(() => rows.value.filter((r) => r.status === 'OPEN').length)

  // 4 tab 的 count(open 显示当前未处理量,acked/closed 显示历史量,all 显示总数)。
  // open 里如果有 CRITICAL/ERROR,badge 用红色突出
  const counts = computed<Record<string, number>>(() => ({
    open: statusTotals.value.OPEN ?? 0,
    acked: statusTotals.value.ACKED ?? 0,
    closed: statusTotals.value.CLOSED ?? 0,
    all: statusTotals.value.ALL ?? 0,
  }))
  const criticalOpenCount = computed(
    () =>
      rows.value.filter(
        (r) => r.status === 'OPEN' && (r.severity === 'CRITICAL' || r.severity === 'ERROR'),
      ).length,
  )

  // tab 徽章按业务语义着色:
  //   open    → 有 critical 时红、否则橙色(待处理告警)
  //   acked   → 蓝(处理中)
  //   closed  → 绿(已解决)
  //   all     → 默认灰
  function badgeToneFor(filterKey: string) {
    if (filterKey === 'open') {
      return criticalOpenCount.value > 0 ? 'm-tab__badge--danger' : 'm-tab__badge--warning'
    }
    if (filterKey === 'acked') return 'm-tab__badge--info'
    if (filterKey === 'closed') return 'm-tab__badge--success'
    return '' // 全部
  }

  const keyword = ref('')
  const searchOpen = ref(false)
  const searchBarRef = ref<{ focus: () => void } | null>(null)

  async function toggleSearch() {
    if (searchOpen.value) {
      // 收起时清空 keyword,避免「看不见的过滤器」
      keyword.value = ''
      searchOpen.value = false
    } else {
      searchOpen.value = true
      await nextTick()
      searchBarRef.value?.focus()
    }
  }

  // tabs(状态)+ keyword(title/serviceName/alertType/traceId 模糊)
  const filtered = computed(() => {
    let list = rows.value
    if (filter.value === 'open') list = list.filter((r) => r.status === 'OPEN')
    else if (filter.value === 'acked') list = list.filter((r) => r.status === 'ACKED')
    else if (filter.value === 'closed') list = list.filter((r) => r.status === 'CLOSED')
    const trimmedKeyword = keyword.value.trim()
    const kw = trimmedKeyword.toLowerCase()
    if (kw) {
      const matchesKeyword = (value: string | null | undefined) =>
        value?.toLowerCase().includes(kw) ?? false
      list = list.filter(
        (r) =>
          matchesKeyword(r.title) ||
          matchesKeyword(r.serviceName) ||
          matchesKeyword(r.alertType) ||
          matchesKeyword(r.traceId),
      )
    }
    return list
  })

  const alertGroups = computed(() => groupSimilarAlerts(filtered.value))
  const expandedGroups = ref(new Set<string>())
  function visibleGroupRows(group: AlertGroup<ConsoleAlertEventResponse>) {
    return expandedGroups.value.has(group.key) ? group.rows : group.rows.slice(0, 1)
  }
  function toggleGroup(key: string) {
    const next = new Set(expandedGroups.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedGroups.value = next
  }

  function fmt(ts?: string | null) {
    return fmtDatetime(ts)
  }

  function severityChipClass(sev?: string | null) {
    switch (sev) {
      case 'CRITICAL':
      case 'ERROR':
        return 'm-chip--danger'
      case 'WARN':
      case 'WARNING':
        return 'm-chip--warning'
      case 'INFO':
        return 'm-chip--info'
      default:
        return ''
    }
  }

  function selectedStatus(): string | undefined {
    if (filter.value === 'open') return 'OPEN'
    if (filter.value === 'acked') return 'ACKED'
    if (filter.value === 'closed') return 'CLOSED'
    return undefined
  }

  async function refreshCounts() {
    const [all, open, acked, closed] = await Promise.all([
      queryAlertsPage(tenant.tenantId, 1, 1),
      queryAlertsPage(tenant.tenantId, 1, 1, { status: 'OPEN' }),
      queryAlertsPage(tenant.tenantId, 1, 1, { status: 'ACKED' }),
      queryAlertsPage(tenant.tenantId, 1, 1, { status: 'CLOSED' }),
    ])
    statusTotals.value = {
      ALL: all.total ?? 0,
      OPEN: open.total ?? 0,
      ACKED: acked.total ?? 0,
      CLOSED: closed.total ?? 0,
    }
  }

  async function load(reset = true) {
    loading.value = true
    loadError.value = false
    try {
      if (reset) page.value = 1
      const requestedPage = reset ? page.value : page.value + 1
      const status = selectedStatus()
      const result = await queryAlertsPage(
        tenant.tenantId,
        requestedPage,
        pageSize,
        status ? { status } : undefined,
      )
      page.value = requestedPage
      const next = result.items ?? []
      rows.value = reset ? next : [...rows.value, ...next]
      total.value = result.total ?? rows.value.length
      hasMore.value = rows.value.length < total.value
      if (reset) {
        try {
          await refreshCounts()
        } catch {
          ElMessage.error(t('mobile.common.loadFail'))
        }
      }
    } catch {
      retryReset.value = reset
      loadError.value = true
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    await load(false)
  }

  async function ack(row: ConsoleAlertEventResponse) {
    if (!ensureWriteAvailable()) return
    try {
      await acknowledgeAlert(row.id, { tenantId: tenant.tenantId })
      ElMessage.success(t('mobile.alerts.ackedToast'))
      await load()
    } catch {
      /* */
    }
  }

  async function silence(row: ConsoleAlertEventResponse) {
    if (!ensureWriteAvailable()) return
    try {
      await silenceAlert(row.id, { tenantId: tenant.tenantId })
      ElMessage.success(t('mobile.alerts.silencedToast'))
      await load()
    } catch {
      /* */
    }
  }

  async function close(row: ConsoleAlertEventResponse) {
    if (!ensureWriteAvailable()) return
    try {
      await confirmActionSheet(
        `${t('mobile.alerts.close')} #${row.id}?`,
        t('mobile.alerts.close'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await closeAlert(row.id, { tenantId: tenant.tenantId })
      ElMessage.success(t('mobile.alerts.closedToast'))
      await load()
    } catch {
      /* cancelled */
    }
  }

  // useTenantReload: setup 时 + tenant 切换时调用 load(替代 onMounted + watch 手写)
  useTenantReload(() => load(true))
  watch(filter, () => void load(true))
  // oncall 关键页:20s 轮询,切后台时暂停
  useAutoRefresh(load, REFRESH_INTERVAL_WARM_MS)
</script>

<style scoped>
  .m-alert-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-block: 24px;
  }

  .m-alert-search-scope {
    margin: 6px 4px 10px;
    color: var(--ios-label-secondary);
    font-size: 12px;
    line-height: 1.4;
  }

  /* 同类告警折叠按钮：贴在首条卡片下方 */
  .m-group-toggle {
    display: block;
    margin: -4px 0 12px 4px;
    padding: 6px 0;
    border: 0;
    background: transparent;
    color: var(--color-primary-text);
    font-size: 13px;
  }
</style>
