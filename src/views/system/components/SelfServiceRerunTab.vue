<template>
  <div class="form-panel">
    <el-form
      ref="rerunFormRef"
      :model="rerunForm"
      :rules="rerunFormRules"
      label-width="88px"
      class="form-section"
      @submit.prevent="submitRerun"
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
        <el-select
          v-model="rerunForm.targetInstanceNo"
          filterable
          remote
          clearable
          reserve-keyword
          :placeholder="
            rerunForm.jobCode && rerunForm.bizDate
              ? t('selfServiceCommon.targetInstanceOptional')
              : t('selfServiceCommon.targetInstanceDisabledHint')
          "
          :disabled="!rerunForm.jobCode || !rerunForm.bizDate"
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
        <el-button native-type="button" :disabled="rerunLoading" @click="resetRerunForm">
          {{ t('common.reset') }}
        </el-button>
        <el-button
          type="primary"
          native-type="submit"
          :loading="rerunLoading"
          v-track-click="t('selfServiceRerunTab.trackSubmit')"
        >
          {{ t('selfServiceRerunTab.btnSubmit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, toRefs, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { selfServiceRerunRequest } from '@/api/selfServiceJobs'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useJobCodeSearch } from '@/composables/useJobCodeSearch'
  import { useInstanceNoSearch } from '@/composables/useInstanceNoSearch'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const tenant = useTenantStore()
  const rerunLoading = ref(false)
  const rerunForm = reactive({ jobCode: '', bizDate: '', targetInstanceNo: '', reason: '' })

  const { jobCodeLoading, jobCodeOptions, loadDefaultJobCodes, queryJobCodes, clearOptions } =
    useJobCodeSearch()

  const {
    jobCode: jobCodeRef,
    bizDate: bizDateRef,
    targetInstanceNo: targetInstanceNoRef,
  } = toRefs(rerunForm)
  const {
    instanceLoading,
    instanceOptions,
    loadInstances,
    queryInstances,
    clearOptions: clearInstanceOptions,
  } = useInstanceNoSearch(jobCodeRef, bizDateRef, targetInstanceNoRef)

  const { formRef: rerunFormRef, validate: validateRerunForm } = useFormValidate()
  const rerunFormRules: FormRules = {
    jobCode: [rules.required(t('selfServiceCommon.ruleJobCode'), 'change')],
    bizDate: [rules.required(t('selfServiceCommon.ruleBizDate'), 'change')],
  }

  function resetRerunForm() {
    rerunForm.jobCode = ''
    rerunForm.bizDate = ''
    rerunForm.targetInstanceNo = ''
    rerunForm.reason = ''
    rerunFormRef.value?.clearValidate()
  }

  const submitScope = useTenantRequestScope()
  async function submitRerun() {
    if (rerunLoading.value || !tenant.tenantId) return
    const request = submitScope.begin()
    if (!(await validateRerunForm()) || !submitScope.isCurrent(request)) return
    rerunLoading.value = true
    try {
      await selfServiceRerunRequest({
        tenantId: request.tenantId,
        jobCode: rerunForm.jobCode,
        bizDate: rerunForm.bizDate,
        ...(rerunForm.targetInstanceNo ? { targetInstanceNo: rerunForm.targetInstanceNo } : {}),
        ...(rerunForm.reason ? { reason: rerunForm.reason } : {}),
      })
      if (!submitScope.isCurrent(request)) return
      ElMessage.success(t('selfServiceRerunTab.submittedToast'))
      rerunForm.jobCode = ''
      rerunForm.bizDate = ''
      rerunForm.targetInstanceNo = ''
      rerunForm.reason = ''
    } finally {
      if (submitScope.isCurrent(request)) rerunLoading.value = false
    }
  }

  watch(
    () => tenant.tenantId,
    () => {
      resetRerunForm()
      rerunLoading.value = false
    },
    { flush: 'sync' },
  )
  useTenantReload(() => {
    clearOptions()
    clearInstanceOptions()
  })
</script>

<style scoped></style>
