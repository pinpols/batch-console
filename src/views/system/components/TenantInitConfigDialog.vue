<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('tenantInitConfigDialog.title')"
    width="640px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-alert type="warning" :closable="false" show-icon class="mb-12">
      <template #title>
        <strong>{{ t('tenantInitConfigDialog.advancedAlertStrong') }}</strong>
        {{ t('tenantInitConfigDialog.advancedAlert') }}
      </template>
    </el-alert>
    <el-alert type="info" :closable="false" show-icon class="mb-12">
      <template #title>{{ t('tenantInitConfigDialog.descAlert') }}</template>
    </el-alert>
    <el-form ref="initFormRef" :model="form" :rules="initFormRules" label-width="100px">
      <el-form-item :label="t('tenantInitConfigDialog.fieldTarget')">
        <el-tag>{{ form.targetTenantId }}</el-tag>
      </el-form-item>
      <el-form-item :label="t('tenantConfigShared.configTypeLabel')" prop="configTypes">
        <el-checkbox-group v-model="form.configTypes">
          <el-checkbox v-for="ct in ALL_CONFIG_TYPES" :key="ct" :label="ct" :value="ct" />
        </el-checkbox-group>
        <div class="form-hint">{{ t('tenantConfigShared.configTypeHintAll') }}</div>
      </el-form-item>
      <el-form-item :label="t('tenantConfigShared.writeModeLabel')" prop="mode">
        <el-radio-group v-model="form.mode">
          <el-radio value="SKIP_EXISTING">{{ t('tenantConfigShared.modeSkipExisting') }}</el-radio>
          <el-radio value="UPSERT">{{ t('tenantConfigShared.modeUpsert') }}</el-radio>
        </el-radio-group>
        <div class="form-hint">
          {{
            form.mode === 'SKIP_EXISTING'
              ? t('tenantInitConfigDialog.modeHintSkip')
              : t('tenantInitConfigDialog.modeHintUpsert')
          }}
        </div>
      </el-form-item>
      <el-form-item label="Spec JSON" prop="specJson">
        <el-input
          v-model="form.specJson"
          type="textarea"
          :autosize="{ minRows: 8, maxRows: 20 }"
          :placeholder="t('tenantInitConfigDialog.specPlaceholder')"
          style="font-family: var(--font-family-mono, monospace); font-size: 12px"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        {{ t('tenantConfigShared.cancel') }}
      </el-button>
      <el-button
        plain
        :loading="saving && lastDryRun"
        :disabled="saving && !lastDryRun"
        @click="submit(true)"
      >
        {{ t('tenantConfigShared.dryRunPreview') }}
      </el-button>
      <el-button
        type="danger"
        :loading="saving && !lastDryRun"
        :disabled="saving && lastDryRun"
        @click="submit(false)"
      >
        {{ t('tenantInitConfigDialog.btnRunFormal') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { batchInitTenantConfig, type ConfigType } from '@/api/ops'
  import { ALL_CONFIG_TYPES } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const props = defineProps<{
    modelValue: boolean
    targetTenantId: string
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'result', data: unknown): void
  }>()

  const saving = ref(false)
  // 用于两个按钮区分 loading 状态:点试运行时只有"试运行"按钮转,反之亦然
  const lastDryRun = ref(true)
  const form = reactive({
    targetTenantId: '',
    configTypes: [] as ConfigType[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
    specJson: '',
  })

  const { formRef: initFormRef, validate: validateInitForm } = useFormValidate()
  const initFormRules: FormRules = {
    specJson: [rules.required(t('tenantInitConfigDialog.ruleSpec'))],
  }

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      form.targetTenantId = props.targetTenantId
      form.configTypes = []
      form.mode = 'SKIP_EXISTING'
      form.specJson = ''
      lastDryRun.value = true
    },
  )

  async function submit(dryRun: boolean) {
    if (!(await validateInitForm())) return
    let spec: Record<string, unknown>
    try {
      spec = JSON.parse(form.specJson)
    } catch {
      ElMessage.error(t('tenantInitConfigDialog.errInvalidJson'))
      return
    }
    saving.value = true
    lastDryRun.value = dryRun
    try {
      const res = await batchInitTenantConfig({
        targetTenantIds: [form.targetTenantId],
        spec,
        configTypes: form.configTypes.length ? form.configTypes : undefined,
        mode: form.mode,
        dryRun,
      })
      emit('result', res)
      if (!dryRun) {
        ElMessage.success(t('tenantInitConfigDialog.toastDone'))
        emit('update:modelValue', false)
      }
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .mb-12 {
    margin-bottom: 12px;
  }
</style>
