<template>
  <div class="form-panel">
    <el-form
      ref="rerunFormRef"
      :model="rerunForm"
      :rules="rerunFormRules"
      label-width="100px"
      class="form-section"
    >
      <el-form-item :label="t('selfServiceCommon.jobCodeLabel')" prop="jobCode">
        <el-select
          v-model="rerunForm.jobCode"
          filterable
          remote
          reserve-keyword
          :placeholder="t('selfServiceCommon.jobCodePlaceholder')"
          :remote-method="queryJobCodes"
          :loading="jobCodeLoading"
          @focus="loadDefaultJobCodes"
          class="query-w-full"
        >
          <el-option v-for="opt in jobCodeOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
        <div class="field-hint">{{ t('selfServiceCommon.jobCodeHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('selfServiceCommon.bizDateLabel')" prop="bizDate">
        <el-date-picker
          v-model="rerunForm.bizDate"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="t('selfServiceCommon.bizDatePlaceholder')"
          class="query-w-full"
        />
        <div class="field-hint">{{ t('selfServiceCommon.bizDateHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('selfServiceCommon.targetInstanceLabel')">
        <el-input
          v-model="rerunForm.targetInstanceNo"
          :placeholder="t('selfServiceCommon.targetInstanceOptional')"
        />
        <div class="field-hint">{{ t('selfServiceCommon.targetInstanceHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('selfServiceCommon.reasonLabel')">
        <el-input
          v-model="rerunForm.reason"
          type="textarea"
          :rows="3"
          :placeholder="t('selfServiceRerunTab.reasonPlaceholder')"
        />
        <div class="field-hint">{{ t('selfServiceRerunTab.reasonHint') }}</div>
      </el-form-item>
      <el-form-item class="form-actions">
        <el-button
          type="primary"
          class="pretty-primary-button"
          :loading="rerunLoading"
          v-track-click="t('selfServiceRerunTab.trackSubmit')"
          @click="submitRerun"
        >
          {{ t('selfServiceRerunTab.btnSubmit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { selfServiceRerunRequest } from '@/api/selfServiceJobs'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useJobCodeSearch } from '@/composables/useJobCodeSearch'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const tenant = useTenantStore()
  const rerunLoading = ref(false)
  const rerunForm = reactive({ jobCode: '', bizDate: '', targetInstanceNo: '', reason: '' })

  const { jobCodeLoading, jobCodeOptions, loadDefaultJobCodes, queryJobCodes, clearOptions } =
    useJobCodeSearch()

  const { formRef: rerunFormRef, validate: validateRerunForm } = useFormValidate()
  const rerunFormRules: FormRules = {
    jobCode: [rules.required(t('selfServiceCommon.ruleJobCode'), 'change')],
    bizDate: [rules.required(t('selfServiceCommon.ruleBizDate'), 'change')],
  }

  async function submitRerun() {
    if (!(await validateRerunForm())) return
    rerunLoading.value = true
    try {
      await selfServiceRerunRequest({
        tenantId: tenant.tenantId,
        jobCode: rerunForm.jobCode,
        bizDate: rerunForm.bizDate,
        ...(rerunForm.targetInstanceNo ? { targetInstanceNo: rerunForm.targetInstanceNo } : {}),
        ...(rerunForm.reason ? { reason: rerunForm.reason } : {}),
      })
      ElMessage.success(t('selfServiceRerunTab.submittedToast'))
      rerunForm.jobCode = ''
      rerunForm.bizDate = ''
      rerunForm.targetInstanceNo = ''
      rerunForm.reason = ''
    } finally {
      rerunLoading.value = false
    }
  }

  useTenantReload(clearOptions)
</script>

<style scoped>
  .field-hint {
    width: 100%;
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--color-text-tertiary);
  }
</style>
