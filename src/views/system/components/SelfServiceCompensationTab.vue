<template>
  <div class="form-panel">
    <el-form
      ref="compFormRef"
      :model="compForm"
      :rules="compFormRules"
      label-width="88px"
      class="form-section"
    >
      <el-form-item :label="t('selfServiceCommon.jobCodeLabel')" prop="jobCode">
        <el-select
          v-model="compForm.jobCode"
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
          v-model="compForm.bizDate"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="t('selfServiceCommon.bizDatePlaceholder')"
          class="query-w-full"
        />
        <div class="field-hint">{{ t('selfServiceCommon.bizDateHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('selfServiceCompensationTab.typeLabel')">
        <el-select
          v-model="compForm.compensationType"
          filterable
          allow-create
          default-first-option
          clearable
          :placeholder="t('selfServiceCompensationTab.typePlaceholder')"
          class="query-w-full"
        >
          <el-option
            v-for="opt in compensationTypeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <div class="field-hint">{{ t('selfServiceCompensationTab.typeHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('selfServiceCommon.targetInstanceLabel')">
        <el-input
          v-model="compForm.targetInstanceNo"
          :placeholder="t('selfServiceCommon.targetInstanceOptional')"
        />
        <div class="field-hint">{{ t('selfServiceCommon.targetInstanceHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('selfServiceCommon.reasonLabel')">
        <el-input
          v-model="compForm.reason"
          type="textarea"
          :rows="3"
          :placeholder="t('selfServiceCompensationTab.reasonPlaceholder')"
        />
        <div class="field-hint">{{ t('selfServiceCompensationTab.reasonHint') }}</div>
      </el-form-item>
      <el-form-item class="form-actions">
        <el-button :icon="RefreshLeft" :disabled="compLoading" @click="resetCompForm">
          {{ t('common.reset') }}
        </el-button>
        <el-button
          type="primary"
          class="pretty-primary-button"
          :icon="Promotion"
          :loading="compLoading"
          v-track-click="t('selfServiceCompensationTab.trackSubmit')"
          @click="submitCompensation"
        >
          {{ t('selfServiceCompensationTab.btnSubmit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Promotion, RefreshLeft } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { selfServiceCompensationRequest } from '@/api/selfServiceJobs'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useJobCodeSearch } from '@/composables/useJobCodeSearch'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const tenant = useTenantStore()
  const compLoading = ref(false)
  const compForm = reactive({
    jobCode: '',
    bizDate: '',
    compensationType: '',
    targetInstanceNo: '',
    reason: '',
  })

  const compensationTypeOptions = computed(() => [
    { value: 'JOB', label: t('selfServiceCompensationTab.optJob') },
    { value: 'STEP', label: t('selfServiceCompensationTab.optStep') },
    { value: 'PARTITION', label: t('selfServiceCompensationTab.optPartition') },
    { value: 'FILE', label: t('selfServiceCompensationTab.optFile') },
    { value: 'BATCH', label: t('selfServiceCompensationTab.optBatch') },
    { value: 'DLQ', label: t('selfServiceCompensationTab.optDlq') },
  ])

  const { jobCodeLoading, jobCodeOptions, loadDefaultJobCodes, queryJobCodes, clearOptions } =
    useJobCodeSearch()

  const { formRef: compFormRef, validate: validateCompForm } = useFormValidate()
  const compFormRules: FormRules = {
    jobCode: [rules.required(t('selfServiceCommon.ruleJobCode'), 'change')],
    bizDate: [rules.required(t('selfServiceCommon.ruleBizDate'), 'change')],
  }

  function resetCompForm() {
    compForm.jobCode = ''
    compForm.bizDate = ''
    compForm.compensationType = ''
    compForm.targetInstanceNo = ''
    compForm.reason = ''
    compFormRef.value?.clearValidate()
  }

  async function submitCompensation() {
    if (!(await validateCompForm())) return
    compLoading.value = true
    try {
      await selfServiceCompensationRequest({
        tenantId: tenant.tenantId,
        jobCode: compForm.jobCode,
        bizDate: compForm.bizDate,
        ...(compForm.compensationType ? { compensationType: compForm.compensationType } : {}),
        ...(compForm.targetInstanceNo ? { targetInstanceNo: compForm.targetInstanceNo } : {}),
        ...(compForm.reason ? { reason: compForm.reason } : {}),
      })
      ElMessage.success(t('selfServiceCompensationTab.submittedToast'))
      compForm.jobCode = ''
      compForm.bizDate = ''
      compForm.compensationType = ''
      compForm.targetInstanceNo = ''
      compForm.reason = ''
    } finally {
      compLoading.value = false
    }
  }

  useTenantReload(clearOptions)
</script>

<style scoped></style>
