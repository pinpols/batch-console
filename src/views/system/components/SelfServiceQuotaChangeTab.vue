<template>
  <div class="form-panel">
    <el-form
      ref="quotaFormRef"
      :model="quotaForm"
      :rules="quotaFormRules"
      label-width="88px"
      class="form-section"
      @submit.prevent="submitQuotaChange"
    >
      <el-form-item :label="t('selfServiceQuotaChangeTab.keyLabel')" prop="quotaKey">
        <el-select
          v-model="quotaForm.quotaKey"
          filterable
          :placeholder="t('selfServiceQuotaChangeTab.keyPlaceholder')"
          class="query-w-full"
          :loading="quotaKeysLoading"
        >
          <el-option v-for="k in quotaKeys" :key="k" :label="k" :value="k" />
        </el-select>
        <div class="field-hint">{{ t('selfServiceQuotaChangeTab.keyHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('selfServiceQuotaChangeTab.valueLabel')" prop="requestedValue">
        <el-input
          v-model="quotaForm.requestedValue"
          :placeholder="t('selfServiceQuotaChangeTab.valuePlaceholder')"
        />
        <div class="field-hint">{{ t('selfServiceQuotaChangeTab.valueHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('selfServiceQuotaChangeTab.reasonLabel')" prop="reason">
        <el-input
          v-model="quotaForm.reason"
          type="textarea"
          :rows="3"
          :placeholder="t('selfServiceQuotaChangeTab.reasonPlaceholder')"
        />
        <div class="field-hint">{{ t('selfServiceQuotaChangeTab.reasonHint') }}</div>
      </el-form-item>
      <el-form-item class="form-actions">
        <el-button native-type="button" :disabled="submittingQuota" @click="resetQuotaForm">
          {{ t('common.reset') }}
        </el-button>
        <el-button
          type="primary"
          native-type="submit"
          :loading="submittingQuota"
          v-track-click="t('selfServiceQuotaChangeTab.trackSubmit')"
        >
          {{ t('selfServiceQuotaChangeTab.btnSubmit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { getTenantQuota, requestQuotaChange } from '@/api/tenantSelfService'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const tenant = useTenantStore()
  const submittingQuota = ref(false)
  const quotaForm = reactive({ quotaKey: '', requestedValue: '', reason: '' })
  const quotaKeysLoading = ref(false)
  const quotaKeys = ref<string[]>([])

  const { formRef: quotaFormRef, validate: validateQuotaForm } = useFormValidate()
  const quotaFormRules: FormRules = {
    quotaKey: [rules.required(t('selfServiceQuotaChangeTab.ruleKey'), 'change')],
    requestedValue: [
      rules.required(t('selfServiceQuotaChangeTab.ruleValue')),
      {
        validator: (_r, v: string, cb) => {
          const valueText = String(v)
          const trimmedValue = valueText.trim()
          const n = Number.parseInt(trimmedValue, 10)
          if (Number.isFinite(n) && n > 0) cb()
          else {
            const errorMessage = t('selfServiceQuotaChangeTab.ruleValuePositive')
            const validationError = new Error(errorMessage)
            cb(validationError)
          }
        },
        trigger: 'blur',
      },
    ],
    reason: [rules.required(t('selfServiceQuotaChangeTab.ruleReason'))],
  }

  function extractQuotaKeys(payload: unknown): string[] {
    const items = (payload as { items?: unknown })?.items
    if (!Array.isArray(items)) return []
    const keys = items
      .map((it) => {
        if (!it || typeof it !== 'object') return ''
        const anyIt = it as Record<string, unknown>
        const rawQuotaKey = anyIt.policyCode ?? anyIt.field ?? anyIt.quotaKey ?? ''
        const quotaKeyValue = rawQuotaKey || ''
        const quotaKeyText = String(quotaKeyValue)
        const quotaKey = quotaKeyText.trim()
        return quotaKey
      })
      .filter(Boolean)
    const uniqueKeys = new Set(keys)
    return Array.from(uniqueKeys)
  }

  const loadScope = useTenantRequestScope()
  const submitScope = useTenantRequestScope()
  async function loadQuotaKeys() {
    const request = loadScope.begin()
    if (!request.tenantId) return
    quotaKeysLoading.value = true
    try {
      const q = await getTenantQuota(request.tenantId)
      if (!loadScope.isCurrent(request)) return
      quotaKeys.value = extractQuotaKeys(q)
    } catch {
      if (!loadScope.isCurrent(request)) return
      quotaKeys.value = []
    } finally {
      if (loadScope.isCurrent(request)) quotaKeysLoading.value = false
    }
  }

  function resetQuotaForm() {
    quotaForm.quotaKey = ''
    quotaForm.requestedValue = ''
    quotaForm.reason = ''
    quotaFormRef.value?.clearValidate()
  }

  async function submitQuotaChange() {
    if (submittingQuota.value || !tenant.tenantId) return
    const request = submitScope.begin()
    if (!(await validateQuotaForm()) || !submitScope.isCurrent(request)) return
    const trimmedRequestedValue = quotaForm.requestedValue.trim()
    const requestedValue = Number.parseInt(trimmedRequestedValue, 10)
    submittingQuota.value = true
    try {
      await requestQuotaChange(request.tenantId, {
        field: quotaForm.quotaKey,
        requestedValue,
        reason: quotaForm.reason,
      })
      if (!submitScope.isCurrent(request)) return
      ElMessage.success(t('selfServiceQuotaChangeTab.submittedToast'))
      quotaForm.quotaKey = ''
      quotaForm.requestedValue = ''
      quotaForm.reason = ''
    } finally {
      if (submitScope.isCurrent(request)) submittingQuota.value = false
    }
  }

  watch(
    () => tenant.tenantId,
    () => {
      resetQuotaForm()
      quotaKeys.value = []
      quotaKeysLoading.value = false
      submittingQuota.value = false
    },
    { flush: 'sync' },
  )
  useTenantReload(() => {
    quotaKeys.value = []
    void loadQuotaKeys()
  })
</script>

<style scoped></style>
