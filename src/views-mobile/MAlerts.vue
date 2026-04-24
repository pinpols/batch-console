<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">告警</div>
          <div class="m-page__subtitle">未确认 {{ openCount }} 条</div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? '加载中' : '刷新' }}
        </button>
      </div>

      <div class="m-page__header">
        <el-segmented v-model="filter" :options="filterOptions" size="small" class="u-w-full" />
      </div>

      <MSkeleton v-if="loading && filtered.length === 0" :count="3" />
      <div v-else-if="filtered.length === 0" class="m-empty">暂无告警</div>

      <div v-for="row in filtered" :key="row.id" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.title || row.alertType }}</div>
          <span :class="['m-chip', severityChipClass(row.severity)]">{{ row.severity }}</span>
        </div>
        <div class="m-card__sub">{{ row.serviceName }} · {{ row.alertType }}</div>
        <div class="m-card__meta">
          <div><span class="m-card__meta-key">状态</span>{{ row.status }}</div>
          <div><span class="m-card__meta-key">次数</span>{{ row.occurrenceCount }}</div>
          <div><span class="m-card__meta-key">最近</span>{{ fmt(row.lastSeenAt) }}</div>
        </div>
        <div v-if="row.status === 'OPEN'" class="m-card__actions">
          <button class="m-btn" @click="silence(row)">静音</button>
          <button class="m-btn" @click="ack(row)">确认</button>
          <button class="m-btn m-btn--primary" @click="close(row)">关闭</button>
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { queryAlertsAll } from '@/api/alertsQuery'
  import { acknowledgeAlert, silenceAlert, closeAlert } from '@/api/alertsCommands'
  import type { ConsoleAlertEventResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleAlertEventResponse[]>([])
  const filter = ref<'all' | 'open' | 'acked' | 'closed'>('open')

  const filterOptions = [
    { value: 'open', label: '未处理' },
    { value: 'acked', label: '已确认' },
    { value: 'closed', label: '已关闭' },
    { value: 'all', label: '全部' },
  ]

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
      ElMessage.error('加载失败')
    } finally {
      loading.value = false
    }
  }

  async function ack(row: ConsoleAlertEventResponse) {
    try {
      await acknowledgeAlert(row.id, { tenantId: tenant.tenantId })
      ElMessage.success('已确认')
      await load()
    } catch {
      /* */
    }
  }

  async function silence(row: ConsoleAlertEventResponse) {
    try {
      await silenceAlert(row.id, { tenantId: tenant.tenantId })
      ElMessage.success('已静音')
      await load()
    } catch {
      /* */
    }
  }

  async function close(row: ConsoleAlertEventResponse) {
    try {
      await ElMessageBox.confirm(`关闭告警 #${row.id}？`, '确认关闭', { type: 'warning' })
      await closeAlert(row.id, { tenantId: tenant.tenantId })
      ElMessage.success('已关闭')
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
