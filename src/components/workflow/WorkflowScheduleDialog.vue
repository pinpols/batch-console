<template>
  <el-dialog
    v-model="visible"
    :title="t('workflowDefinitionList.scheduleTitle')"
    width="min(560px, calc(100% - 32px))"
    :close-on-click-modal="false"
  >
    <el-form v-loading="loading" label-position="top" @submit.prevent>
      <el-form-item :label="t('workflowDefinitionList.scheduleType')" required>
        <el-select v-model="form.scheduleType" class="w-full" @change="onScheduleTypeChange">
          <el-option :label="t('workflowDefinitionList.scheduleManual')" value="MANUAL" />
          <el-option :label="t('workflowDefinitionList.scheduleCron')" value="CRON" />
          <el-option :label="t('workflowDefinitionList.scheduleFixedRate')" value="FIXED_RATE" />
          <el-option :label="t('workflowDefinitionList.scheduleEvent')" value="EVENT" />
        </el-select>
      </el-form-item>
      <el-form-item
        v-if="needsExpression"
        :label="t('workflowDefinitionList.scheduleExpression')"
        required
      >
        <el-input v-model="form.scheduleExpr" maxlength="256" :placeholder="exprPlaceholder" />
      </el-form-item>
      <el-form-item :label="t('workflowDefinitionList.scheduleTimezone')">
        <el-input v-model="form.timezone" maxlength="64" placeholder="UTC" />
      </el-form-item>
      <el-form-item :label="t('workflowDefinitionList.scheduleTriggerMode')">
        <el-select v-model="form.triggerMode" class="w-full">
          <el-option
            v-for="mode in triggerModeOptions"
            :key="mode"
            :label="t(`enum.triggerMode.${mode}`, mode)"
            :value="mode"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('workflowDefinitionList.scheduleCalendar')">
        <el-input v-model="form.calendarCode" maxlength="128" clearable />
      </el-form-item>
      <el-form-item :label="t('workflowDefinitionList.scheduleDependency')">
        <el-select
          v-model="form.dependsOnJobCode"
          class="w-full"
          filterable
          allow-create
          clearable
          :loading="loading"
        >
          <el-option
            v-for="jobCode in dependencyOptions"
            :key="jobCode"
            :label="jobCode"
            :value="jobCode"
          />
        </el-select>
      </el-form-item>
      <el-alert
        :title="t('workflowDefinitionList.scheduleVersionHint', { version: form.expectedVersion })"
        type="info"
        :closable="false"
      />
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!canEdit || loading || expressionMissing"
        @click="save"
      >
        {{ t('common.save') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { workflowApi, type WorkflowScheduleUpdateRequest } from '@/api/workflow'
  import { useJobCodeOptions } from '@/composables/useJobCodeOptions'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import { validateWorkflowScheduleLengths } from '@/utils/workflowScheduleValidation'

  /**
   * 工作流调度设置：从列表行内迁到设计器后的唯一编辑入口。
   * 打开时按工作流 ID 读取最新调度与版本号，保存走 PUT /schedule 的乐观锁；
   * 保存成功把新版本号交给调用方，设计器据此更新本地版本，避免随后保存结构时版本冲突。
   */
  const props = defineProps<{
    modelValue: boolean
    workflowId?: number | null
    tenantId: string
    canEdit: boolean
  }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [version: number] }>()
  const { t } = useI18n({ useScope: 'global' })
  const { load: loadJobCodes } = useJobCodeOptions()

  const visible = computed({
    get: () => props.modelValue,
    set: (value: boolean) => emit('update:modelValue', value),
  })
  const loading = ref(false)
  const saving = ref(false)
  const dependencyOptions = ref<string[]>([])
  let generation = 0
  const form = reactive({
    expectedVersion: 1,
    scheduleType: 'MANUAL' as WorkflowScheduleUpdateRequest['scheduleType'],
    scheduleExpr: '',
    timezone: 'UTC',
    triggerMode: 'MANUAL' as WorkflowScheduleUpdateRequest['triggerMode'],
    calendarCode: '',
    dependsOnJobCode: '',
  })

  const needsExpression = computed(() => ['CRON', 'FIXED_RATE'].includes(form.scheduleType))
  const expressionMissing = computed(() => needsExpression.value && !form.scheduleExpr.trim())
  const exprPlaceholder = computed(() =>
    form.scheduleType === 'CRON'
      ? t('workflowDefinitionList.scheduleCronPlaceholder')
      : t('workflowDefinitionList.scheduleRatePlaceholder'),
  )
  const triggerModeOptions = computed(() => {
    if (needsExpression.value) return ['SCHEDULED', 'MIXED']
    if (form.scheduleType === 'EVENT') return ['EVENT', 'MIXED']
    return ['MANUAL', 'API', 'MIXED']
  })

  function onScheduleTypeChange(type: string) {
    if (type === 'CRON' || type === 'FIXED_RATE') form.triggerMode = 'SCHEDULED'
    else if (type === 'EVENT') form.triggerMode = 'EVENT'
    else form.triggerMode = 'MANUAL'
  }

  async function load() {
    const id = props.workflowId
    if (!id) return
    const request = ++generation
    loading.value = true
    try {
      const [detail, jobCodes] = await Promise.all([
        workflowApi.detailById(id, props.tenantId),
        loadJobCodes(props.tenantId),
      ])
      if (request !== generation) return
      Object.assign(form, {
        expectedVersion: detail.version,
        scheduleType: detail.scheduleType ?? 'MANUAL',
        scheduleExpr: detail.scheduleExpr ?? '',
        timezone: detail.timezone ?? 'UTC',
        triggerMode: detail.triggerMode ?? 'MANUAL',
        calendarCode: detail.calendarCode ?? '',
        dependsOnJobCode: detail.dependsOnJobCode ?? '',
      })
      // 依赖已停用或从选项中移除时，仍保留历史配置值供用户查看。
      const configured = detail.dependsOnJobCode
      dependencyOptions.value = configured
        ? Array.from(new Set([...jobCodes, configured]))
        : jobCodes
    } catch (err: unknown) {
      if (request !== generation) return
      ElMessage.error(userErrorMessage(err))
      visible.value = false
    } finally {
      if (request === generation) loading.value = false
    }
  }

  watch(
    () => props.modelValue,
    (open) => {
      if (open) void load()
      else generation++
    },
    { immediate: true },
  )

  async function save() {
    const id = props.workflowId
    if (!id || saving.value || !props.canEdit) return
    const lengthError = validateWorkflowScheduleLengths(form)
    if (lengthError) {
      const labelKeys = {
        scheduleExpr: 'workflowDefinitionList.scheduleExpression',
        timezone: 'workflowDefinitionList.scheduleTimezone',
        calendarCode: 'workflowDefinitionList.scheduleCalendar',
        dependsOnJobCode: 'workflowDefinitionList.scheduleDependency',
      } as const
      ElMessage.warning(
        t('workflowDefinitionList.scheduleFieldTooLong', {
          field: t(labelKeys[lengthError.field]),
          max: lengthError.max,
        }),
      )
      return
    }
    saving.value = true
    try {
      const updated = await workflowApi.updateSchedule(id, {
        tenantId: props.tenantId,
        expectedVersion: form.expectedVersion,
        scheduleType: form.scheduleType,
        scheduleExpr: form.scheduleType === 'MANUAL' ? null : form.scheduleExpr,
        timezone: form.timezone || null,
        triggerMode: form.triggerMode,
        calendarCode: form.calendarCode || null,
        dependsOnJobCode: form.dependsOnJobCode || null,
      })
      visible.value = false
      ElMessage.success(t('workflowDefinitionList.scheduleSaved'))
      emit('saved', updated.version)
    } catch (err: unknown) {
      ElMessage.error(userErrorMessage(err))
    } finally {
      saving.value = false
    }
  }
</script>
