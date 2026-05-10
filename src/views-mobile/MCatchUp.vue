<template>
  <MPullRefresh :on-refresh="load">
    <div class="m-page">
      <div class="m-page__header">
        <div>
          <div class="m-page__title">{{ t('mobile.catchup.title') }}</div>
          <div class="m-page__subtitle">
            {{ t('mobile.catchup.pendingCount', { n: pendingCount }) }}
          </div>
        </div>
        <button class="m-page__refresh" :disabled="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          {{ loading ? t('mobile.common.loading') : t('mobile.common.refresh') }}
        </button>
      </div>

      <MSkeleton v-if="loading && rows.length === 0" :count="3" />
      <div v-else-if="rows.length === 0" class="m-empty">{{ t('mobile.catchup.empty') }}</div>

      <div v-for="row in rows" :key="row.id" class="m-card">
        <div class="m-card__row">
          <div class="m-card__title">{{ row.jobCode }} · {{ row.bizDate }}</div>
          <span :class="['m-chip', statusChipClass(row.requestStatus)]">
            {{ resolveEnumLabel('approvalStatus', row.requestStatus) }}
          </span>
        </div>
        <div class="m-card__sub">request: {{ row.requestId }}</div>
        <div class="m-card__meta">
          <div>
            <span class="m-card__meta-key">{{ t('mobile.tenants.created') }}</span>
            {{ fmt(row.createdAt) }}
          </div>
          <div><span class="m-card__meta-key">trace</span>{{ row.traceId }}</div>
        </div>
        <div v-if="isPending(row.requestStatus)" class="m-card__notice">
          {{ t('mobile.catchup.pendingApi') }}
        </div>
      </div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useTenantStore } from '@/stores/tenant'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import MSkeleton from '@/layout-mobile/MSkeleton.vue'
  import { fetchAllPageItems } from '@/api/adapters'
  import type { ConsolePendingCatchUpResponse } from '@/types/console-api'

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
  const rows = ref<ConsolePendingCatchUpResponse[]>([])

  const pendingCount = computed(() => rows.value.filter((r) => isPending(r.requestStatus)).length)

  function fmt(ts?: string | null) {
    if (!ts) return '—'
    try {
      return new Date(ts).toLocaleString('zh-CN', { hour12: false })
    } catch {
      return ts
    }
  }

  function isPending(s?: string) {
    return s === 'PENDING' || s === 'PENDING_APPROVAL'
  }

  function statusChipClass(s?: string) {
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
    loading.value = true
    try {
      rows.value = await fetchAllPageItems<ConsolePendingCatchUpResponse>(
        '/api/console/queries/catch-up-approvals',
        { tenantId: tenant.tenantId },
      )
    } catch {
      ElMessage.error(t('mobile.common.loadFail'))
    } finally {
      loading.value = false
    }
  }

  // 批准/拒绝按钮已下线:原 jobApi.catchUpApprove 调用字段名与 BE DTO 不一致,
  // 且单接口不能拒绝。等 BE 把 approvalNo 加进 ConsolePendingCatchUpResponse + 同步 openapi
  // 之后,在桌面端 Approvals 流程统一处理;移动端仅作只读查看。

  onMounted(load)
  watch(() => tenant.tenantId, load)
</script>
