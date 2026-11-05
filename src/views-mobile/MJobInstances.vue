<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.jobs.title') }}</div>
          <div v-if="!loading && !loadError" class="m-page__subtitle">
            {{ t('mobile.jobs.summary', { total }) }}
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

      <!-- 4 状态 tab + jobCode 搜索栏,跟 告警/Worker/审批 一致 -->
      <div class="m-tabs" role="tablist">
        <button
          v-for="opt in statusTabs"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="(query.instanceStatus || '') === opt.value"
          class="m-tab"
          :class="{ 'm-tab--active': (query.instanceStatus || '') === opt.value }"
          @click="onStatusTab(opt.value)"
        >
          <span class="m-tab__label">{{ opt.label }}</span>
          <span v-if="opt.badge != null" class="m-tab__badge" :class="badgeToneFor(opt.value)">
            {{ opt.badge }}
          </span>
        </button>
      </div>

      <MSearchBar
        v-if="searchOpen"
        ref="searchBarRef"
        :model-value="query.jobCode ?? ''"
        :placeholder="t('mobile.jobs.placeholderJobCode')"
        @update:model-value="onJobCodeInput"
      />

      <!-- SLA 违约筛选指示条:服务端按 deadline_at<now AND active status 过滤 -->
      <div v-if="slaBreachedOnly" class="m-filter-chip">
        <span class="m-filter-chip__label">
          {{
            loading || loadError
              ? t('mobile.jobs.slaFilterActive')
              : t('mobile.jobs.slaFilterChip', { total })
          }}
        </span>
        <button type="button" class="m-filter-chip__clear" @click="clearSlaFilter">
          {{ t('mobile.common.clear') }}
        </button>
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="4" />
      <div v-else-if="!loadError && rows.length === 0" class="m-empty">
        {{ slaBreachedOnly ? t('mobile.jobs.slaEmpty') : t('mobile.jobs.empty') }}
      </div>
      <div v-if="loadError" class="m-empty m-load-error" role="alert">
        <div>{{ t('mobile.common.loadFail') }}</div>
        <button class="m-btn" type="button" @click="load">{{ t('common.retry') }}</button>
      </div>

      <div
        v-for="row in rows"
        :key="row.id"
        class="m-card m-card--clickable"
        @click="openDetail(row)"
      >
        <div class="m-card__row">
          <button
            type="button"
            class="m-card__title m-job-card__detail"
            :aria-label="`${t('common.detail')} ${row.jobCode}`"
            @click.stop="openDetail(row)"
          >
            {{ row.jobCode }}
          </button>
          <span :class="['m-chip', statusChipClass(row.instanceStatus)]">
            {{ resolveEnumLabel('instanceStatus', row.instanceStatus) }}
          </span>
        </div>
        <div class="m-card__sub m-job-card__instance">
          <span class="m-job-card__instance-label">{{ t('mobile.jobs.instanceNo') }}</span>
          <button
            type="button"
            class="m-copy-text"
            :aria-label="`${t('common.copy')} ${t('mobile.jobs.instanceNo')} ${row.instanceNo}`"
            @click.stop="copy(row.instanceNo, 'instanceNo')"
          >
            {{ row.instanceNo }}
          </button>
        </div>
        <div class="m-card__meta m-job-card__meta">
          <div class="m-job-card__meta-item">
            <span class="m-card__meta-key">{{ t('mobile.jobs.bizDate') }}</span>
            <span class="m-job-card__meta-value">{{ row.bizDate }}</span>
          </div>
          <div class="m-job-card__meta-item">
            <span class="m-card__meta-key">{{ t('mobile.jobs.trigger') }}</span>
            <span class="m-job-card__meta-value">{{
              resolveEnumLabel('triggerType', jobInstanceTriggerSource(row))
            }}</span>
          </div>
          <div class="m-job-card__meta-item">
            <span class="m-card__meta-key">{{ t('mobile.jobs.priority') }}</span>
            <span class="m-job-card__meta-value">{{ row.priority }}</span>
          </div>
          <div class="m-job-card__meta-item m-job-card__meta-item--wide">
            <span class="m-card__meta-key">{{ t('mobile.jobs.startedAt') }}</span>
            <span class="m-job-card__meta-value">{{ fmt(row.startedAt) }}</span>
          </div>
          <div v-if="row.finishedAt" class="m-job-card__meta-item m-job-card__meta-item--wide">
            <span class="m-card__meta-key">{{ t('mobile.jobs.finishedAt') }}</span>
            <span class="m-job-card__meta-value">{{ fmt(row.finishedAt) }}</span>
          </div>
        </div>
        <div
          v-if="row.instanceStatus === 'RUNNING' || row.instanceStatus === 'FAILED'"
          class="m-card__actions"
          @click.stop
        >
          <button
            v-if="row.instanceStatus === 'FAILED'"
            class="m-btn m-btn--primary"
            data-track="jobs.retry"
            @click="retry(row)"
          >
            {{ t('mobile.jobs.retry') }}
          </button>
          <button
            v-if="row.instanceStatus === 'RUNNING'"
            class="m-btn m-btn--danger"
            data-track="jobs.terminate"
            @click="terminate(row)"
          >
            {{ t('mobile.jobs.terminate') }}
          </button>
        </div>
      </div>

      <!-- 触底自动加载 sentinel:IntersectionObserver 监听这个 div 进入视口 → 加载下一页 -->
      <div v-if="rows.length > 0" ref="bottomSentinelRef" class="m-infinite">
        <span v-if="loadingMore" class="m-infinite__text">{{
          t('mobile.common.loadingMore')
        }}</span>
        <div v-else-if="loadMoreError" class="m-load-error" role="alert">
          <span>{{ t('mobile.common.loadFail') }}</span>
          <button class="m-btn" type="button" @click="loadMore">{{ t('common.retry') }}</button>
        </div>
        <span v-else-if="!hasMore" class="m-infinite__text">{{ t('mobile.common.noMore') }}</span>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { jobInstanceTriggerSource } from '@/utils/jobInstanceTrigger'
  import { computed, nextTick, reactive, ref, watch } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Search } from '@lucide/vue'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MSearchBar from '@/layout-mobile/MSearchBar.vue'
  import { useCopy } from '@/composables/useCopy'
  import { instanceApi } from '@/api/instance'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'
  import { fmtDatetime } from '@/utils/datetime'

  const route = useRoute()
  const router = useRouter()
  const { t, te } = useI18n({ useScope: 'global' })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }

  const tenant = useTenantStore()
  const { copy } = useCopy()
  const loading = ref(false)
  const loadError = ref(false)
  const loadingMore = ref(false)
  const loadMoreError = ref(false)
  const rows = ref<ConsoleJobInstanceResponse[]>([])
  const total = ref(0)
  let requestSequence = 0

  // 4 状态 tab — '' = 全部。tab 用单数 status,跟后端 query.instanceStatus 直接对应。
  // RUNNING/FAILED/COMPLETED 是 oncall 三大高频档,其它细分状态压在「全部」里。
  const statusTabs = computed<Array<{ value: string; label: string; badge?: number | null }>>(
    () => [
      { value: '', label: t('mobile.jobs.filterAll') },
      { value: 'RUNNING', label: t('mobile.jobs.filterRunning') },
      { value: 'FAILED', label: t('mobile.jobs.filterFailed') },
      { value: 'SUCCESS', label: t('mobile.jobs.filterCompleted') },
    ],
  )

  function badgeToneFor(statusValue: string) {
    if (statusValue === 'RUNNING') return 'm-tab__badge--info'
    if (statusValue === 'FAILED') return 'm-tab__badge--danger'
    if (statusValue === 'SUCCESS') return 'm-tab__badge--success'
    return ''
  }

  // SLA 违约筛选:BE 已支持 slaBreached=true 服务端过滤 (deadline_at<now AND active)
  const slaBreachedOnly = computed(() => route.query.slaBreached === '1')

  const query = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    instanceStatus: (route.query.status as string) || '',
    startDate: '',
    endDate: '',
    slaBreached: slaBreachedOnly.value,
    page: 1,
    pageSize: 15,
    /** ADR-031 cursor 模式:首屏 null,loadMore 用上次响应的 nextCursor */
    cursor: null as string | null,
  })

  function clearSlaFilter() {
    const q = { ...route.query }
    delete q.slaBreached
    router.replace({ path: route.path, query: q })
    query.slaBreached = false
    load()
  }

  function fmt(ts?: string | null) {
    return fmtDatetime(ts)
  }

  function statusChipClass(s?: string) {
    switch (s) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'm-chip--success'
      case 'RUNNING':
        return 'm-chip--info'
      case 'FAILED':
      case 'CANCELLED':
        return 'm-chip--danger'
      case 'WAITING':
      case 'CREATED':
        return 'm-chip--warning'
      default:
        return ''
    }
  }

  // load() = 重置 cursor + 替换 rows;loadMore() = 用 nextCursor 追加(ADR-031)
  // cursor 模式相比之前 offset+touch-bottom 拼接的优势:并发写时不漏/不重(token 锁定 id<N 区间)
  const hasMoreRef = ref(false)
  async function load() {
    const sequence = ++requestSequence
    loading.value = true
    loadingMore.value = false
    loadError.value = false
    loadMoreError.value = false
    rows.value = []
    total.value = 0
    hasMoreRef.value = false
    query.tenantId = tenant.tenantId
    query.cursor = null
    try {
      const res = await instanceApi.list({ ...query })
      if (sequence !== requestSequence) return
      rows.value = res.records
      total.value = res.total
      query.cursor = res.nextCursor ?? null
      hasMoreRef.value = res.hasMore ?? false
    } catch {
      if (sequence !== requestSequence) return
      loadError.value = true
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  const hasMore = computed(() => hasMoreRef.value)

  async function loadMore() {
    const cannotLoadMoreInstances =
      loadingMore.value || loading.value || !hasMore.value || !query.cursor
    if (cannotLoadMoreInstances) {
      return
    }
    const sequence = requestSequence
    loadingMore.value = true
    loadMoreError.value = false
    try {
      const res = await instanceApi.list({ ...query })
      if (sequence !== requestSequence) return
      // 追加去重(虽然 cursor 保证不重,保留兜底防止 BE 异常)
      const known = new Set(rows.value.map((r) => r.id))
      const fresh = res.records.filter((r) => !known.has(r.id))
      rows.value.push(...fresh)
      query.cursor = res.nextCursor ?? null
      hasMoreRef.value = res.hasMore ?? false
    } catch {
      if (sequence !== requestSequence) return
      loadMoreError.value = true
    } finally {
      if (sequence === requestSequence) loadingMore.value = false
    }
  }

  // IntersectionObserver:sentinel 进入视口 → 触发 loadMore
  const bottomSentinelRef = ref<HTMLElement | null>(null)
  let io: IntersectionObserver | null = null
  watch(bottomSentinelRef, (el, _old, onCleanup) => {
    io?.disconnect()
    if (!el) return
    io = new IntersectionObserver(
      (entries) => {
        if (!loadMoreError.value && entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    onCleanup(() => io?.disconnect())
  })

  function openDetail(row: ConsoleJobInstanceResponse) {
    router.push(`/m/jobs/${row.id}`)
  }

  function onStatusTab(status: string) {
    query.instanceStatus = status
    load()
  }

  let kwTimer: ReturnType<typeof setTimeout> | null = null
  function onJobCodeInput(v: string) {
    query.jobCode = v
    // 250ms 防抖,避免每个字符都请求
    if (kwTimer) clearTimeout(kwTimer)
    kwTimer = setTimeout(() => {
      load()
    }, 250)
  }

  const searchOpen = ref(false)
  const searchBarRef = ref<{ focus: () => void } | null>(null)
  async function toggleSearch() {
    if (searchOpen.value) {
      // 收起 → 清空 keyword 并立即重查
      if (query.jobCode) {
        query.jobCode = ''
        load()
      }
      searchOpen.value = false
    } else {
      searchOpen.value = true
      await nextTick()
      searchBarRef.value?.focus()
    }
  }

  // 重试 = 构造性,直接执行 + toast(终止才确认 — 真破坏性)
  async function retry(row: ConsoleJobInstanceResponse) {
    try {
      await instanceApi.retry(row.instanceNo, tenant.tenantId, row.jobCode, row.bizDate)
      ElMessage.success(t('mobile.jobs.retryToast'))
      await load()
    } catch {
      /* api 失败已由 interceptor 处理 */
    }
  }

  async function terminate(row: ConsoleJobInstanceResponse) {
    try {
      await confirmActionSheet(
        `${t('mobile.jobs.terminate')} ${row.instanceNo}?`,
        t('mobile.jobs.terminate'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await instanceApi.terminate(row.id, tenant.tenantId)
      ElMessage.success(t('mobile.jobs.terminateToast'))
      await load()
    } catch {
      /* cancelled */
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .m-load-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .m-job-card__instance {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .m-job-card__instance-label {
    flex-shrink: 0;
    color: var(--ios-label-tertiary);
    font-size: 12px;
  }

  .m-job-card__detail,
  .m-job-card__instance .m-copy-text {
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    line-height: inherit;
    text-align: left;
  }

  .m-job-card__detail {
    font-family: inherit;
    cursor: pointer;
  }

  .m-job-card__detail:focus-visible,
  .m-job-card__instance .m-copy-text:focus-visible {
    outline: 2px solid var(--ios-blue);
    outline-offset: 2px;
  }

  .m-job-card__instance .m-copy-text {
    min-width: 44px;
    color: var(--ios-blue);
    font-family: var(--font-mono);
    font-size: inherit;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .m-job-card__meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px 14px;
  }

  .m-job-card__meta-item {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }

  .m-job-card__meta-item--wide {
    grid-column: 1 / -1;
  }

  .m-job-card__meta-item .m-card__meta-key {
    margin-right: 0;
    font-size: 11px;
  }

  .m-job-card__meta-value {
    overflow-wrap: anywhere;
    color: var(--ios-label-secondary);
    line-height: 1.35;
  }
  .m-filter-chip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 4px 0 8px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--color-warning-light);
    color: var(--color-warning, #b45309);
    font-size: 13px;
    line-height: 1.4;
  }
  .m-filter-chip__label {
    flex: 1;
    min-width: 0;
  }
  .m-filter-chip__clear {
    flex-shrink: 0;
    padding: 4px 10px;
    border: none;
    border-radius: 8px;
    background: rgb(0 0 0 / 6%);
    color: inherit;
    font-size: 12px;
    cursor: pointer;
  }
</style>
