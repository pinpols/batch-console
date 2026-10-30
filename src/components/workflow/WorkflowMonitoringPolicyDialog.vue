<template>
  <el-dialog
    v-model="visible"
    :title="t('workflowDefinitionList.monitoring.title', { code: workflowCode })"
    width="640px"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    :show-close="!saving"
  >
    <el-alert :title="t('workflowDefinitionList.monitoring.hint')" type="info" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-form v-loading="loading" label-position="top" :disabled="loading || saving || !canEdit">
      <el-form-item :label="t('workflowDefinitionList.monitoring.startGrace')">
        <el-input-number
          v-model="form.startGraceSeconds"
          :min="0"
          :precision="0"
          :max="maxSeconds"
        />
        <el-select
          v-model="form.startGraceSeverity"
          :aria-label="t('workflowDefinitionList.monitoring.startSeverity')"
        >
          <el-option
            v-for="severity in severities"
            :key="severity"
            :value="severity"
            :label="t(`workflowDefinitionList.monitoring.severity.${severity}`)"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('workflowDefinitionList.monitoring.runtime')">
        <el-input-number
          v-model="form.softRuntimeSeconds"
          :min="0"
          :precision="0"
          :max="maxSeconds"
        />
        <el-select
          v-model="form.softRuntimeSeverity"
          :aria-label="t('workflowDefinitionList.monitoring.runtimeSeverity')"
        >
          <el-option
            v-for="severity in severities"
            :key="severity"
            :value="severity"
            :label="t(`workflowDefinitionList.monitoring.severity.${severity}`)"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('workflowDefinitionList.monitoring.completion')">
        <el-time-picker
          v-model="form.completionDeadlineLocalTime"
          value-format="HH:mm:ss"
          clearable
          :placeholder="t('workflowDefinitionList.monitoring.disabledClock')"
        />
        <el-select
          v-model="form.completionDeadlineDayOffset"
          :aria-label="t('workflowDefinitionList.monitoring.dayOffset')"
        >
          <el-option :value="0" :label="t('workflowDefinitionList.monitoring.sameDay')" />
          <el-option :value="1" :label="t('workflowDefinitionList.monitoring.nextDay')" />
        </el-select>
        <el-select
          v-model="form.completionDeadlineSeverity"
          :aria-label="t('workflowDefinitionList.monitoring.completionSeverity')"
        >
          <el-option
            v-for="severity in severities"
            :key="severity"
            :value="severity"
            :label="t(`workflowDefinitionList.monitoring.severity.${severity}`)"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <el-alert
      v-if="!valid"
      :title="t('workflowDefinitionList.monitoring.invalid')"
      type="warning"
      :closable="false"
    />
    <template #footer>
      <el-button :disabled="saving" @click="visible = false">{{ t('common.close') }}</el-button>
      <el-button v-if="error" :disabled="loading || saving" @click="loadPolicy">{{
        t('common.retry')
      }}</el-button>
      <el-button
        v-if="canEdit"
        type="primary"
        :loading="saving"
        :disabled="!canSave"
        @click="savePolicy"
      >
        {{ t('common.save') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import {
    workflowApi,
    type WorkflowMonitoringPolicyRequest,
    type WorkflowMonitoringPolicyResponse,
  } from '@/api/workflow'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { userErrorMessage } from '@/utils/userErrorMessage'

  const props = defineProps<{
    modelValue: boolean
    workflowId?: number
    workflowCode: string
    canEdit: boolean
  }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>()
  const { t } = useI18n()
  const tenant = useTenantStore()
  const maxSeconds = 2_147_483_647
  const severities = ['WARN', 'ERROR', 'CRITICAL'] as const
  const visible = computed({
    get: () => props.modelValue,
    set: (value: boolean) => emit('update:modelValue', value),
  })
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const loadedScope = ref('')
  let generation = 0

  function disabledForm() {
    return {
      softRuntimeSeconds: 0,
      softRuntimeSeverity: 'WARN' as const,
      startGraceSeconds: 0,
      startGraceSeverity: 'WARN' as const,
      completionDeadlineLocalTime: null as string | null,
      completionDeadlineDayOffset: 0,
      completionDeadlineSeverity: 'WARN' as const,
    }
  }

  const form = reactive<Omit<Required<WorkflowMonitoringPolicyRequest>, 'tenantId'>>(disabledForm())
  const valid = computed(() => {
    const seconds = [form.startGraceSeconds, form.softRuntimeSeconds]
    return (
      seconds.every((value) => Number.isInteger(value) && value >= 0 && value <= maxSeconds) &&
      [0, 1].includes(form.completionDeadlineDayOffset) &&
      (!form.completionDeadlineLocalTime ||
        /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(form.completionDeadlineLocalTime))
    )
  })

  function currentScope() {
    return `${tenant.tenantId}:${props.workflowId ?? ''}`
  }

  const canSave = computed(
    () =>
      props.canEdit &&
      visible.value &&
      valid.value &&
      !loading.value &&
      !saving.value &&
      loadedScope.value === currentScope(),
  )

  function applyPolicy(policy: WorkflowMonitoringPolicyResponse) {
    Object.assign(form, {
      softRuntimeSeconds: policy.softRuntimeSeconds ?? 0,
      softRuntimeSeverity: policy.softRuntimeSeverity ?? 'WARN',
      startGraceSeconds: policy.startGraceSeconds ?? 0,
      startGraceSeverity: policy.startGraceSeverity ?? 'WARN',
      completionDeadlineLocalTime: policy.completionDeadlineLocalTime ?? null,
      completionDeadlineDayOffset: policy.completionDeadlineDayOffset ?? 0,
      completionDeadlineSeverity: policy.completionDeadlineSeverity ?? 'WARN',
    })
  }

  function matchesTarget(
    policy: WorkflowMonitoringPolicyResponse,
    definitionId: number,
    tenantId: string,
  ) {
    return policy.tenantId === tenantId && policy.workflowDefinitionId === definitionId
  }

  async function loadPolicy() {
    const requestGeneration = ++generation
    const definitionId = props.workflowId
    const tenantId = tenant.tenantId
    loadedScope.value = ''
    error.value = ''
    Object.assign(form, disabledForm())
    if (!visible.value || !definitionId || !tenantId) {
      loading.value = false
      return
    }
    const scope = currentScope()
    loading.value = true
    try {
      const policy = await workflowApi.getMonitoringPolicy(definitionId, tenantId)
      // 切换租户、目标或关闭弹窗后，旧响应不能覆盖新表单。
      if (requestGeneration !== generation || scope !== currentScope() || !visible.value) return
      if (!matchesTarget(policy, definitionId, tenantId)) {
        error.value = t('workflowDefinitionList.monitoring.identityMismatch')
        return
      }
      applyPolicy(policy)
      loadedScope.value = scope
    } catch (failure) {
      if (requestGeneration === generation) error.value = userErrorMessage(failure)
    } finally {
      if (requestGeneration === generation) loading.value = false
    }
  }

  async function savePolicy() {
    if (!canSave.value || !props.workflowId) return
    const scope = currentScope()
    const requestGeneration = generation
    const definitionId = props.workflowId
    const tenantId = tenant.tenantId
    const request: WorkflowMonitoringPolicyRequest = { tenantId, ...form }
    saving.value = true
    error.value = ''
    try {
      const policy = await workflowApi.saveMonitoringPolicy(definitionId, request)
      if (requestGeneration !== generation || scope !== currentScope() || !visible.value) return
      if (!matchesTarget(policy, definitionId, tenantId)) {
        loadedScope.value = ''
        error.value = t('workflowDefinitionList.monitoring.identityMismatch')
        return
      }
      applyPolicy(policy)
      ElMessage.success(t('workflowDefinitionList.monitoring.saved'))
      emit('saved')
    } catch (failure) {
      if (requestGeneration === generation) error.value = userErrorMessage(failure)
    } finally {
      saving.value = false
    }
  }

  useTenantReload(loadPolicy)
  watch([visible, () => props.workflowId], loadPolicy)
  onBeforeUnmount(() => {
    generation++
  })
</script>
