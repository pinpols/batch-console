<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.approvals.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.approvals.pendingCount', { n: pendingCount }) }}
          </div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('mobile.common.loading') : t('mobile.common.refresh') }}
        </button>
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="3" />
      <div v-else-if="rows.length === 0" class="m-empty">{{ t('mobile.approvals.noPending') }}</div>

      <div v-for="row in rows" :key="row.approvalNo" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">
            {{ resolveEnumLabel('approvalType', row.approvalType) }} · {{ row.actionType }}
          </div>
          <span :class="['m-chip', statusChipClass(row.approvalStatus)]">
            {{ resolveEnumLabel('approvalStatus', row.approvalStatus) }}
          </span>
        </div>
        <div class="m-card__sub">No: {{ row.approvalNo }}</div>
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
          <button class="m-btn m-btn--plain-danger" @click="reject(row)">
            {{ t('mobile.approvals.reject') }}
          </button>
          <button class="m-btn m-btn--primary" @click="approve(row)">
            {{ t('mobile.approvals.approve') }}
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
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { queryApprovals, approveOne, rejectOne } from '@/api/approvals'
  import type { ConsoleApprovalCommandResponse } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }
  const loading = ref(false)
  const rows = ref<ConsoleApprovalCommandResponse[]>([])

  const pendingCount = computed(
    () => rows.value.filter((r) => r.approvalStatus === 'PENDING').length,
  )

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

  async function approve(row: ConsoleApprovalCommandResponse) {
    try {
      await ElMessageBox.confirm(
        `${t('mobile.approvals.approve')} ${row.approvalNo}?`,
        t('mobile.approvals.approve'),
        {
          type: 'info',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await approveOne(row.approvalNo, { tenantId: tenant.tenantId })
      ElMessage.success(t('mobile.approvals.approvedToast'))
      await load()
    } catch {
      /* cancelled */
    }
  }

  async function reject(row: ConsoleApprovalCommandResponse) {
    try {
      await ElMessageBox.confirm(
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

  onMounted(load)
  watch(() => tenant.tenantId, load)
</script>
