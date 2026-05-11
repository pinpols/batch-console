<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.workers.title') }}</div>
          <div class="m-page__subtitle">
            {{
              t('mobile.workers.summary', {
                online: onlineCount,
                drain: drainCount,
                offline: offlineCount,
              })
            }}
          </div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('mobile.common.loading') : t('mobile.common.refresh') }}
        </button>
      </div>

      <div class="m-page__header u-gap-8">
        <el-segmented v-model="filter" :options="filterOptions" size="small" class="u-w-full" />
      </div>

      <MSkeleton v-if="loading && filtered.length === 0" :count="3" />
      <div v-else-if="filtered.length === 0" class="m-empty">
        {{ t('mobile.workers.empty') }}
      </div>

      <div v-for="row in filtered" :key="row.workerCode" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.workerCode }}</div>
          <span :class="['m-chip', statusChipClass(row.status)]">
            {{ resolveEnumLabel('workerStatus', row.status) }}
          </span>
        </div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">{{ t('mobile.workers.group') }}</span>
            {{ row.workerGroup || '—' }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.workers.load') }}</span>
            {{ row.currentLoad ?? '—' }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.workers.heartbeat') }}</span>
            {{ fmt(row.heartbeatAt) }}
          </div>
          <div v-if="row.capabilityTags">
            <span class="m-card__meta-key">{{ t('mobile.workers.capability') }}</span>
            {{ row.capabilityTags }}
          </div>
        </div>
        <div class="m-card__actions">
          <button
            v-if="row.status === 'ONLINE'"
            class="m-btn"
            :disabled="busyCode === row.workerCode"
            @click="doDrain(row)"
          >
            {{ t('mobile.workers.drainAction') }}
          </button>
          <button
            v-if="row.status === 'ONLINE'"
            class="m-btn"
            :disabled="busyCode === row.workerCode"
            @click="doWarmup(row)"
          >
            {{ t('mobile.workers.warmup') }}
          </button>
          <button
            v-if="row.status === 'OFFLINE' || row.status === 'DRAINING'"
            class="m-btn"
            :disabled="busyCode === row.workerCode"
            @click="doTakeover(row)"
          >
            {{ t('mobile.workers.takeover') }}
          </button>
          <button
            v-if="row.status !== 'OFFLINE'"
            class="m-btn m-btn--plain-danger"
            :disabled="busyCode === row.workerCode"
            @click="doForceOffline(row)"
          >
            {{ t('mobile.workers.forceOffline') }}
          </button>
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import {
    queryWorkers,
    drainWorker,
    forceWorkerOffline,
    takeoverWorker,
    warmupWorker,
  } from '@/api/workers'
  import type { ConsoleWorkerRegistryResponse } from '@/types/console-api'

  const route = useRoute()
  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  type WorkerFilter = 'all' | 'online' | 'draining' | 'offline'
  const allowedFilters: WorkerFilter[] = ['all', 'online', 'draining', 'offline']
  const initialFilter = allowedFilters.includes(route.query.filter as WorkerFilter)
    ? (route.query.filter as WorkerFilter)
    : 'all'
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const loading = ref(false)
  const rows = ref<ConsoleWorkerRegistryResponse[]>([])
  const busyCode = ref<string | null>(null)
  const filter = ref<WorkerFilter>(initialFilter)

  const filterOptions = computed(() => [
    { value: 'all', label: t('mobile.workers.filterAll') },
    { value: 'online', label: t('mobile.workers.filterOnline') },
    { value: 'draining', label: t('mobile.workers.filterDraining') },
    { value: 'offline', label: t('mobile.workers.filterOffline') },
  ])

  const onlineCount = computed(() => rows.value.filter((r) => r.status === 'ONLINE').length)
  const drainCount = computed(() => rows.value.filter((r) => r.status === 'DRAINING').length)
  const offlineCount = computed(() => rows.value.filter((r) => r.status === 'OFFLINE').length)

  const filtered = computed(() => {
    if (filter.value === 'online') return rows.value.filter((r) => r.status === 'ONLINE')
    if (filter.value === 'draining') return rows.value.filter((r) => r.status === 'DRAINING')
    if (filter.value === 'offline') return rows.value.filter((r) => r.status === 'OFFLINE')
    return rows.value
  })

  function statusChipClass(s?: string) {
    if (s === 'ONLINE') return 'm-chip--success'
    if (s === 'DRAINING') return 'm-chip--warning'
    if (s === 'OFFLINE') return 'm-chip--danger'
    return ''
  }

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  async function load() {
    loading.value = true
    try {
      rows.value = await queryWorkers(tenant.tenantId)
    } catch {
      rows.value = []
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  async function runConfirmed(
    row: ConsoleWorkerRegistryResponse,
    titleKey: string,
    textKey: string,
    fn: () => Promise<unknown>,
    toastKey: string,
  ) {
    try {
      await ElMessageBox.confirm(t(textKey, { code: row.workerCode }), t(titleKey), {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
    } catch {
      return
    }
    busyCode.value = row.workerCode
    try {
      await fn()
      ElMessage.success(t(toastKey))
      await load()
    } finally {
      busyCode.value = null
    }
  }

  function doDrain(row: ConsoleWorkerRegistryResponse) {
    return runConfirmed(
      row,
      'mobile.workers.drainConfirmTitle',
      'mobile.workers.drainConfirmText',
      () => drainWorker(row.workerCode, { tenantId: tenant.tenantId, reason: 'mobile drain' }),
      'mobile.workers.drainDoneToast',
    )
  }

  function doForceOffline(row: ConsoleWorkerRegistryResponse) {
    return runConfirmed(
      row,
      'mobile.workers.forceOfflineTitle',
      'mobile.workers.forceOfflineText',
      () =>
        forceWorkerOffline(row.workerCode, {
          tenantId: tenant.tenantId,
          reason: 'mobile force offline',
        }),
      'mobile.workers.forceOfflineDoneToast',
    )
  }

  function doTakeover(row: ConsoleWorkerRegistryResponse) {
    return runConfirmed(
      row,
      'mobile.workers.takeoverTitle',
      'mobile.workers.takeoverText',
      () =>
        takeoverWorker(row.workerCode, { tenantId: tenant.tenantId, reason: 'mobile takeover' }),
      'mobile.workers.takeoverDoneToast',
    )
  }

  async function doWarmup(row: ConsoleWorkerRegistryResponse) {
    busyCode.value = row.workerCode
    try {
      await warmupWorker(row.workerCode, tenant.tenantId)
      ElMessage.success(t('mobile.workers.warmupDoneToast'))
      await load()
    } finally {
      busyCode.value = null
    }
  }

  onMounted(load)
  watch(() => tenant.tenantId, load)
  useAutoRefresh(load, 30_000)
</script>
