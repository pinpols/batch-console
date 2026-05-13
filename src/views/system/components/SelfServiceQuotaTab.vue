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
        <el-button :loading="loadingQuota" :disabled="loadingQuota" @click="refreshQuota">
          {{ t('selfServiceQuotaTab.btnRefresh') }}
        </el-button>
      </div>
      <JsonPreview v-if="hasQuotaData" :data="quota" />
      <el-empty v-else :description="t('selfServiceQuotaTab.emptyQuota')" :image-size="72" />
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
        <el-button :loading="loadingUsage" :disabled="loadingUsage" @click="refreshUsage">
          {{ t('selfServiceQuotaTab.btnRefresh') }}
        </el-button>
      </div>
      <JsonPreview v-if="hasUsageData" :data="usage" />
      <el-empty v-else :description="t('selfServiceQuotaTab.emptyUsage')" :image-size="72" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { getTenantQuota, getTenantUsage } from '@/api/tenantSelfService'

  const { t } = useI18n({ useScope: 'global' })
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import JsonPreview from '@/components/common/JsonPreview.vue'

  const tenant = useTenantStore()
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

  .refresh-meta {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-text-tertiary);
  }
</style>
