<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.workers.title') }}</div>
          <div v-if="!loading && (!loadError || rows.length)" class="m-page__subtitle">
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
      <div v-else-if="!loadError && filtered.length === 0" class="m-empty">
        {{ t('mobile.workers.empty') }}
      </div>

      <div v-if="loadError" class="m-load-error" role="alert">
        <span>{{ rows.length ? t('mobile.workers.stale') : t('mobile.common.loadFail') }}</span>
        <button class="m-btn" type="button" @click="load">{{ t('common.retry') }}</button>
      </div>

      <div v-for="row in filtered" :key="row.workerCode" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">
            <button
              type="button"
              class="m-copy-text"
              :aria-label="`${t('common.copy')} ${t('mobile.workers.title')} ${row.workerCode}`"
              @click.stop="copy(row.workerCode, 'workerCode')"
            >
              {{ row.workerCode }}
            </button>
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
          <div v-if="parseCapabilityTags(row.capabilityTags).length">
            <span class="m-card__meta-key">{{ t('mobile.workers.capability') }}</span>
            {{ parseCapabilityTags(row.capabilityTags).join('、') }}
          </div>
        </div>
        <div class="m-card__actions m-workers-actions">
          <button
            v-if="canWorkerAction(row.status, 'drain')"
            class="m-btn m-btn--plain-warning"
            data-track="workers.drain"
            :disabled="!canMutateConfig || loadError || loading || busyCode === row.workerCode"
            @click="doDrain(row)"
          >
            <CirclePause :size="16" aria-hidden="true" />
            {{ t('mobile.workers.drainAction') }}
          </button>
          <button
            v-if="canWorkerAction(row.status, 'warmup')"
            class="m-btn m-btn--plain-success"
            data-track="workers.warmup"
            :disabled="!canMutateConfig || loadError || loading || busyCode === row.workerCode"
            @click="doWarmup(row)"
          >
            <Flame :size="16" aria-hidden="true" />
            {{ t('mobile.workers.warmup') }}
          </button>
          <button
            v-if="canWorkerAction(row.status, 'takeover')"
            class="m-btn m-btn--plain-warning"
            data-track="workers.takeover"
            :disabled="!canMutateConfig || loadError || loading || busyCode === row.workerCode"
            @click="doTakeover(row)"
          >
            <ArrowRightLeft :size="16" aria-hidden="true" />
            {{ t('mobile.workers.takeover') }}
          </button>
          <button
            v-if="canWorkerAction(row.status, 'offline')"
            class="m-btn m-btn--plain-danger"
            data-track="workers.forceOffline"
            :disabled="!canMutateConfig || loadError || loading || busyCode === row.workerCode"
            @click="doForceOffline(row)"
          >
            <Power :size="16" aria-hidden="true" />
            {{ t('mobile.workers.forceOffline') }}
          </button>
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { usePermission } from '@/composables/usePermission'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowRightLeft, CirclePause, Flame, Power, Search } from '@lucide/vue'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { REFRESH_INTERVAL_COLD_MS } from '@/layout-mobile/composables/refreshIntervals'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useCopy } from '@/composables/useCopy'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MSearchBar from '@/layout-mobile/MSearchBar.vue'
  import { fmtDatetime } from '@/utils/datetime'
  import {
    queryWorkers,
    drainWorker,
    forceWorkerOffline,
    takeoverWorker,
    warmupWorker,
  } from '@/api/workers'
  import type { ConsoleWorkerRegistryResponse } from '@/types/console-api'
  import { canWorkerAction, type WorkerAction } from '@/views/worker/workerActions'
  import { parseCapabilityTags } from '@/utils/capabilityTags'

  const route = useRoute()
  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const { canMutateConfig } = usePermission()
  const { ensureWriteAvailable } = useWriteAvailability()
  const listScope = useTenantRequestScope()
  const actionScope = useTenantRequestScope()
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
  const loadError = ref(false)
  const rows = ref<ConsoleWorkerRegistryResponse[]>([])
  const busyCode = ref<string | null>(null)
  const filter = ref<WorkerFilter>(initialFilter)
  watch(
    () => tenant.tenantId,
    (tenantId) => {
      rows.value = []
      loadError.value = false
      busyCode.value = null
      if (!tenantId) loading.value = false
    },
    { flush: 'sync' },
  )

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
    const trimmedKeyword = keyword.value.trim()
    const kw = trimmedKeyword.toLowerCase()
    if (kw) {
      const matchesKeyword = (value: string | null | undefined) =>
        value?.toLowerCase().includes(kw) ?? false
      list = list.filter(
        (r) =>
          matchesKeyword(r.workerCode) ||
          matchesKeyword(r.workerGroup) ||
          matchesKeyword(r.capabilityTags),
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
    return fmtDatetime(ts)
  }

  async function load() {
    const scope = listScope.begin()
    if (!scope.tenantId) {
      rows.value = []
      loading.value = false
      return
    }
    loading.value = true
    loadError.value = false
    try {
      const result = await queryWorkers(scope.tenantId)
      if (listScope.isCurrent(scope)) rows.value = result
    } catch {
      if (listScope.isCurrent(scope)) loadError.value = true
    } finally {
      if (listScope.isCurrent(scope)) loading.value = false
    }
  }

  function captureAction(row: ConsoleWorkerRegistryResponse, action: WorkerAction) {
    const scope = actionScope.begin()
    const operator = auth.userInfo?.username ?? auth.userInfo?.userId
    const isCurrentContext = () =>
      actionScope.isCurrent(scope) &&
      canMutateConfig.value &&
      operator === (auth.userInfo?.username ?? auth.userInfo?.userId)
    const isCurrent = () =>
      isCurrentContext() &&
      !loading.value &&
      !loadError.value &&
      rows.value.some(
        (worker) => worker.workerCode === row.workerCode && canWorkerAction(worker.status, action),
      )
    return { scope, isCurrent, isCurrentContext }
  }

  async function runConfirmed(
    row: ConsoleWorkerRegistryResponse,
    action: WorkerAction,
    titleKey: string,
    textKey: string,
    fn: (tenantId: string) => Promise<unknown>,
    toastKey: string,
  ) {
    if (!ensureWriteAvailable() || !canMutateConfig.value || busyCode.value) return
    const context = captureAction(row, action)
    if (!context.isCurrent()) return
    try {
      await confirmActionSheet(t(textKey, { code: row.workerCode }), t(titleKey), {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
    } catch {
      return
    }
    if (!context.isCurrent()) return
    busyCode.value = row.workerCode
    try {
      await fn(context.scope.tenantId)
      if (!context.isCurrentContext()) return
      ElMessage.success(t(toastKey))
      await load()
    } finally {
      if (actionScope.isCurrent(context.scope)) busyCode.value = null
    }
  }

  function doDrain(row: ConsoleWorkerRegistryResponse) {
    return runConfirmed(
      row,
      'drain',
      'mobile.workers.drainConfirmTitle',
      'mobile.workers.drainConfirmText',
      (tenantId) => drainWorker(row.workerCode, { tenantId, reason: 'mobile drain' }),
      'mobile.workers.drainDoneToast',
    )
  }

  function doForceOffline(row: ConsoleWorkerRegistryResponse) {
    return runConfirmed(
      row,
      'offline',
      'mobile.workers.forceOfflineTitle',
      'mobile.workers.forceOfflineText',
      (tenantId) =>
        forceWorkerOffline(row.workerCode, {
          tenantId,
          reason: 'mobile force offline',
        }),
      'mobile.workers.forceOfflineDoneToast',
    )
  }

  function doTakeover(row: ConsoleWorkerRegistryResponse) {
    return runConfirmed(
      row,
      'takeover',
      'mobile.workers.takeoverTitle',
      'mobile.workers.takeoverText',
      (tenantId) => takeoverWorker(row.workerCode, { tenantId, reason: 'mobile takeover' }),
      'mobile.workers.takeoverDoneToast',
    )
  }

  async function doWarmup(row: ConsoleWorkerRegistryResponse) {
    if (!ensureWriteAvailable() || !canMutateConfig.value || busyCode.value) return
    const context = captureAction(row, 'warmup')
    if (!context.isCurrent()) return
    busyCode.value = row.workerCode
    try {
      await warmupWorker(row.workerCode, context.scope.tenantId)
      if (!context.isCurrentContext()) return
      ElMessage.success(t('mobile.workers.warmupDoneToast'))
      await load()
    } finally {
      if (actionScope.isCurrent(context.scope)) busyCode.value = null
    }
  }
  useTenantReload(load)
  useAutoRefresh(load, REFRESH_INTERVAL_COLD_MS)
</script>

<style scoped>
  .m-load-error {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px;
    color: var(--ios-label-secondary);
  }

  .m-load-error .m-btn {
    flex: none;
  }

  .m-workers-actions {
    flex-wrap: wrap;
  }

  .m-workers-actions .m-btn {
    flex: 1 1 9rem;
    white-space: nowrap;
  }
</style>
