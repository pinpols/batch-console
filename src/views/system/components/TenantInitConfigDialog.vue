<template>
  <el-drawer
    :append-to-body="true"
    :model-value="modelValue"
    :title="t('tenantInitConfigDialog.title')"
    direction="rtl"
    size="640px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
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
    <el-form ref="initFormRef" :model="form" :rules="initFormRules" label-width="88px">
      <el-form-item :label="t('tenantInitConfigDialog.fieldTarget')">
        <el-tag>{{ form.targetTenantId }}</el-tag>
      </el-form-item>
      <el-form-item :label="t('tenantConfigShared.configTypeLabel')" prop="configTypes">
        <el-checkbox-group v-model="form.configTypes">
          <el-checkbox v-for="ct in ALL_CONFIG_TYPES" :key="ct" :label="ct" :value="ct" />
        </el-checkbox-group>
        <div class="field-hint">{{ t('tenantConfigShared.configTypeHintAll') }}</div>
      </el-form-item>
      <el-form-item :label="t('tenantConfigShared.writeModeLabel')" prop="mode">
        <el-radio-group v-model="form.mode">
          <el-radio value="SKIP_EXISTING">{{ t('tenantConfigShared.modeSkipExisting') }}</el-radio>
          <el-radio value="UPSERT">{{ t('tenantConfigShared.modeUpsert') }}</el-radio>
        </el-radio-group>
        <div class="field-hint">
          {{
            form.mode === 'SKIP_EXISTING'
              ? t('tenantInitConfigDialog.modeHintSkip')
              : t('tenantInitConfigDialog.modeHintUpsert')
          }}
        </div>
      </el-form-item>
      <el-form-item :label="t('tenantInitConfigDialog.fieldSpecJson')" prop="specJson">
        <JsonTextareaInput
          v-model="form.specJson"
          :rows="10"
          expect="object"
          :placeholder="t('tenantInitConfigDialog.specPlaceholder')"
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
        :disabled="saving || !canWriteSystem"
        @click="submit(true)"
      >
        {{ t('tenantConfigShared.dryRunPreview') }}
      </el-button>
      <el-button
        type="danger"
        :loading="saving && !lastDryRun"
        :disabled="saving || !canWriteSystem"
        @click="submit(false)"
      >
        {{ t('tenantInitConfigDialog.btnRunFormal') }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { batchInitTenantConfig, type ConfigType } from '@/api/ops'
  import JsonTextareaInput from '@/components/common/JsonTextareaInput.vue'
  import { ALL_CONFIG_TYPES } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import { assessBatchInitOutcome } from '@/utils/batchInitOutcome'
  import { usePermission } from '@/composables/usePermission'
  import { useAuthStore } from '@/stores/auth'

  const props = defineProps<{
    modelValue: boolean
    targetTenantId: string
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'result', data: unknown): void
  }>()

  const saving = ref(false)
  const { canWriteSystem } = usePermission()
  const auth = useAuthStore()
  const actor = computed(() => String(auth.userInfo?.userId ?? auth.userInfo?.username ?? ''))
  let revision = 0
  let disposed = false
  // 用于两个按钮区分 loading 状态:点试运行时只有"试运行"按钮转,反之亦然
  const lastDryRun = ref(true)
  const form = reactive({
    targetTenantId: '',
    configTypes: [] as ConfigType[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
    specJson: '{}',
  })

  const { formRef: initFormRef, validate: validateInitForm } = useFormValidate()
  // JSON 语法校验放进 rule:用户改一行 textarea 就能即时看到红字提示,
  // 而不是填了一大坨 spec 点了"运行"才被 toast 拦回来。
  const initFormRules: FormRules = {
    specJson: [
      rules.required(t('tenantInitConfigDialog.ruleSpec')),
      {
        validator: (_r, value: string, cb: (err?: Error) => void) => {
          if (!value || !value.trim()) return cb()
          try {
            JSON.parse(value)
            cb()
          } catch {
            const errorMessage = t('tenantInitConfigDialog.errInvalidJson')
            const validationError = new Error(errorMessage)
            cb(validationError)
          }
        },
        trigger: 'change',
      },
    ],
  }

  watch(
    [() => props.modelValue, () => props.targetTenantId],
    ([open]) => {
      revision += 1
      if (!open) return
      form.targetTenantId = props.targetTenantId
      form.configTypes = []
      form.mode = 'SKIP_EXISTING'
      form.specJson = '{}'
      lastDryRun.value = true
    },
    { immediate: true, flush: 'sync' },
  )
  watch(
    form,
    () => {
      revision += 1
    },
    { flush: 'sync' },
  )
  watch(
    [actor, canWriteSystem],
    () => {
      revision += 1
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    revision += 1
  })

  async function submit(dryRun: boolean) {
    if (
      saving.value ||
      !props.modelValue ||
      !canWriteSystem.value ||
      !actor.value ||
      !form.targetTenantId
    )
      return
    const operationRevision = revision
    const isCurrent = () =>
      !disposed && props.modelValue && operationRevision === revision && canWriteSystem.value
    // 校验也属于本次操作，提前占用防止重复点击在等待期间排出多笔写请求。
    saving.value = true
    lastDryRun.value = dryRun
    try {
      if (!(await validateInitForm()) || !isCurrent()) return
      const spec: Record<string, unknown> = JSON.parse(form.specJson)
      const res = await batchInitTenantConfig({
        targetTenantIds: [form.targetTenantId],
        spec,
        configTypes: form.configTypes.length ? form.configTypes : undefined,
        mode: form.mode,
        dryRun,
      })
      if (!isCurrent()) return
      emit('result', res)
      if (!dryRun) {
        const outcome = res ? assessBatchInitOutcome(res) : null
        if (!outcome?.fullySuccessful) {
          ElMessage.warning(t('tenantInitConfigDialog.toastFailed'))
          return
        }
        ElMessage.success(t('tenantInitConfigDialog.toastDone'))
        emit('update:modelValue', false)
      }
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .mb-12 {
    margin-bottom: 12px;
  }
</style>
