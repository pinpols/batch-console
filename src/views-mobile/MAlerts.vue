<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.alerts.title') }}</div>
          <div class="m-page__subtitle">{{ t('mobile.alerts.openCount', { n: openCount }) }}</div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('mobile.common.loading') : t('mobile.common.refresh') }}
        </button>
      </div>

      <div class="m-page__header">
        <el-segmented v-model="filter" :options="filterOptions" size="small" class="u-w-full" />
      </div>

      <MSkeleton v-if="loading && filtered.length === 0" :count="3" />
      <div v-else-if="filtered.length === 0" class="m-empty">{{ t('mobile.alerts.empty') }}</div>

      <div v-for="row in filtered" :key="row.id" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.title || row.alertType }}</div>
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
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
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

  const filtered = computed(() => {
    if (filter.value === 'all') return rows.value
    if (filter.value === 'open') return rows.value.filter((r) => r.status === 'OPEN')
    if (filter.value === 'acked') return rows.value.filter((r) => r.status === 'ACKED')
    if (filter.value === 'closed') return rows.value.filter((r) => r.status === 'CLOSED')
    return rows.value
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
      await ElMessageBox.confirm(
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

  onMounted(load)
  watch(() => tenant.tenantId, load)
  // oncall 关键页：20s 轮询，切后台时暂停
  useAutoRefresh(load, 20_000)
</script>
