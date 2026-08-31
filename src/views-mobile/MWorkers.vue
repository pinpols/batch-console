<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.workers.title') }}</div>
          <div class="m-page__subtitle">
            <span class="m-stat">
              <i class="m-stat__dot m-stat__dot--success" />
              {{ t('mobile.workers.filterOnline') }} {{ onlineCount }}
            </span>
            <span class="m-stat">
              <i class="m-stat__dot m-stat__dot--warning" />
              {{ t('mobile.workers.filterDraining') }} {{ drainCount }}
            </span>
            <span class="m-stat">
              <i class="m-stat__dot m-stat__dot--danger" />
              {{ t('mobile.workers.filterOffline') }} {{ offlineCount }}
            </span>
          </div>
        </div>
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
        :placeholder="t('mobile.workers.searchPlaceholder')"
      />

      <!-- 跟告警 4-tab 同一套 .m-tabs 样式;各档 count 着色:online 绿、drain 橙、offline 红 -->
      <div class="m-tabs" role="tablist">
        <button
          v-for="opt in filterOptions"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="filter === opt.value"
          class="m-tab"
          :class="{ 'm-tab--active': filter === opt.value }"
          @click="filter = opt.value as WorkerFilter"
        >
          <span class="m-tab__label">{{ opt.label }}</span>
          <span
            v-if="tabCounts[opt.value] > 0"
            class="m-tab__badge"
            :class="badgeToneFor(opt.value)"
          >
            {{ tabCounts[opt.value] > 99 ? '99+' : tabCounts[opt.value] }}
          </span>
        </button>
      </div>

      <MSkeleton v-if="loading && filtered.length === 0" :count="3" />
      <div v-else-if="filtered.length === 0" class="m-empty">
        {{ t('mobile.workers.empty') }}
      </div>

      <div v-for="row in filtered" :key="row.workerCode" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">
            <span class="m-copy-text" @click.stop="copy(row.workerCode, 'workerCode')">{{
              row.workerCode
            }}</span>
          </div>
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
            data-track="workers.drain"
            :disabled="busyCode === row.workerCode"
            @click="doDrain(row)"
          >
            {{ t('mobile.workers.drainAction') }}
          </button>
          <button
            v-if="row.status === 'ONLINE'"
            class="m-btn"
            data-track="workers.warmup"
            :disabled="busyCode === row.workerCode"
            @click="doWarmup(row)"
          >
            {{ t('mobile.workers.warmup') }}
          </button>
          <button
            v-if="row.status === 'OFFLINE' || row.status === 'DRAINING'"
            class="m-btn"
            data-track="workers.takeover"
            :disabled="busyCode === row.workerCode"
            @click="doTakeover(row)"
          >
            {{ t('mobile.workers.takeover') }}
          </button>
          <button
            v-if="row.status !== 'OFFLINE'"
            class="m-btn m-btn--plain-danger"
            data-track="workers.forceOffline"
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
  import { computed, nextTick, ref } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Search } from 'lucide-vue-next'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { REFRESH_INTERVAL_COLD_MS } from '@/layout-mobile/composables/refreshIntervals'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useCopy } from '@/composables/useCopy'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MSearchBar from '@/layout-mobile/MSearchBar.vue'
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
  const { copy } = useCopy()
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

  const keyword = ref('')
  const searchOpen = ref(false)
  const searchBarRef = ref<{ focus: () => void } | null>(null)
  async function toggleSearch() {
    if (searchOpen.value) {
      keyword.value = ''
      searchOpen.value = false
    } else {
      searchOpen.value = true
      await nextTick()
      searchBarRef.value?.focus()
    }
  }

  // tabs(状态)+ keyword(workerCode/workerGroup/capabilityTags 模糊)
  const filtered = computed(() => {
    let list = rows.value
    if (filter.value === 'online') list = list.filter((r) => r.status === 'ONLINE')
    else if (filter.value === 'draining') list = list.filter((r) => r.status === 'DRAINING')
    else if (filter.value === 'offline') list = list.filter((r) => r.status === 'OFFLINE')
    const kw = keyword.value.trim().toLowerCase()
    if (kw) {
      list = list.filter(
        (r) =>
          r.workerCode?.toLowerCase().includes(kw) ||
          r.workerGroup?.toLowerCase().includes(kw) ||
          r.capabilityTags?.toLowerCase().includes(kw),
      )
    }
    return list
  })

  // tab 徽章 count
  const tabCounts = computed<Record<string, number>>(() => ({
    all: rows.value.length,
    online: onlineCount.value,
    draining: drainCount.value,
    offline: offlineCount.value,
  }))

  function badgeToneFor(filterKey: string) {
    if (filterKey === 'online') return 'm-tab__badge--success'
    if (filterKey === 'draining') return 'm-tab__badge--warning'
    if (filterKey === 'offline') return 'm-tab__badge--danger'
    return '' // all → 默认灰
  }

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
    if (!tenant.tenantId) {
      rows.value = []
      loading.value = false
      return
    }
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
      await confirmActionSheet(t(textKey, { code: row.workerCode }), t(titleKey), {
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

  // 接管 = 构造性,直接执行(强制下线和 Drain 才确认 — 真破坏性)
  async function doTakeover(row: ConsoleWorkerRegistryResponse) {
    busyCode.value = row.workerCode
    try {
      await takeoverWorker(row.workerCode, {
        tenantId: tenant.tenantId,
        reason: 'mobile takeover',
      })
      ElMessage.success(t('mobile.workers.takeoverDoneToast'))
      await load()
    } finally {
      busyCode.value = null
    }
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
  useTenantReload(load)
  useAutoRefresh(load, REFRESH_INTERVAL_COLD_MS)
</script>
