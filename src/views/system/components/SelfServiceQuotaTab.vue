<template>
  <div>
    <div class="quota-summary">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        :title="t('selfServiceQuotaTab.summaryTitle')"
        :description="t('selfServiceQuotaTab.summaryDesc')"
      />
    </div>

    <div class="data-panel quota-data-panel" v-loading="loadingQuota">
      <div class="section-toolbar">
        <div>
          <h3 class="section-title u-mb-0">{{ t('selfServiceQuotaTab.sectionQuota') }}</h3>
          <div v-if="quotaLoadedAt" class="refresh-meta">
            {{ t('selfServiceQuotaTab.lastUpdated', { time: quotaLoadedAt }) }}
          </div>
        </div>
        <span class="u-flex-1" />
        <el-button
          :icon="Refresh"
          :loading="loadingQuota || refreshQuotaAction.loading.value"
          :disabled="loadingQuota || refreshQuotaAction.loading.value"
          @click="refreshQuotaAction.run(refreshQuota)"
        >
          {{ t('selfServiceQuotaTab.btnRefresh') }}
        </el-button>
      </div>
      <JsonPreview v-if="hasQuotaData" :data="quota" />
      <EmptyState v-else :description="t('selfServiceQuotaTab.emptyQuota')" :image-size="72" />
    </div>

    <div class="data-panel quota-data-panel" v-loading="loadingUsage">
      <div class="section-toolbar">
        <div>
          <h3 class="section-title u-mb-0">{{ t('selfServiceQuotaTab.sectionUsage') }}</h3>
          <div v-if="usageLoadedAt" class="refresh-meta">
            {{ t('selfServiceQuotaTab.lastUpdated', { time: usageLoadedAt }) }}
          </div>
        </div>
        <span class="u-flex-1" />
        <el-button
          :icon="Refresh"
          :loading="loadingUsage || refreshUsageAction.loading.value"
          :disabled="loadingUsage || refreshUsageAction.loading.value"
          @click="refreshUsageAction.run(refreshUsage)"
        >
          {{ t('selfServiceQuotaTab.btnRefresh') }}
        </el-button>
      </div>
      <JsonPreview v-if="hasUsageData" :data="usage" />
      <EmptyState v-else :description="t('selfServiceQuotaTab.emptyUsage')" :image-size="72" />
    </div>

    <!-- admin / operator 角色才看得到「去配额策略」入口,tenant 用户看不到避免误导 -->
    <div v-if="canManagePolicy" class="quota-admin-hint">
      <span class="quota-admin-hint__text">{{ t('selfServiceQuotaTab.adminHint') }}</span>
      <el-button type="primary" plain size="small" :icon="TopRight" @click="goPolicy">
        {{ t('selfServiceQuotaTab.adminLink') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { useRouter } from 'vue-router'
  import { RefreshCw as Refresh, ArrowUpRight as TopRight } from 'lucide-vue-next'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const refreshQuotaAction = useRefreshAction()
  const refreshUsageAction = useRefreshAction()
  import { useAuthStore } from '@/stores/auth'
  import { getTenantQuota, getTenantUsage } from '@/api/tenantSelfService'

  const { t } = useI18n({ useScope: 'global' })
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import EmptyState from '@/components/common/EmptyState.vue'

  const tenant = useTenantStore()
  const auth = useAuthStore()
  const router = useRouter()

  // 仅 admin / operator 看得到「去配额策略」入口;tenant 用户不应被引到 CRUD 页
  const canManagePolicy = computed(() => auth.canAccess('OPERATOR'))

  function goPolicy() {
    void router.push({ path: '/governance/quota' })
  }

  const loadingQuota = ref(false)
  const loadingUsage = ref(false)
  const quota = ref<unknown>(null)
  const usage = ref<unknown>(null)
  const quotaLoadedAt = ref('')
  const usageLoadedAt = ref('')

  const hasQuotaData = computed(() => !isEmptyPayload(quota.value))
  const hasUsageData = computed(() => !isEmptyPayload(usage.value))

  function formatNow() {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date())
  }

  function isEmptyPayload(payload: unknown) {
    if (payload == null) return true
    if (Array.isArray(payload)) return payload.length === 0
    if (typeof payload !== 'object') return false
    const obj = payload as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items.length === 0
    return Object.keys(obj).length === 0
  }

  async function loadQuota(showToast = false) {
    loadingQuota.value = true
    try {
      quota.value = await getTenantQuota(tenant.tenantId)
      quotaLoadedAt.value = formatNow()
      if (showToast) ElMessage.success(t('selfServiceQuotaTab.refreshSuccess'))
    } catch {
      quota.value = null
      if (showToast) ElMessage.error(t('selfServiceQuotaTab.refreshFailed'))
    } finally {
      loadingQuota.value = false
    }
  }

  async function loadUsage(showToast = false) {
    loadingUsage.value = true
    try {
      usage.value = await getTenantUsage(tenant.tenantId)
      usageLoadedAt.value = formatNow()
      if (showToast) ElMessage.success(t('selfServiceQuotaTab.refreshSuccess'))
    } catch {
      usage.value = null
      if (showToast) ElMessage.error(t('selfServiceQuotaTab.refreshFailed'))
    } finally {
      loadingUsage.value = false
    }
  }

  function refreshQuota() {
    void loadQuota(true)
  }

  function refreshUsage() {
    void loadUsage(true)
  }

  useTenantReload(() => {
    void loadQuota()
    void loadUsage()
  })
</script>

<style scoped>
  .quota-summary {
    margin-top: var(--page-block-gap);
  }

  .quota-data-panel {
    min-height: 150px;
  }

  .quota-admin-hint {
    margin-top: var(--page-block-gap);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-card) 95%);
    border: 1px dashed color-mix(in srgb, var(--color-primary) 32%, var(--color-border) 68%);
    border-radius: var(--radius-content);
  }

  .quota-admin-hint__text {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .refresh-meta {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-text-tertiary);
  }
</style>
