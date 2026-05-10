<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('tenantCopyConfigDialog.title')"
    width="640px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-alert type="info" :closable="false" show-icon class="mb-12">
      <template #title>{{ t('tenantCopyConfigDialog.infoAlert') }}</template>
    </el-alert>
    <el-form ref="copyFormRef" :model="form" :rules="copyFormRules" label-width="100px">
      <el-form-item :label="t('tenantCopyConfigDialog.fieldSource')" prop="sourceTenantId">
        <el-select
          class="query-w-280"
          v-model="form.sourceTenantId"
          filterable
          :placeholder="t('tenantCopyConfigDialog.sourcePlaceholder')"
        >
          <el-option
            v-for="ten in sourceableItems"
            :key="ten.tenantId"
            :label="`${ten.tenantId} — ${ten.tenantName}`"
            :value="ten.tenantId"
          >
            <span>{{ ten.tenantId }} — {{ ten.tenantName }}</span>
            <el-tag
              v-if="isTemplateTenant(ten.tenantId)"
              size="small"
              type="primary"
              effect="plain"
              class="u-ml-8"
            >
              {{ t('tenantConfigShared.templateTag') }}
            </el-tag>
          </el-option>
        </el-select>
        <div class="form-hint">{{ t('tenantCopyConfigDialog.sourceHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('tenantCopyConfigDialog.fieldTargets')" prop="targetTenantIds">
        <el-select
          v-model="form.targetTenantIds"
          multiple
          filterable
          :placeholder="t('tenantCopyConfigDialog.targetsPlaceholder')"
          class="query-w-full"
        >
          <el-option
            v-for="ten in targetableItems"
            :key="ten.tenantId"
            :label="`${ten.tenantId} — ${ten.tenantName}`"
            :value="ten.tenantId"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('tenantConfigShared.configTypeLabel')">
        <el-checkbox-group v-model="form.configTypes">
          <el-checkbox v-for="ct in ALL_CONFIG_TYPES" :key="ct" :label="ct" :value="ct" />
        </el-checkbox-group>
        <div class="form-hint">{{ t('tenantConfigShared.configTypeHintAll') }}</div>
      </el-form-item>
      <el-form-item :label="t('tenantConfigShared.writeModeLabel')">
        <el-radio-group v-model="form.mode">
          <el-radio value="SKIP_EXISTING">{{ t('tenantConfigShared.modeSkipExisting') }}</el-radio>
          <el-radio value="UPSERT">{{ t('tenantConfigShared.modeUpsert') }}</el-radio>
        </el-radio-group>
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
        {{ t('tenantConfigShared.dryRunPreviewDiff') }}
      </el-button>
      <el-button
        type="danger"
        :loading="saving && !lastDryRun"
        :disabled="saving && lastDryRun"
        @click="submit(false)"
      >
        {{ t('tenantCopyConfigDialog.btnRunFormal') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { copyTenantConfig, type ConfigType } from '@/api/ops'
  import type { Tenant } from '@/api/tenants'
  import { ALL_CONFIG_TYPES, isReservedTenant, isTemplateTenant } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const props = defineProps<{
    modelValue: boolean
    items: Tenant[]
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'result', data: unknown): void
  }>()

  const saving = ref(false)
  const lastDryRun = ref(true)
  const form = reactive({
    sourceTenantId: '',
    targetTenantIds: [] as string[],
    configTypes: [] as ConfigType[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
  })

  const { formRef: copyFormRef, validate: validateCopyForm } = useFormValidate()
  const copyFormRules: FormRules = {
    sourceTenantId: [rules.required(t('tenantCopyConfigDialog.ruleSource'), 'change')],
    targetTenantIds: [
      {
        validator: (_r, v: unknown[], cb) =>
          Array.isArray(v) && v.length > 0
            ? cb()
            : cb(new Error(t('tenantCopyConfigDialog.ruleTargets'))),
        trigger: 'change',
      },
    ],
  }

  // 源租户:排除系统/内置租户(参考 tenantConfigTypes.RESERVED_TENANT_IDS)
  const sourceableItems = computed(() => props.items.filter((x) => !isReservedTenant(x.tenantId)))
  // 目标租户:同样排掉系统租户(系统配置不该被业务租户配置覆盖),且不能选当前源
  const targetableItems = computed(() =>
    props.items.filter((x) => !isReservedTenant(x.tenantId) && x.tenantId !== form.sourceTenantId),
  )

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      form.sourceTenantId = ''
      form.targetTenantIds = []
      form.configTypes = []
      form.mode = 'SKIP_EXISTING'
      lastDryRun.value = true
    },
  )

  async function submit(dryRun: boolean) {
    if (!(await validateCopyForm())) return
    saving.value = true
    lastDryRun.value = dryRun
    try {
      const res = await copyTenantConfig({
        sourceTenantId: form.sourceTenantId,
        targetTenantIds: form.targetTenantIds,
        configTypes: form.configTypes.length ? form.configTypes : undefined,
        mode: form.mode,
        dryRun,
      })
      emit('result', res)
      if (!dryRun) {
        ElMessage.success(t('tenantCopyConfigDialog.toastDone'))
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
    color: var(--color-text-tertiary, #909399);
  }

  .mb-12 {
    margin-bottom: 12px;
  }
</style>
