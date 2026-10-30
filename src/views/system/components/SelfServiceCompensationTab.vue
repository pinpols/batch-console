<template>
  <div class="form-panel">
    <el-form
      ref="compFormRef"
      :model="compForm"
      :rules="compFormRules"
      label-width="88px"
      class="form-section"
      @submit.prevent="submitCompensation"
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
      <el-form-item :label="t('selfServiceCompensationTab.typeLabel')" prop="compensationType">
        <el-select
          v-model="compForm.compensationType"
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
      <el-form-item :label="t('selfServiceCommon.targetInstanceLabel')" prop="targetInstanceNo">
        <el-select
          v-model="compForm.targetInstanceNo"
          filterable
          remote
          reserve-keyword
          :placeholder="t('selfServiceCommon.targetInstanceDisabledHint')"
          :disabled="!compForm.jobCode || !compForm.bizDate"
          :remote-method="queryInstances"
          :loading="instanceLoading"
          @focus="loadInstances()"
          class="query-w-full"
        >
          <el-option
            v-for="opt in instanceOptions"
            :key="opt.instanceNo"
            :label="opt.instanceNo"
            :value="opt.instanceNo"
          >
            <span>{{ opt.instanceNo }}</span>
            <el-tag size="small" effect="plain" class="u-ml-8">{{ opt.status }}</el-tag>
          </el-option>
        </el-select>
        <div class="field-hint">{{ t('selfServiceCompensationTab.targetInstanceHint') }}</div>
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
        <el-button native-type="button" :disabled="compLoading" @click="resetCompForm">
          {{ t('common.reset') }}
        </el-button>
        <el-button
          type="primary"
          native-type="submit"
          :loading="compLoading"
          v-track-click="t('selfServiceCompensationTab.trackSubmit')"
        >
          {{ t('selfServiceCompensationTab.btnSubmit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, toRefs, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { selfServiceCompensationRequest } from '@/api/selfServiceJobs'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useJobCodeSearch } from '@/composables/useJobCodeSearch'
  import { useInstanceNoSearch } from '@/composables/useInstanceNoSearch'
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
  ])

  const { jobCodeLoading, jobCodeOptions, loadDefaultJobCodes, queryJobCodes, clearOptions } =
    useJobCodeSearch()
  const {
    jobCode: jobCodeRef,
    bizDate: bizDateRef,
    targetInstanceNo: targetInstanceNoRef,
  } = toRefs(compForm)
  const {
    instanceLoading,
    instanceOptions,
    loadInstances,
    queryInstances,
    clearOptions: clearInstanceOptions,
  } = useInstanceNoSearch(jobCodeRef, bizDateRef, targetInstanceNoRef)

  const { formRef: compFormRef, validate: validateCompForm } = useFormValidate()
  const compFormRules: FormRules = {
    jobCode: [rules.required(t('selfServiceCommon.ruleJobCode'), 'change')],
    bizDate: [rules.required(t('selfServiceCommon.ruleBizDate'), 'change')],
    compensationType: [rules.required(t('selfServiceCommon.ruleCompensationType'), 'change')],
    targetInstanceNo: [rules.required(t('selfServiceCommon.ruleTargetInstance'), 'change')],
  }

  function resetCompForm() {
    compForm.jobCode = ''
    compForm.bizDate = ''
    compForm.compensationType = ''
    compForm.targetInstanceNo = ''
    compForm.reason = ''
    compFormRef.value?.clearValidate()
    clearInstanceOptions()
  }

  const submitScope = useTenantRequestScope()
  async function submitCompensation() {
    if (compLoading.value || !tenant.tenantId) return
    const request = submitScope.begin()
    if (!(await validateCompForm()) || !submitScope.isCurrent(request)) return
    compLoading.value = true
    try {
      await selfServiceCompensationRequest({
        tenantId: request.tenantId,
        jobCode: compForm.jobCode,
        bizDate: compForm.bizDate,
        compensationType: 'JOB',
        targetInstanceNo: compForm.targetInstanceNo,
        ...(compForm.reason ? { reason: compForm.reason } : {}),
      })
      if (!submitScope.isCurrent(request)) return
      ElMessage.success(t('selfServiceCompensationTab.submittedToast'))
      compForm.jobCode = ''
      compForm.bizDate = ''
      compForm.compensationType = ''
      compForm.targetInstanceNo = ''
      compForm.reason = ''
    } finally {
      if (submitScope.isCurrent(request)) compLoading.value = false
    }
  }

  watch(
    () => tenant.tenantId,
    () => {
      resetCompForm()
      compLoading.value = false
    },
    { flush: 'sync' },
  )
  useTenantReload(clearOptions)
  useTenantReload(clearInstanceOptions)
</script>

<style scoped></style>
