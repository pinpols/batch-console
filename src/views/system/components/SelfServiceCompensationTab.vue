<template>
  <div class="form-panel">
    <el-form
      ref="compFormRef"
      :model="compForm"
      :rules="compFormRules"
      label-width="100px"
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
      </el-form-item>
      <el-form-item :label="t('selfServiceCommon.bizDateLabel')" prop="bizDate">
        <el-date-picker
          v-model="compForm.bizDate"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="t('selfServiceCommon.bizDatePlaceholder')"
          class="query-w-full"
        />
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
      </el-form-item>
      <el-form-item :label="t('selfServiceCommon.targetInstanceLabel')">
        <el-input
          v-model="compForm.targetInstanceNo"
          :placeholder="t('selfServiceCommon.targetInstanceOptional')"
        />
      </el-form-item>
      <el-form-item :label="t('selfServiceCommon.reasonLabel')">
        <el-input
          v-model="compForm.reason"
          type="textarea"
          :rows="3"
          :placeholder="t('selfServiceCompensationTab.reasonPlaceholder')"
        />
      </el-form-item>
      <el-form-item class="form-actions">
        <el-button
          type="primary"
          class="pretty-primary-button"
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
