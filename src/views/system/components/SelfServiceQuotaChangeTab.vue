<template>
  <div class="form-panel">
    <el-form label-width="100px" class="form-section">
      <el-form-item label="配额键">
        <el-select
          v-model="quotaForm.quotaKey"
          filterable
          placeholder="请选择配额键"
          class="query-w-full"
          :loading="quotaKeysLoading"
        >
          <el-option v-for="k in quotaKeys" :key="k" :label="k" :value="k" />
        </el-select>
      </el-form-item>
      <el-form-item label="期望值">
        <el-input v-model="quotaForm.requestedValue" placeholder="请输入期望值" />
      </el-form-item>
      <el-form-item label="原因">
        <el-input v-model="quotaForm.reason" type="textarea" :rows="3" placeholder="变更原因" />
      </el-form-item>
      <el-form-item class="form-actions">
        <el-button
          type="primary"
          class="pretty-primary-button"
          :loading="submittingQuota"
          v-track-click="'配额变更申请'"
          @click="submitQuotaChange"
          >提交配额变更</el-button
        >
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { ElMessage } from 'element-plus'
  import { getTenantQuota, requestQuotaChange } from '@/api/tenantSelfService'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'

  const tenant = useTenantStore()
  const submittingQuota = ref(false)
  const quotaForm = reactive({ quotaKey: '', requestedValue: '', reason: '' })
  const quotaKeysLoading = ref(false)
  const quotaKeys = ref<string[]>([])

  function extractQuotaKeys(payload: unknown): string[] {
    const items = (payload as { items?: unknown })?.items
    if (!Array.isArray(items)) return []
    const keys = items
      .map((it) => {
        if (!it || typeof it !== 'object') return ''
        const anyIt = it as Record<string, unknown>
        return String((anyIt.policyCode ?? anyIt.field ?? anyIt.quotaKey ?? '') || '').trim()
      })
      .filter(Boolean)
    return Array.from(new Set(keys))
  }

  async function loadQuotaKeys() {
    if (quotaKeysLoading.value) return
    quotaKeysLoading.value = true
    try {
      const q = await getTenantQuota(tenant.tenantId)
      quotaKeys.value = extractQuotaKeys(q)
    } catch {
      quotaKeys.value = []
    } finally {
      quotaKeysLoading.value = false
    }
  }

  async function submitQuotaChange() {
    if (!quotaForm.quotaKey.trim()) {
      ElMessage.warning('配额键不能为空')
      return
    }
    const requestedValue = Number.parseInt(quotaForm.requestedValue.trim(), 10)
    if (!Number.isFinite(requestedValue) || requestedValue <= 0) {
      ElMessage.warning('期望值需为正整数')
      return
    }
    if (!quotaForm.reason.trim()) {
      ElMessage.warning('原因不能为空')
      return
    }
    submittingQuota.value = true
    try {
      await requestQuotaChange(tenant.tenantId, {
        field: quotaForm.quotaKey,
        requestedValue,
        reason: quotaForm.reason,
      })
      ElMessage.success('申请已提交')
      quotaForm.quotaKey = ''
      quotaForm.requestedValue = ''
      quotaForm.reason = ''
    } finally {
      submittingQuota.value = false
    }
  }

  useTenantReload(() => {
    quotaKeys.value = []
    void loadQuotaKeys()
  })
</script>
