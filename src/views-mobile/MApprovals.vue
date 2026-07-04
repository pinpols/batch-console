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
      <div v-else-if="filtered.length === 0" class="m-empty">
        {{ keyword ? t('mobile.common.emptyForSearch') : t('mobile.approvals.noPending') }}
      </div>

      <div v-for="row in filtered" :key="row.approvalNo" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">
            {{ resolveEnumLabel('approvalType', row.approvalType) }} · {{ row.actionType }}
          </div>
          <span :class="['m-chip', statusChipClass(row.approvalStatus)]">
            {{ resolveEnumLabel('approvalStatus', row.approvalStatus) }}
          </span>
        </div>
        <div class="m-card__sub">
          No:
          <span class="m-copy-text" @click.stop="copy(row.approvalNo, 'approvalNo')">{{
            row.approvalNo
          }}</span>
        </div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">target</span>{{ row.targetType }}/{{
              row.targetId || '—'
            }}
          </div>
          <div>
            <span class="m-card__meta-key">{{
              t('mobile.approvals.submitterPrefix', { who: '' }).trim()
            }}</span>
            {{ row.requesterId || '—' }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('mobile.tenants.created') }}</span>
            {{ fmt(row.createdAt) }}
          </div>
          <div v-if="row.rejectionReason">
            <span class="m-card__meta-key">reason</span>{{ row.rejectionReason }}
          </div>
        </div>
        <div v-if="isPending(row)" class="m-card__actions">
          <button
            class="m-btn m-btn--plain-danger"
            data-track="approvals.reject"
            @click="reject(row)"
          >
            {{ t('mobile.approvals.reject') }}
          </button>
          <button class="m-btn m-btn--primary" data-track="approvals.approve" @click="approve(row)">
            {{ t('mobile.approvals.approve') }}
          </button>
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useI18n } from 'vue-i18n'
  import { Search } from 'lucide-vue-next'
  import { ElMessage } from 'element-plus'
  import { confirmActionSheet } from '@/layout-mobile/MActionSheet'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useCopy } from '@/composables/useCopy'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import MSearchBar from '@/layout-mobile/MSearchBar.vue'
  import { queryApprovals, approveOne, rejectOne } from '@/api/approvals'
  import type { ConsoleApprovalCommandResponse } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const { copy } = useCopy()

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }
  const loading = ref(false)
  const rows = ref<ConsoleApprovalCommandResponse[]>([])

  type ApprovalFilter = 'pending' | 'approved' | 'rejected' | 'all'
  const filter = ref<ApprovalFilter>('pending')
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

  const filterOptions = computed(() => [
    { value: 'pending', label: t('mobile.approvals.filterPending') },
    { value: 'approved', label: t('mobile.approvals.filterApproved') },
    { value: 'rejected', label: t('mobile.approvals.filterRejected') },
    { value: 'all', label: t('mobile.approvals.filterAll') },
  ])

  // 各 tab 的 count
  const counts = computed<Record<string, number>>(() => ({
    pending: rows.value.filter((r) => r.approvalStatus === 'PENDING').length,
    approved: rows.value.filter(
      (r) => r.approvalStatus === 'APPROVED' || r.approvalStatus === 'EXECUTED',
    ).length,
    rejected: rows.value.filter((r) => r.approvalStatus === 'REJECTED').length,
    all: rows.value.length,
  }))

  function badgeToneFor(filterKey: string) {
    if (filterKey === 'pending') return 'm-tab__badge--warning'
    if (filterKey === 'approved') return 'm-tab__badge--success'
    if (filterKey === 'rejected') return 'm-tab__badge--danger'
    return '' // all → 默认灰
  }

  // tabs(状态)+ keyword(approvalNo/requesterId/target/actionType 模糊)
  const filtered = computed(() => {
    let list = rows.value
    if (filter.value === 'pending') {
      list = list.filter((r) => r.approvalStatus === 'PENDING')
    } else if (filter.value === 'approved') {
      list = list.filter((r) => r.approvalStatus === 'APPROVED' || r.approvalStatus === 'EXECUTED')
    } else if (filter.value === 'rejected') {
      list = list.filter((r) => r.approvalStatus === 'REJECTED')
    }
    const kw = keyword.value.trim().toLowerCase()
    if (kw) {
      list = list.filter((r) => {
        return (
          r.approvalNo?.toLowerCase().includes(kw) ||
          r.requesterId?.toLowerCase().includes(kw) ||
          r.targetId?.toLowerCase().includes(kw) ||
          r.targetType?.toLowerCase().includes(kw) ||
          r.actionType?.toLowerCase().includes(kw)
        )
      })
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

  async function load() {
    loading.value = true
    try {
      rows.value = await queryApprovals(tenant.tenantId)
    } catch {
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  // 通过 = 构造性操作,直接执行 + toast,不弹二次确认(iOS 习惯)
  async function approve(row: ConsoleApprovalCommandResponse) {
    try {
      await approveOne(row.approvalNo, { tenantId: tenant.tenantId })
      ElMessage.success(t('mobile.approvals.approvedToast'))
      await load()
    } catch {
      /* api 错误已由 interceptor 弹 toast */
    }
  }

  async function reject(row: ConsoleApprovalCommandResponse) {
    try {
      await confirmActionSheet(
        `${t('mobile.approvals.reject')} ${row.approvalNo}?`,
        t('mobile.approvals.reject'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await rejectOne(row.approvalNo, { tenantId: tenant.tenantId })
      ElMessage.success(t('mobile.approvals.rejectedToast'))
      await load()
    } catch {
      /* cancelled */
    }
  }
  useTenantReload(load)
</script>
