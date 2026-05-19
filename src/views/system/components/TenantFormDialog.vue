<template>
  <el-drawer
    :append-to-body="true"
    :model-value="modelValue"
    :title="
      editing
        ? t('tenantFormDialog.titleEdit', { id: form.tenantId })
        : t('tenantFormDialog.titleCreate')
    "
    direction="rtl"
    size="640px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="88px">
      <el-form-item :label="t('tenantFormDialog.fieldTenantId')" prop="tenantId">
        <!-- 编辑态走只读 input(主键不可改);创建态走 TenantIdInput 带实时校验 + 保留前缀提示 -->
        <el-input
          v-if="editing"
          v-model="form.tenantId"
          disabled
          :placeholder="t('tenantFormDialog.tenantIdPlaceholder')"
        />
        <TenantIdInput
          v-else
          v-model="form.tenantId"
          :placeholder="t('tenantFormDialog.tenantIdPlaceholder')"
        />
        <div v-if="editing" class="field-hint">
          {{ t('tenantFormDialog.tenantIdHintLocked') }}
        </div>
      </el-form-item>
      <el-form-item :label="t('tenantFormDialog.fieldTenantName')" prop="tenantName">
        <el-input
          v-model="form.tenantName"
          :placeholder="t('tenantFormDialog.tenantNamePlaceholder')"
          maxlength="256"
        />
      </el-form-item>
      <el-form-item :label="t('tenantFormDialog.fieldDescription')" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          :placeholder="t('tenantFormDialog.descriptionPlaceholder')"
          maxlength="512"
          show-word-limit
        />
      </el-form-item>

      <template v-if="!editing">
        <el-divider content-position="left">
          <span class="section-divider__text">{{ t('tenantFormDialog.sectionAdmin') }}</span>
        </el-divider>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="form-alert"
          :title="t('tenantFormDialog.adminAlert')"
        />
        <el-form-item :label="t('tenantFormDialog.fieldUsername')" prop="username">
          <el-input
            v-model="form.username"
            :placeholder="t('tenantFormDialog.usernamePlaceholder')"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('tenantFormDialog.fieldPassword')" prop="password">
          <StrongPasswordInput
            v-model="form.password"
            :placeholder="t('tenantFormDialog.passwordPlaceholder')"
          />
          <div class="field-hint">{{ t('tenantFormDialog.passwordHint') }}</div>
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        {{ t('tenantConfigShared.cancel') }}
      </el-button>
      <el-button type="primary" :loading="submitAction.loading.value" @click="submit">
        {{ editing ? t('common.save') : t('tenantFormDialog.btnCreate') }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import StrongPasswordInput from '@/components/common/StrongPasswordInput.vue'
  import TenantIdInput from '@/components/common/TenantIdInput.vue'

  const { t } = useI18n({ useScope: 'global' })
  import type { FormRules } from 'element-plus'
  import { createTenant, updateTenant, type Tenant } from '@/api/tenants'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import { useAsyncAction } from '@/composables/useAsyncAction'

  const props = defineProps<{
    modelValue: boolean
    initial: Tenant | null
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    /** payload 携带 tenantId 和 created 标记;父组件可据此决定是否展示"创建后引导卡片" */
    (e: 'saved', payload: { tenantId: string; created: boolean }): void
  }>()

  const editing = ref(false)
  const form = reactive({
    tenantId: '',
    tenantName: '',
    description: '',
    username: '',
    password: '',
  })

  // 密码生成 / 复制 / 强度 已下沉到 StrongPasswordInput,这里不再重复
  const { formRef, validate } = useFormValidate()

  // 编辑态下 tenantId / username / password 不校验(灰显或不显示);
  // 新建态下要走完整规则
  const formRules = computed<FormRules>(() => {
    const base: FormRules = {
      tenantName: [rules.required(t('tenantFormDialog.ruleTenantName')), rules.maxLength(256)],
    }
    if (!editing.value) {
      Object.assign(base, {
        tenantId: [
          rules.required(t('tenantFormDialog.ruleTenantId')),
          rules.pattern(
            /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/,
            t('tenantFormDialog.ruleTenantIdPattern'),
          ),
        ],
        username: [
          rules.required(t('tenantFormDialog.ruleUsername')),
          rules.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]+$/, t('tenantFormDialog.ruleUsernamePattern')),
          rules.minLength(2),
        ],
        // BE 实际接受 ≥8,FE 加严到 ≥12 与「批量新增」「BE BatchCreateTenantRequest」对齐,
        // 避免单租户用 8 位弱密码后批量场景又要求 12 的不一致体验
        password: [rules.required(t('tenantFormDialog.rulePassword')), rules.minLength(12)],
      })
    }
    return base
  })

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      const row = props.initial
      editing.value = !!row
      form.tenantId = row?.tenantId ?? ''
      form.tenantName = row?.tenantName ?? ''
      form.description = row?.description ?? ''
      form.username = ''
      form.password = ''
    },
  )

  // useAsyncAction:连点抗抖,完成后 300ms 内 :loading 仍 true,防止用户在 emit
  // 关闭弹窗的动画期间二次点击触发重复 create/update
  const submitAction = useAsyncAction(
    async () => {
      const tenantId = form.tenantId.trim()
      if (editing.value) {
        await updateTenant(tenantId, {
          tenantName: form.tenantName.trim(),
          description: form.description || undefined,
        })
        ElMessage.success(t('tenantFormDialog.toastUpdated'))
      } else {
        await createTenant({
          tenantId,
          tenantName: form.tenantName.trim(),
          description: form.description || undefined,
          username: form.username.trim(),
          password: form.password,
        })
        // 不再 toast"已创建"——父组件会展示带"去初始化 / 查看列表"的引导卡片
      }
      emit('saved', { tenantId, created: !editing.value })
      emit('update:modelValue', false)
    },
    { cooldownMs: 300 },
  )

  async function submit() {
    if (!(await validate())) return
    await submitAction.run()
  }
</script>

<style scoped>
  .section-divider__text {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary, #606266);
    letter-spacing: 0.3px;
  }

  .form-alert {
    margin-bottom: 16px;
    font-size: 12px;
  }
</style>
