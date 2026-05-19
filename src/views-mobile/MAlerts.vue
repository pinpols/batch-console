<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <!-- 紧凑标题:tab 已经分档显示 count,subtitle 重复信息删掉 -->
      <div class="m-page__header">
        <div class="m-page__title">{{ t('mobile.alerts.title') }}</div>
      </div>

      <!-- 共享 .m-tabs / .m-tab / .m-tab__badge — 跟 MWorkers 一套样式 -->
      <MSearchBar v-model="keyword" :placeholder="t('mobile.alerts.searchPlaceholder')" />
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
      <div v-else-if="filtered.length === 0" class="m-empty">{{ t('mobile.alerts.empty') }}</div>

      <div v-for="row in filtered" :key="row.id" class="m-card">
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
        </div>
        <div v-if="row.traceId" class="m-card__actions">
          <button
            class="m-btn"
            @click="$router.push({ path: '/observability/trace', query: { traceId: row.traceId } })"
          >
            {{ t('mobile.alerts.viewLogs') }}
          </button>
        </div>
        <div v-if="row.status === 'OPEN'" class="m-card__actions">
          <button class="m-btn" @click="silence(row)">{{ t('mobile.alerts.silence') }}</button>
          <button class="m-btn" @click="ack(row)">{{ t('mobile.alerts.ack') }}</button>
          <button class="m-btn m-btn--primary" @click="close(row)">
            {{ t('mobile.alerts.close') }}
          </button>
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { REFRESH_INTERVAL_WARM_MS } from '@/layout-mobile/composables/refreshIntervals'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MSearchBar from '@/layout-mobile/MSearchBar.vue'
  import { queryAlertsAll } from '@/api/alertsQuery'
  import { acknowledgeAlert, silenceAlert, closeAlert } from '@/api/alertsCommands'
  import type { ConsoleAlertEventResponse } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleAlertEventResponse[]>([])
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
    open: rows.value.filter((r) => r.status === 'OPEN').length,
    acked: rows.value.filter((r) => r.status === 'ACKED').length,
    closed: rows.value.filter((r) => r.status === 'CLOSED').length,
    all: rows.value.length,
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
    return '' // all
  }

  const keyword = ref('')

  // tabs(状态)+ keyword(title/serviceName/alertType/traceId 模糊)
  const filtered = computed(() => {
    let list = rows.value
    if (filter.value === 'open') list = list.filter((r) => r.status === 'OPEN')
    else if (filter.value === 'acked') list = list.filter((r) => r.status === 'ACKED')
    else if (filter.value === 'closed') list = list.filter((r) => r.status === 'CLOSED')
    const kw = keyword.value.trim().toLowerCase()
    if (kw) {
      list = list.filter(
        (r) =>
          r.title?.toLowerCase().includes(kw) ||
          r.serviceName?.toLowerCase().includes(kw) ||
          r.alertType?.toLowerCase().includes(kw) ||
          r.traceId?.toLowerCase().includes(kw),
      )
    }
    return list
  })

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
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

  async function load() {
    loading.value = true
    try {
      rows.value = await queryAlertsAll(tenant.tenantId)
    } catch {
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  async function ack(row: ConsoleAlertEventResponse) {
    try {
      await acknowledgeAlert(row.id, { tenantId: tenant.tenantId })
      ElMessage.success(t('mobile.alerts.ackedToast'))
      await load()
    } catch {
      /* */
    }
  }

  async function silence(row: ConsoleAlertEventResponse) {
    try {
      await silenceAlert(row.id, { tenantId: tenant.tenantId })
      ElMessage.success(t('mobile.alerts.silencedToast'))
      await load()
    } catch {
      /* */
    }
  }

  async function close(row: ConsoleAlertEventResponse) {
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
  useTenantReload(load)
  // oncall 关键页:20s 轮询,切后台时暂停
  useAutoRefresh(load, REFRESH_INTERVAL_WARM_MS)
</script>
