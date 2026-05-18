<template>
  <el-drawer
    :append-to-body="true"
    :model-value="modelValue"
    :title="t('tenantBatchCreateDialog.title')"
    direction="rtl"
    size="640px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form ref="batchFormRef" :model="form" :rules="batchFormRules" label-width="88px">
      <el-form-item :label="t('tenantBatchCreateDialog.fieldTenants')" prop="tenantsText">
        <el-input
          v-model="form.tenantsText"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
          :placeholder="t('tenantBatchCreateDialog.tenantsPlaceholder')"
        />
        <div class="field-hint">{{ t('tenantBatchCreateDialog.tenantsHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('tenantBatchCreateDialog.fieldPrefix')" prop="usernamePrefix">
        <el-input
          v-model="form.usernamePrefix"
          :placeholder="t('tenantBatchCreateDialog.prefixPlaceholder')"
          maxlength="32"
        />
      </el-form-item>
      <el-form-item :label="t('tenantBatchCreateDialog.fieldPassword')" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          :placeholder="t('tenantBatchCreateDialog.passwordPlaceholder')"
          maxlength="256"
        />
        <div class="field-hint">{{ t('tenantBatchCreateDialog.passwordHint') }}</div>
      </el-form-item>
      <el-divider content-position="left">
        {{ t('tenantBatchCreateDialog.sectionInitConfig') }}
      </el-divider>
      <el-form-item :label="t('tenantBatchCreateDialog.fieldSource')">
        <el-select
          class="query-w-280"
          v-model="form.initConfigFrom"
          clearable
          filterable
          :placeholder="t('tenantBatchCreateDialog.sourcePlaceholder')"
        >
          <template #empty>
            <div class="empty-hint">{{ t('tenantBatchCreateDialog.sourceEmpty') }}</div>
          </template>
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
        <div class="field-hint">{{ t('tenantBatchCreateDialog.sourceHint') }}</div>
      </el-form-item>
      <el-form-item v-if="form.initConfigFrom" :label="t('tenantConfigShared.initModeLabel')">
        <el-radio-group v-model="form.initMode">
          <el-radio value="SKIP_EXISTING">{{ t('tenantConfigShared.modeSkipExisting') }}</el-radio>
          <el-radio value="UPSERT">{{ t('tenantConfigShared.modeUpsert') }}</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        {{ t('tenantConfigShared.cancel') }}
      </el-button>
      <el-button type="primary" :loading="submitAction.loading.value" @click="submit">
        {{ t('tenantBatchCreateDialog.btnSubmit') }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { batchCreateTenants, type Tenant } from '@/api/tenants'
  import { isReservedTenant, isTemplateTenant } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import { useAsyncAction } from '@/composables/useAsyncAction'

  const props = defineProps<{
    modelValue: boolean
    items: Tenant[]
  }>()

  // 与 TenantCopyConfigDialog 一致:源租户排除 system/default/default-tenant
  const sourceableItems = computed(() => props.items.filter((x) => !isReservedTenant(x.tenantId)))

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'saved'): void
    (e: 'result', data: unknown): void
  }>()

  const form = reactive({
    tenantsText: '',
    usernamePrefix: 'op-',
    password: '',
    initConfigFrom: '',
    initMode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
  })

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      form.tenantsText = ''
      form.usernamePrefix = 'op-'
      form.password = ''
      form.initConfigFrom = ''
      form.initMode = 'SKIP_EXISTING'
    },
  )

  const { formRef: batchFormRef, validate: validateBatchForm } = useFormValidate()
  // tenantsText 校验逻辑复杂(逐行解析 + 数量上限),写自定义 validator
  const batchFormRules: FormRules = {
    tenantsText: [
      rules.required(t('tenantBatchCreateDialog.ruleAtLeastOne')),
      {
        validator: (_r, v: string, cb) => {
          const items = parseTenants(v ?? '')
          if (items.length === 0) return cb(new Error(t('tenantBatchCreateDialog.ruleAtLeastOne')))
          if (items.length > 50) return cb(new Error(t('tenantBatchCreateDialog.ruleMax50')))
          for (const item of items) {
            if (!item.tenantId || !item.tenantName) {
              return cb(
                new Error(
                  t('tenantBatchCreateDialog.ruleLineMissing', {
                    row: item.tenantId || t('tenantBatchCreateDialog.ruleLineEmpty'),
                  }),
                ),
              )
            }
          }
          cb()
        },
        trigger: 'blur',
      },
    ],
    password: [rules.required(t('tenantBatchCreateDialog.rulePassword')), rules.minLength(12)],
  }

  function parseTenants(text: string) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [tenantId = '', tenantName = '', description] = line.split(',').map((s) => s.trim())
        return { tenantId, tenantName, description: description || undefined }
      })
  }

  // useAsyncAction:连点抗抖,完成后 300ms 内 :loading 仍 true,防止用户在 emit
  // 关闭弹窗的动画期间二次点击触发重复批量创建
  const submitAction = useAsyncAction(
    async () => {
      const tenants = parseTenants(form.tenantsText)
      const res = await batchCreateTenants({
        tenants,
        usernamePrefix: form.usernamePrefix || undefined,
        password: form.password,
        initConfigFrom: form.initConfigFrom || undefined,
        initMode: form.initConfigFrom ? form.initMode : undefined,
      })
      emit('update:modelValue', false)
      if (res.configInit) {
        const ci = res.configInit
        ElMessage.success(
          t('tenantBatchCreateDialog.toastWithInit', {
            n: tenants.length,
            success: ci.successTenants,
            failure: ci.failureTenants,
          }),
        )
        emit('result', res.configInit)
      } else {
        ElMessage.success(t('tenantBatchCreateDialog.toastSimple', { n: tenants.length }))
      }
      emit('saved')
    },
    { cooldownMs: 300 },
  )

  async function submit() {
    if (!(await validateBatchForm())) return
    await submitAction.run()
  }
</script>

<style scoped>
  .empty-hint {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
</style>
