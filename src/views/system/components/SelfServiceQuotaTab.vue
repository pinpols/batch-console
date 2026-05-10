<template>
  <div>
    <div class="data-panel">
      <div class="section-toolbar">
        <h3 class="section-title u-mb-0">当前配额</h3>
        <span class="u-flex-1" />
        <el-button :loading="loadingQuota" @click="loadQuota">刷新</el-button>
      </div>
      <JsonPreview v-if="quota" :data="quota" />
      <el-empty v-else description="暂无配额数据" />
    </div>

    <div class="data-panel">
      <div class="section-toolbar">
        <h3 class="section-title u-mb-0">当前用量</h3>
        <span class="u-flex-1" />
        <el-button :loading="loadingUsage" @click="loadUsage">刷新</el-button>
      </div>
      <JsonPreview v-if="usage" :data="usage" />
      <el-empty v-else description="暂无用量数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { getTenantQuota, getTenantUsage } from '@/api/tenantSelfService'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import JsonPreview from '@/components/common/JsonPreview.vue'

  const tenant = useTenantStore()
  const loadingQuota = ref(false)
  const loadingUsage = ref(false)
  const quota = ref<unknown>(null)
  const usage = ref<unknown>(null)

  async function loadQuota() {
    loadingQuota.value = true
    try {
      quota.value = await getTenantQuota(tenant.tenantId)
    } catch {
      quota.value = null
    } finally {
      loadingQuota.value = false
    }
  }

  async function loadUsage() {
    loadingUsage.value = true
    try {
      usage.value = await getTenantUsage(tenant.tenantId)
    } catch {
      usage.value = null
    } finally {
      loadingUsage.value = false
    }
  }

  useTenantReload(() => {
    void loadQuota()
    void loadUsage()
  })
</script>
