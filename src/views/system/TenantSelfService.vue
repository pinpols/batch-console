<template>
  <PageContainer>
    <PageHeader title="租户自助服务" description="查看租户配额与用量，申请配额变更。" />

    <SectionCard>
      <div class="section-toolbar">
        <h3 class="section-title u-mb-0 u-flex-1">当前配额</h3>
        <el-button :loading="loadingQuota" @click="loadQuota">刷新</el-button>
      </div>
      <pre v-if="quota" class="json-preview">{{ JSON.stringify(quota, null, 2) }}</pre>
      <el-empty v-else description="暂无配额数据" />
    </SectionCard>

    <SectionCard>
      <div class="section-toolbar">
        <h3 class="section-title u-mb-0 u-flex-1">当前用量</h3>
        <el-button :loading="loadingUsage" @click="loadUsage">刷新</el-button>
      </div>
      <pre v-if="usage" class="json-preview">{{ JSON.stringify(usage, null, 2) }}</pre>
      <el-empty v-else description="暂无用量数据" />
    </SectionCard>

    <SectionCard>
      <h3 class="section-title">申请配额变更</h3>
      <el-form label-width="100px" class="form-section">
        <el-form-item label="配额键">
          <el-input v-model="form.quotaKey" placeholder="如 maxConcurrentJobs" />
        </el-form-item>
        <el-form-item label="期望值">
          <el-input v-model="form.requestedValue" placeholder="请输入期望值" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="变更原因" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="submitting"
            v-track-click="'配额变更申请'"
            @click="submitRequest"
            >提交申请</el-button
          >
        </el-form-item>
      </el-form>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { ElMessage } from 'element-plus'
  import { getTenantQuota, getTenantUsage, requestQuotaChange } from '@/api/tenantSelfService'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
  const loadingQuota = ref(false)
  const loadingUsage = ref(false)
  const submitting = ref(false)
  const quota = ref<unknown>(null)
  const usage = ref<unknown>(null)
  const form = reactive({ quotaKey: '', requestedValue: '', reason: '' })

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

  async function submitRequest() {
    if (!form.quotaKey.trim()) {
      ElMessage.warning('配额键不能为空')
      return
    }
    const requestedValue = Number.parseInt(form.requestedValue.trim(), 10)
    if (!Number.isFinite(requestedValue) || requestedValue <= 0) {
      ElMessage.warning('期望值需为正整数')
      return
    }
    if (!form.reason.trim()) {
      ElMessage.warning('原因不能为空')
      return
    }
    submitting.value = true
    try {
      await requestQuotaChange(tenant.tenantId, {
        field: form.quotaKey,
        requestedValue,
        reason: form.reason,
      })
      ElMessage.success('申请已提交')
      form.quotaKey = ''
      form.requestedValue = ''
      form.reason = ''
    } finally {
      submitting.value = false
    }
  }

  function loadAll() {
    void loadQuota()
    void loadUsage()
  }

  useTenantReload(loadAll)
</script>

<style scoped></style>
