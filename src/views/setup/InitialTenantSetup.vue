<template>
  <div class="initial-setup">
    <div class="initial-setup__card">
      <div class="initial-setup__header">
        <h1 class="initial-setup__title">{{ t('initialSetup.title') }}</h1>
        <p class="initial-setup__subtitle">{{ t('initialSetup.subtitle') }}</p>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="initial-setup__alert"
        :title="t('initialSetup.intro')"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="120px"
        class="initial-setup__form"
      >
        <el-form-item :label="t('initialSetup.fieldTenantId')" prop="tenantId">
          <TenantIdInput v-model="form.tenantId" />
          <div class="initial-setup__hint">{{ t('initialSetup.tenantIdHint') }}</div>
        </el-form-item>
        <el-form-item :label="t('initialSetup.fieldTenantName')" prop="tenantName">
          <el-input
            v-model="form.tenantName"
            :placeholder="t('initialSetup.tenantNamePlaceholder')"
            maxlength="256"
          />
        </el-form-item>
        <el-form-item :label="t('initialSetup.fieldDescription')" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            :placeholder="t('initialSetup.descriptionPlaceholder')"
            maxlength="512"
            show-word-limit
          />
        </el-form-item>

        <el-divider content-position="left">
          <span class="initial-setup__divider">{{ t('initialSetup.sectionAdmin') }}</span>
        </el-divider>

        <el-form-item :label="t('initialSetup.fieldUsername')" prop="username">
          <el-input
            v-model="form.username"
            :placeholder="t('initialSetup.usernamePlaceholder')"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('initialSetup.fieldPassword')" prop="password">
          <StrongPasswordInput
            v-model="form.password"
            :placeholder="t('initialSetup.passwordPlaceholder')"
          />
          <div class="initial-setup__hint">{{ t('initialSetup.passwordHint') }}</div>
        </el-form-item>
      </el-form>

      <div class="initial-setup__footer">
        <el-button @click="onLogout">{{ t('initialSetup.btnLogout') }}</el-button>
        <el-button type="primary" :loading="submitAction.loading.value" @click="onSubmit">
          {{ t('initialSetup.btnCreate') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import type { FormRules } from 'element-plus'
  import StrongPasswordInput from '@/components/common/StrongPasswordInput.vue'
  import TenantIdInput from '@/components/common/TenantIdInput.vue'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import { useAsyncAction } from '@/composables/useAsyncAction'
  import { createTenant } from '@/api/tenants'
  import { invalidateSystemHasTenantsCache } from '@/api/setup'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const tenantStore = useTenantStore()
  const auth = useAuthStore()

  const form = reactive({
    tenantId: '',
    tenantName: '',
    description: '',
    username: '',
    password: '',
  })

  const { formRef, validate } = useFormValidate()

  const formRules = computed<FormRules>(() => ({
    tenantId: [
      rules.required(t('initialSetup.ruleTenantId')),
      rules.pattern(/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/, t('initialSetup.ruleTenantIdPattern')),
    ],
    tenantName: [rules.required(t('initialSetup.ruleTenantName')), rules.maxLength(256)],
    username: [
      rules.required(t('initialSetup.ruleUsername')),
      rules.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]+$/, t('initialSetup.ruleUsernamePattern')),
      rules.minLength(2),
    ],
    password: [rules.required(t('initialSetup.rulePassword')), rules.minLength(12)],
  }))

  const submitAction = useAsyncAction(
    async () => {
      const tenantId = form.tenantId.trim()
      await createTenant({
        tenantId,
        tenantName: form.tenantName.trim(),
        description: form.description.trim() || undefined,
        username: form.username.trim(),
        password: form.password,
      })
      invalidateSystemHasTenantsCache()
      tenantStore.setTenantId(tenantId)
      ElMessage.success(t('initialSetup.toastCreated'))
      await router.replace('/')
    },
    { cooldownMs: 300 },
  )

  async function onSubmit() {
    if (!(await validate())) return
    await submitAction.run()
  }

  async function onLogout() {
    await auth.logout()
    await router.replace('/login')
  }
</script>

<style scoped>
  .initial-setup {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg, 24px);
    background: var(--color-bg-canvas);
  }

  .initial-setup__card {
    width: 100%;
    max-width: 640px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content, 12px);
    padding: var(--space-xl, 32px);
    box-shadow: var(--shadow-surface);
  }

  .initial-setup__header {
    margin-bottom: var(--space-lg, 24px);
  }

  .initial-setup__title {
    font-size: 22px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 8px;
  }

  .initial-setup__subtitle {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .initial-setup__alert {
    margin-bottom: var(--space-lg, 24px);
    font-size: 13px;
  }

  .initial-setup__divider {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
    letter-spacing: 0.3px;
  }

  .initial-setup__hint {
    font-size: 12px;
    color: var(--color-text-tertiary);
    margin-top: 4px;
    line-height: 1.5;
  }

  .initial-setup__footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: var(--space-md, 16px);
  }
</style>
