<template>
  <div class="form-panel">
    <el-form
      ref="quotaFormRef"
      :model="quotaForm"
      :rules="quotaFormRules"
      label-width="88px"
      class="form-section"
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
        <el-button :icon="RefreshLeft" :disabled="submittingQuota" @click="resetQuotaForm">
          {{ t('common.reset') }}
        </el-button>
        <el-button
          type="primary"
          class="pretty-primary-button"
          :icon="Promotion"
          :loading="submittingQuota"
          v-track-click="t('selfServiceQuotaChangeTab.trackSubmit')"
          @click="submitQuotaChange"
        >
          {{ t('selfServiceQuotaChangeTab.btnSubmit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Promotion, RefreshLeft } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { getTenantQuota, requestQuotaChange } from '@/api/tenantSelfService'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
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
          const n = Number.parseInt(String(v).trim(), 10)
          if (Number.isFinite(n) && n > 0) cb()
          else cb(new Error(t('selfServiceQuotaChangeTab.ruleValuePositive')))
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

  function resetQuotaForm() {
    quotaForm.quotaKey = ''
    quotaForm.requestedValue = ''
    quotaForm.reason = ''
    quotaFormRef.value?.clearValidate()
  }

  async function submitQuotaChange() {
    if (!(await validateQuotaForm())) return
    const requestedValue = Number.parseInt(quotaForm.requestedValue.trim(), 10)
    submittingQuota.value = true
    try {
      await requestQuotaChange(tenant.tenantId, {
        field: quotaForm.quotaKey,
        requestedValue,
        reason: quotaForm.reason,
      })
      ElMessage.success(t('selfServiceQuotaChangeTab.submittedToast'))
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

<style scoped></style>
