<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.catchup.title') }}</div>
          <div v-if="!loading && (!loadError || rows.length)" class="m-page__subtitle">
            {{ t('mobile.catchup.pendingCount', { n: pendingCount }) }}
          </div>
        </div>
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="3" />
      <div v-else-if="!loadError && rows.length === 0" class="m-empty">
        {{ t('mobile.catchup.empty') }}
      </div>
      <div v-if="loadError" class="m-load-error" :class="{ 'm-empty': !rows.length }" role="alert">
        <span>{{ rows.length ? t('mobile.catchup.stale') : t('mobile.common.loadFail') }}</span>
        <button class="m-btn" type="button" @click="load">{{ t('common.retry') }}</button>
      </div>

      <div v-for="row in rows" :key="row.id" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title m-catchup-title">
            <span>{{ row.workflowCode }}</span>
            <span class="m-catchup-title__date">{{ row.bizDate }}</span>
          </div>
          <span :class="['m-chip', statusChipClass(row.approvalStatus)]">
            {{
              row.approvalStatus
                ? resolveEnumLabel('approvalStatus', row.approvalStatus)
                : resolveEnumLabel('triggerRequestStatus', row.requestStatus)
            }}
          </span>
        </div>
        <div class="m-card__sub">{{ t('mobile.catchup.requestId') }}: {{ row.requestId }}</div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">{{ t('mobile.tenants.created') }}</span>
            {{ fmt(row.createdAt) }}
          </div>
          <div>
            <span class="m-card__meta-key">{{ t('common.trace') }}</span
            >{{ row.traceId }}
          </div>
        </div>
        <div v-if="canOperate && isActionable(row)" class="m-card__actions">
          <button
            class="m-btn m-btn--primary"
            :disabled="writesFrozen || loading || loadError || busyKey !== null"
            @click="decide(row, 'approve')"
          >
            {{ t('mobile.catchup.approve') }}
          </button>
          <button
            class="m-btn m-btn--danger"
            :disabled="writesFrozen || loading || loadError || busyKey !== null"
            @click="decide(row, 'reject')"
          >
            {{ t('mobile.catchup.reject') }}
          </button>
        </div>
        <div
          v-else-if="isPendingRequest(row.requestStatus) && !row.approvalNo"
          class="m-card__notice"
        >
          {{ t('mobile.catchup.legacyNoApprovalNo') }}
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { fetchAllPageItems } from '@/api/adapters'
  import { approveOne, rejectOne } from '@/api/approvals'
  import type { ConsolePendingCatchUpResponse } from '@/types/console-api'
  import { fmtDatetime } from '@/utils/datetime'

  const { t, te } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const { writesFrozen, ensureWriteAvailable } = useWriteAvailability()
  const listScope = useTenantRequestScope()
  const actionScope = useTenantRequestScope()
  const busyKey = ref<string | null>(null)
  const canOperate = computed(() => auth.canAccess('OPERATOR'))

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${group}.${value}`
    if (te(key)) return t(key)
    return metaEnums.value?.[group]?.find((o) => o.value === value)?.label ?? value
  }
  const loading = ref(false)
  const loadError = ref(false)
  const rows = ref<ConsolePendingCatchUpResponse[]>([])
  watch(
    () => tenant.tenantId,
    (tenantId) => {
      rows.value = []
      loadError.value = false
      busyKey.value = null
      if (!tenantId) loading.value = false
    },
    { flush: 'sync' },
  )

  const pendingCount = computed(
    () => rows.value.filter((r) => r.approvalStatus === 'PENDING').length,
  )

  function fmt(ts?: string | null) {
    return fmtDatetime(ts)
  }

  function isPendingRequest(s?: string) {
    return s === 'ACCEPTED' || s === 'PENDING' || s === 'PENDING_APPROVAL'
  }

  function statusChipClass(s?: string | null) {
    switch (s) {
      case 'APPROVED':
      case 'EXECUTED':
        return 'm-chip--success'
      case 'REJECTED':
        return 'm-chip--danger'
      case 'PENDING':
      case 'PENDING_APPROVAL':
        return 'm-chip--warning'
      default:
        return 'm-chip--info'
    }
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
      const result = await fetchAllPageItems<ConsolePendingCatchUpResponse>(
        '/api/console/queries/catch-up-approvals',
        { tenantId: scope.tenantId },
      )
      if (listScope.isCurrent(scope)) rows.value = result
    } catch {
      if (listScope.isCurrent(scope)) loadError.value = true
    } finally {
      if (listScope.isCurrent(scope)) loading.value = false
    }
  }

  /**
   * approval_command JOIN 出来的 approvalNo 存在 + approvalStatus 为 PENDING 时，
   * 走统一审批接口 POST /api/console/approvals/{approvalNo}/(approve|reject)。
   * 历史遗留 ACCEPTED 但没走 approval_command 的 trigger_request 行 approvalNo=null,
   * 此时按钮隐藏,提示"旧路径无 approvalNo"。
   */
  function isActionable(row: ConsolePendingCatchUpResponse): boolean {
    if (!row.approvalNo) return false
    const status = row.approvalStatus ?? ''
    return !status || status === 'PENDING'
  }

  async function decide(row: ConsolePendingCatchUpResponse, decision: 'approve' | 'reject') {
    if (
      !row.approvalNo ||
      busyKey.value ||
      loading.value ||
      loadError.value ||
      !canOperate.value ||
      !ensureWriteAvailable()
    )
      return
    const scope = actionScope.begin()
    const operatorId = auth.userInfo?.username
    const actor = operatorId ?? auth.userInfo?.userId
    const isCurrent = () =>
      actionScope.isCurrent(scope) &&
      canOperate.value &&
      !writesFrozen.value &&
      actor === (auth.userInfo?.username ?? auth.userInfo?.userId)
    const approvalNo = row.approvalNo
    if (
      !isCurrent() ||
      !rows.value.some((item) => item.approvalNo === approvalNo && isActionable(item))
    )
      return
    busyKey.value = approvalNo
    try {
      const request = { tenantId: scope.tenantId, operatorId }
      if (decision === 'approve') await approveOne(approvalNo, request)
      else await rejectOne(approvalNo, request)
      if (!isCurrent()) return
      ElMessage.success(
        t(
          decision === 'approve' ? 'mobile.catchup.approveSuccess' : 'mobile.catchup.rejectSuccess',
        ),
      )
      await load()
    } catch {
      if (isCurrent())
        ElMessage.error(
          t(decision === 'approve' ? 'mobile.catchup.approveFail' : 'mobile.catchup.rejectFail'),
        )
    } finally {
      if (actionScope.isCurrent(scope)) busyKey.value = null
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .m-load-error {
    display: flex;
    flex-direction: column;
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

  .m-catchup-title {
    display: flex;
    flex-wrap: wrap;
    gap: 0 6px;
  }

  .m-catchup-title__date {
    white-space: nowrap;
  }
</style>
