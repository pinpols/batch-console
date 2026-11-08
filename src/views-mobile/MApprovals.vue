<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div class="m-page__title">{{ t('mobile.approvals.title') }}</div>
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

      <!-- 4 tab + 搜索框,与 告警/Worker 一套交互 -->
      <div class="m-tabs" role="tablist">
        <button
          v-for="opt in filterOptions"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="filter === opt.value"
          class="m-tab"
          :class="{ 'm-tab--active': filter === opt.value }"
          @click="filter = opt.value as ApprovalFilter"
        >
          <span class="m-tab__label">{{ opt.label }}</span>
          <span v-if="counts[opt.value] > 0" class="m-tab__badge" :class="badgeToneFor(opt.value)">
            {{ counts[opt.value] > 99 ? '99+' : counts[opt.value] }}
          </span>
        </button>
      </div>

      <MSearchBar
        v-if="searchOpen"
        ref="searchBarRef"
        v-model="keyword"
        :placeholder="t('mobile.approvals.searchPlaceholder')"
      />

      <MSkeleton v-if="loading && filtered.length === 0" :count="3" />
      <div v-else-if="!loadError && filtered.length === 0" class="m-empty">
        {{
          keyword
            ? t('mobile.common.emptyForSearch')
            : t(filter === 'pending' ? 'mobile.approvals.noPending' : 'mobile.approvals.noMatched')
        }}
      </div>
      <div v-if="loadError" class="m-empty m-load-error" role="alert">
        <span>{{ t('mobile.common.loadFail') }}</span>
        <button class="m-btn" type="button" @click="load()">{{ t('common.retry') }}</button>
      </div>
      <div v-if="countsError" class="m-count-error" role="status">
        {{ t('mobile.approvals.countsUnavailable') }}
        <button class="m-btn" type="button" @click="load()">{{ t('common.retry') }}</button>
      </div>

      <div v-for="row in filtered" :key="row.approvalNo" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">
            {{ resolveEnumLabel('approvalType', row.approvalType) }}
            <template v-if="row.actionType && row.actionType !== row.approvalType">
              · {{ resolveEnumLabel('approvalActionType', row.actionType) }}
            </template>
          </div>
          <span :class="['m-chip', statusChipClass(row.approvalStatus)]">
            {{ resolveEnumLabel('approvalStatus', row.approvalStatus) }}
          </span>
        </div>
        <div class="m-card__sub">
          {{ t('mobile.approvals.approvalNo') }}:
          <button
            type="button"
            class="m-copy-text"
            :aria-label="`${t('common.copy')} ${t('mobile.approvals.approvalNo')} ${row.approvalNo}`"
            @click.stop="copy(row.approvalNo, 'approvalNo')"
          >
            {{ row.approvalNo }}
          </button>
        </div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">{{ t('mobile.approvals.target') }}</span
            >{{ resolveEnumLabel('approvalTargetType', row.targetType) }}/{{ row.targetId || '—' }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.approvals.submitter') }}</span>
            {{ row.requesterId || '—' }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.tenants.created') }}</span>
            {{ fmt(row.createdAt) }}
          </div>
          <div v-if="row.rejectionReason">
            <span class="m-card__meta-key">{{ t('mobile.approvals.rejectionReason') }}</span
            >{{ row.rejectionReason }}
          </div>
        </div>
        <div v-if="isPending(row)" class="m-card__actions">
          <button
            class="m-btn m-btn--plain-danger"
            :disabled="!canMutateConfig || writesFrozen || busyApproval !== null"
            data-track="approvals.reject"
            @click="decide(row, 'reject')"
          >
            <CircleX :size="16" aria-hidden="true" />
            {{ t('mobile.approvals.reject') }}
          </button>
          <button
            class="m-btn m-btn--primary"
            :disabled="
              !canMutateConfig || writesFrozen || busyApproval !== null || selfApprovalBlocked(row)
            "
            data-track="approvals.approve"
            @click="decide(row, 'approve')"
          >
            <CircleCheck :size="16" aria-hidden="true" />
            {{
              selfApprovalBlocked(row)
                ? t('mobile.approvals.selfApprovalForbidden')
                : t('mobile.approvals.approve')
            }}
          </button>
        </div>
      </div>
      <div v-if="filtered.length > 0" class="m-load-more">
        <div v-if="loadMoreError" role="alert">{{ t('mobile.common.loadFail') }}</div>
        <button v-if="hasMore" class="m-btn" :disabled="loading" @click="loadMore">
          {{
            loading
              ? t('mobile.common.loadingMore')
              : loadMoreError
                ? t('common.retry')
                : t('mobile.common.loadMore')
          }}
        </button>
        <span v-else>{{ t('mobile.common.noMore') }}</span>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { usePermission } from '@/composables/usePermission'
  import { useI18n } from 'vue-i18n'
  import { CircleCheck, CircleX, Search } from '@lucide/vue'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useCopy } from '@/composables/useCopy'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MSearchBar from '@/layout-mobile/MSearchBar.vue'
  import { queryApprovalsPage, approveOne, rejectOne } from '@/api/approvals'
  import type { ConsoleApprovalCommandResponse } from '@/types/console-api'
  import { fmtDatetime } from '@/utils/datetime'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const { canMutateConfig } = usePermission()
  const listScope = useTenantRequestScope()
  const actionScope = useTenantRequestScope()
  const { copy } = useCopy()
  const { writesFrozen, ensureWriteAvailable } = useWriteAvailability()

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }
  const loading = ref(false)
  const loadError = ref(false)
  const loadMoreError = ref(false)
  const countsError = ref(false)
  const busyApproval = ref<string | null>(null)
  const rows = ref<ConsoleApprovalCommandResponse[]>([])
  const page = ref(1)
  const pageSize = 30
  const total = ref(0)
  const hasMore = ref(false)
  const statusTotals = ref<Record<string, number>>({})

  type ApprovalFilter = 'pending' | 'approved' | 'rejected' | 'all'
  const filter = ref<ApprovalFilter>('pending')
  const keyword = ref('')
  let searchTimer: ReturnType<typeof setTimeout> | null = null
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

  const filterOptions = computed(() => [
    { value: 'pending', label: t('mobile.approvals.filterPending') },
    { value: 'approved', label: t('mobile.approvals.filterApproved') },
    { value: 'rejected', label: t('mobile.approvals.filterRejected') },
    { value: 'all', label: t('mobile.approvals.filterAll') },
  ])

  // 各 tab 的 count
  const counts = computed<Record<string, number>>(() => ({
    pending: statusTotals.value.PENDING ?? 0,
    approved: (statusTotals.value.APPROVED ?? 0) + (statusTotals.value.EXECUTED ?? 0),
    rejected: statusTotals.value.REJECTED ?? 0,
    all: statusTotals.value.ALL ?? 0,
  }))

  function badgeToneFor(filterKey: string) {
    if (filterKey === 'pending') return 'm-tab__badge--warning'
    if (filterKey === 'approved') return 'm-tab__badge--success'
    if (filterKey === 'rejected') return 'm-tab__badge--danger'
    return '' // all → 默认灰
  }

  const filtered = computed(() => rows.value)

  function fmt(ts?: string | null) {
    return fmtDatetime(ts)
  }

  function isPending(row: ConsoleApprovalCommandResponse) {
    return row.approvalStatus === 'PENDING'
  }

  function statusChipClass(status?: string | null) {
    switch (status) {
      case 'PENDING':
        return 'm-chip--warning'
      case 'APPROVED':
      case 'EXECUTED':
        return 'm-chip--success'
      case 'REJECTED':
        return 'm-chip--danger'
      default:
        return 'm-chip--info'
    }
  }

  function generalApprovalFilters(value: string) {
    return {
      excludeApprovalTypes: 'CATCH_UP',
      ...(value ? { keyword: value } : {}),
    }
  }

  function selfApprovalBlocked(row: ConsoleApprovalCommandResponse) {
    const requester = row.requesterId ?? ''
    const operator = auth.userInfo?.username ?? auth.userInfo?.userId ?? ''
    return row.approvalType === 'SELF_SERVICE' && requester !== '' && requester === operator
  }

  type QueryContext = { tenantId: string; filter: ApprovalFilter; keyword: string }

  async function refreshCounts(context: QueryContext) {
    const base = generalApprovalFilters(context.keyword)
    const [all, pending, approved, executed, rejected] = await Promise.all([
      queryApprovalsPage(context.tenantId, 1, 1, base),
      queryApprovalsPage(context.tenantId, 1, 1, { ...base, approvalStatus: 'PENDING' }),
      queryApprovalsPage(context.tenantId, 1, 1, { ...base, approvalStatus: 'APPROVED' }),
      queryApprovalsPage(context.tenantId, 1, 1, { ...base, approvalStatus: 'EXECUTED' }),
      queryApprovalsPage(context.tenantId, 1, 1, { ...base, approvalStatus: 'REJECTED' }),
    ])
    return {
      ALL: all.total ?? 0,
      PENDING: pending.total ?? 0,
      APPROVED: approved.total ?? 0,
      EXECUTED: executed.total ?? 0,
      REJECTED: rejected.total ?? 0,
    }
  }

  async function queryCurrentPage(requestedPage: number, context: QueryContext) {
    const base = generalApprovalFilters(context.keyword)
    if (context.filter === 'approved') {
      const [approved, executed] = await Promise.all([
        queryApprovalsPage(context.tenantId, requestedPage, pageSize, {
          ...base,
          approvalStatus: 'APPROVED',
        }),
        queryApprovalsPage(context.tenantId, requestedPage, pageSize, {
          ...base,
          approvalStatus: 'EXECUTED',
        }),
      ])
      return {
        items: [...(approved.items ?? []), ...(executed.items ?? [])].sort((a, b) => {
          const rightCreatedAt = String(b.createdAt ?? '')
          const leftCreatedAt = String(a.createdAt ?? '')
          return rightCreatedAt.localeCompare(leftCreatedAt)
        }),
        total: (approved.total ?? 0) + (executed.total ?? 0),
      }
    }
    const status =
      context.filter === 'pending'
        ? 'PENDING'
        : context.filter === 'rejected'
          ? 'REJECTED'
          : undefined
    return queryApprovalsPage(context.tenantId, requestedPage, pageSize, {
      ...base,
      ...(status ? { approvalStatus: status } : {}),
    })
  }

  async function load(reset = true) {
    const scope = listScope.begin()
    if (!scope.tenantId) {
      rows.value = []
      loading.value = false
      return
    }
    const context = {
      tenantId: scope.tenantId,
      filter: filter.value,
      keyword: keyword.value.trim(),
    }
    const requestedPage = reset ? 1 : page.value + 1
    if (reset) {
      rows.value = []
      statusTotals.value = {}
      total.value = 0
      hasMore.value = false
      countsError.value = false
    }
    loading.value = true
    loadError.value = false
    loadMoreError.value = false
    try {
      const result = await queryCurrentPage(requestedPage, context)
      if (!listScope.isCurrent(scope)) return
      page.value = requestedPage
      const next = result.items ?? []
      rows.value = reset ? next : [...rows.value, ...next]
      total.value = result.total ?? rows.value.length
      hasMore.value = rows.value.length < total.value
      if (reset) {
        try {
          const resultCounts = await refreshCounts(context)
          if (listScope.isCurrent(scope)) statusTotals.value = resultCounts
        } catch {
          if (listScope.isCurrent(scope)) countsError.value = true
        }
      }
    } catch {
      if (!listScope.isCurrent(scope)) return
      if (reset) loadError.value = true
      else loadMoreError.value = true
    } finally {
      if (listScope.isCurrent(scope)) loading.value = false
    }
  }

  async function loadMore() {
    if (loading.value || !hasMore.value) return
    await load(false)
  }

  async function decide(row: ConsoleApprovalCommandResponse, decision: 'approve' | 'reject') {
    if (!canMutateConfig.value || !ensureWriteAvailable() || busyApproval.value) return
    if (decision === 'approve' && selfApprovalBlocked(row)) return
    const scope = actionScope.begin()
    const actor = auth.userInfo?.username ?? auth.userInfo?.userId
    const isCurrent = () =>
      actionScope.isCurrent(scope) &&
      canMutateConfig.value &&
      actor === (auth.userInfo?.username ?? auth.userInfo?.userId)
    const targetIsCurrent = () =>
      isCurrent() &&
      rows.value.some((item) => item.approvalNo === row.approvalNo && isPending(item))
    if (!targetIsCurrent()) return
    busyApproval.value = row.approvalNo
    try {
      if (decision === 'reject') {
        await confirmActionSheet(
          `${t('mobile.approvals.reject')} ${row.approvalNo}?`,
          t('mobile.approvals.reject'),
          {
            type: 'warning',
            confirmButtonText: t('mobile.approvals.reject'),
            cancelButtonText: t('common.cancel'),
          },
        )
      }
      if (!targetIsCurrent()) return
      if (decision === 'approve') await approveOne(row.approvalNo, { tenantId: scope.tenantId })
      else await rejectOne(row.approvalNo, { tenantId: scope.tenantId })
      if (!isCurrent()) return
      ElMessage.success(
        t(
          decision === 'approve'
            ? 'mobile.approvals.approvedToast'
            : 'mobile.approvals.rejectedToast',
        ),
      )
      await load()
    } catch {
      /* 取消或接口失败由现有交互处理。 */
    } finally {
      if (actionScope.isCurrent(scope)) busyApproval.value = null
    }
  }

  watch(
    () => tenant.tenantId,
    (tenantId) => {
      if (searchTimer) clearTimeout(searchTimer)
      rows.value = []
      statusTotals.value = {}
      hasMore.value = false
      loadError.value = false
      loadMoreError.value = false
      countsError.value = false
      busyApproval.value = null
      if (!tenantId) loading.value = false
    },
    { flush: 'sync' },
  )
  useTenantReload(() => load(true))
  watch(
    filter,
    () => {
      actionScope.begin()
      busyApproval.value = null
      if (searchTimer) clearTimeout(searchTimer)
      void load(true)
    },
    { flush: 'sync' },
  )
  watch(
    keyword,
    () => {
      if (searchTimer) clearTimeout(searchTimer)
      actionScope.begin()
      busyApproval.value = null
      listScope.begin()
      rows.value = []
      statusTotals.value = {}
      hasMore.value = false
      loadError.value = false
      loadMoreError.value = false
      countsError.value = false
      loading.value = true
      searchTimer = setTimeout(() => void load(true), 300)
    },
    { flush: 'sync' },
  )
  onUnmounted(() => {
    if (searchTimer) clearTimeout(searchTimer)
  })
</script>

<style scoped>
  .m-load-error,
  .m-count-error {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    color: var(--ios-label-secondary);
  }

  .m-load-error {
    flex-direction: column;
  }

  .m-count-error .m-btn,
  .m-load-error .m-btn {
    flex: none;
  }
</style>
