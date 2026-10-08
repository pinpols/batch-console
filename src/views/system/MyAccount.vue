<template>
  <PageContainer>
    <div class="me-page">
      <PageHeader />

      <section v-if="showPasswordReminder" class="me-notice" role="status">
        <div class="me-notice__icon" aria-hidden="true"><ShieldCheck :size="19" /></div>
        <div class="me-notice__content">
          <div class="me-notice__heading">
            <el-tag type="warning" effect="plain" size="small">
              {{ t('myAccount.securityRequired') }}
            </el-tag>
            <h2>{{ t('myAccount.mustChangeTitle') }}</h2>
          </div>
          <p>{{ t('myAccount.mustChangeDescription') }}</p>
        </div>
      </section>

      <div class="me-layout">
        <section class="me-panel me-panel--context">
          <div class="me-panel__header">
            <div>
              <h2>{{ t('myAccount.accountContextTitle') }}</h2>
              <p>{{ t('myAccount.accountContextDescription') }}</p>
            </div>
          </div>

          <div class="me-identity">
            <div class="me-identity__avatar" aria-hidden="true"><UserRound :size="21" /></div>
            <div class="me-identity__details">
              <span class="me-identity__label">{{ t('myAccount.fieldUsername') }}</span>
              <strong>{{ auth.userInfo?.username || '—' }}</strong>
              <span class="me-identity__role">{{ formalRoleLabel }}</span>
            </div>
          </div>

          <dl class="me-facts">
            <div class="me-fact">
              <dt>{{ t('myAccount.fieldTenant') }}</dt>
              <dd>{{ tenant.tenantId || '—' }}</dd>
            </div>
          </dl>

          <div class="me-permissions">
            <span class="me-permissions__label">{{ t('myAccount.fieldPermissions') }}</span>
            <div class="me-permissions__list">
              <el-tag
                v-for="p in visiblePermissions"
                :key="p"
                size="small"
                effect="plain"
                class="me-perm-tag"
              >
                {{ p }}
              </el-tag>
              <span v-if="hiddenPermissionCount > 0" class="me-permissions__more">
                {{ t('myAccount.permissionsMore', { count: hiddenPermissionCount }) }}
              </span>
              <span v-if="visiblePermissions.length === 0" class="me-permissions__more">—</span>
            </div>
          </div>

          <el-alert
            v-if="!showPasswordReminder && isPasswordExpiringSoon"
            type="warning"
            :title="t('myAccount.expiringTitle', { days: auth.userInfo?.passwordExpiringIn })"
            show-icon
            :closable="false"
            class="me-alert"
          />
        </section>

        <section class="me-panel me-panel--form" aria-labelledby="change-password-title">
          <div class="me-panel__header">
            <div>
              <h2 id="change-password-title">{{ t('myAccount.changePasswordTitle') }}</h2>
              <p>{{ t('myAccount.changePasswordDescription') }}</p>
            </div>
            <KeyRound :size="19" aria-hidden="true" />
          </div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="formRules"
            label-position="top"
            hide-required-asterisk
            class="me-form"
          >
            <el-form-item :label="t('myAccount.fieldOldPassword')" prop="oldPassword">
              <el-input
                v-model="form.oldPassword"
                type="password"
                show-password
                :placeholder="t('myAccount.placeholderOldPassword')"
                maxlength="256"
                autocomplete="current-password"
              />
            </el-form-item>

            <el-form-item :label="t('myAccount.fieldNewPassword')" prop="newPassword">
              <StrongPasswordInput
                v-model="form.newPassword"
                :placeholder="t('myAccount.placeholderNewPassword')"
                :show-strength="false"
                actions-outside
                @generated="onGen"
              />
              <div class="field-hint">
                {{ t('myAccount.hintNewPassword') }}
                <span
                  v-if="form.newPassword"
                  class="me-strength"
                  :class="`me-strength--${strength}`"
                >
                  {{ getPasswordStrengthLabel(strength) }}
                </span>
              </div>
            </el-form-item>

            <el-form-item :label="t('myAccount.fieldConfirmPassword')" prop="confirmPassword">
              <el-input
                v-model="form.confirmPassword"
                type="password"
                show-password
                :placeholder="t('myAccount.placeholderConfirmPassword')"
                maxlength="256"
                autocomplete="new-password"
              />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="submitting" class="me-submit" @click="submit">
                {{ t('myAccount.btnSubmit') }}
              </el-button>
              <el-button @click="onReset">{{ t('common.reset') }}</el-button>
            </el-form-item>
          </el-form>
        </section>
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { KeyRound, ShieldCheck, UserRound } from '@lucide/vue'
  import { authApi } from '@/api/auth'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { passwordStrength, getPasswordStrengthLabel } from '@/utils/passwordGenerator'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import StrongPasswordInput from '@/components/common/StrongPasswordInput.vue'
  import { authorityRoleLabelKeyMap, resolveAuthorityRole } from '@/constants/role'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const tenant = useTenantStore()

  const formRef = ref<FormInstance>()
  const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const submitting = ref(false)
  const strength = computed(() => passwordStrength(form.newPassword))
  const visiblePermissions = computed(() => (auth.userInfo?.permissions ?? []).slice(0, 6))
  const formalRoleLabel = computed(() => {
    const role = resolveAuthorityRole(auth.userInfo?.permissions ?? [])
    return role ? t(authorityRoleLabelKeyMap[role]) : '—'
  })
  const hiddenPermissionCount = computed(() =>
    Math.max((auth.userInfo?.permissions?.length ?? 0) - visiblePermissions.value.length, 0),
  )
  const showPasswordReminder = computed(
    () => route.query.mustChange === '1' || auth.userInfo?.mustChangePassword === true,
  )
  const isPasswordExpiringSoon = computed(
    () => auth.userInfo?.passwordExpiringIn != null && auth.userInfo.passwordExpiringIn <= 7,
  )

  const formRules: FormRules = {
    oldPassword: [{ required: true, message: t('myAccount.ruleOldPassword'), trigger: 'blur' }],
    newPassword: [
      { required: true, message: t('myAccount.ruleNewPasswordRequired'), trigger: 'blur' },
      { min: 12, message: t('myAccount.ruleNewPasswordMinLen'), trigger: 'blur' },
      {
        validator: (_r, v: string, cb) => {
          if (v && v === form.oldPassword) cb(new Error(t('myAccount.ruleNewSameAsOld')))
          else cb()
        },
        trigger: 'blur',
      },
    ],
    confirmPassword: [
      { required: true, message: t('myAccount.ruleConfirmRequired'), trigger: 'blur' },
      {
        validator: (_r, v: string, cb) => {
          if (v !== form.newPassword) cb(new Error(t('myAccount.ruleConfirmMismatch')))
          else cb()
        },
        trigger: 'blur',
      },
    ],
  }

  function onGen(password: string) {
    form.confirmPassword = password
  }

  function onReset() {
    formRef.value?.resetFields()
  }

  async function submit() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    submitting.value = true
    const wasMustChangePassword = auth.userInfo?.mustChangePassword === true
    try {
      await authApi.changePassword({
        currentPassword: form.oldPassword,
        newPassword: form.newPassword,
      })
      ElMessage.success(t('myAccount.changeSuccess'))
      auth.clearPasswordReminder()
      // 改完后重新拉取账号状态,使全局提醒自动消失。
      await auth.fetchMe().catch(() => undefined)
      formRef.value?.resetFields()
      // 从密码提醒进入时,改完回到首页。
      if (wasMustChangePassword || auth.userInfo?.mustChangePassword === false) {
        await router.push('/')
      }
    } catch {
      // 错误 toast 由 axios interceptor 处理(401/400/409)
    } finally {
      submitting.value = false
    }
  }
</script>

<style scoped>
  .me-page {
    display: flex;
    flex-direction: column;
    gap: var(--page-section-gap);
    width: min(100%, 75rem);
    margin-inline: auto;
  }

  .me-notice {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border: 1px solid color-mix(in srgb, var(--color-warning) 30%, var(--color-border-light));
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-warning) 7%, var(--color-bg-card));
  }

  .me-notice__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--control-height-lg);
    height: var(--control-height-lg);
    border-radius: 50%;
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 13%, var(--color-bg-card));
  }

  .me-notice__content {
    min-width: 0;
  }

  .me-notice__heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
  }

  .me-notice__heading :deep(.el-tag) {
    flex: 0 0 auto;
  }

  .me-notice h2 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.4;
    color: var(--color-text-primary);
    letter-spacing: 0;
  }

  .me-notice p {
    margin: var(--space-xs) 0 0;
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .me-layout {
    display: grid;
    grid-template-columns: minmax(15rem, 0.62fr) minmax(0, 1.38fr);
    gap: var(--space-lg);
    align-items: stretch;
  }

  .me-panel {
    min-width: 0;
  }

  .me-panel--context {
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    box-shadow: var(--shadow-card);
  }

  .me-panel--form {
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    box-shadow: var(--shadow-card);
  }

  .me-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    margin-bottom: var(--space-md);
  }

  .me-panel__header h2 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 650;
    line-height: 1.4;
    color: var(--color-text-primary);
    letter-spacing: 0;
  }

  .me-panel__header p {
    margin: var(--space-xs) 0 0;
    font-size: 0.8125rem;
    line-height: 1.6;
    color: var(--color-text-tertiary);
  }

  .me-panel__header svg {
    flex: none;
    margin-top: 0;
    color: var(--color-text-tertiary);
  }

  .me-identity {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin: var(--space-md) 0;
  }

  .me-identity__avatar {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: var(--control-height-lg);
    height: var(--control-height-lg);
    border: 1px solid color-mix(in srgb, var(--color-primary) 24%, var(--color-border-light));
    border-radius: 50%;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-card));
  }

  .me-identity__details {
    display: grid;
    min-width: 0;
    gap: var(--space-xs);
  }

  .me-identity__label {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .me-identity__details strong {
    overflow-wrap: anywhere;
    font-size: 1rem;
    font-weight: 650;
    line-height: 1.35;
    color: var(--color-text-primary);
  }

  .me-identity__role {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .me-facts {
    display: grid;
    gap: 0;
    margin: 0;
  }

  .me-fact {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-xs);
    align-items: start;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--color-border-light);
  }

  .me-fact dt {
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .me-fact dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .me-permissions {
    margin-top: var(--space-md);
  }

  .me-permissions__label {
    display: block;
    margin-bottom: var(--space-sm);
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .me-permissions__list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .me-perm-tag {
    max-width: 100%;
  }

  .me-permissions__more {
    display: inline-flex;
    align-items: center;
    min-height: 1.5rem;
    font-size: 0.75rem;
    color: var(--color-text-tertiary);
  }

  .me-alert {
    margin-top: var(--space-md);
  }

  .me-form {
    max-width: 40rem;
  }

  .me-form :deep(.el-form-item__label) {
    padding-bottom: var(--space-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .me-form :deep(.el-form-item) {
    margin-bottom: var(--space-md);
  }

  .me-form :deep(.el-input__wrapper) {
    min-height: var(--control-height-lg);
    border-radius: var(--radius-button);
  }

  .me-form :deep(.el-form-item__error) {
    padding-top: var(--space-xs);
    font-size: 0.75rem;
  }

  .me-submit {
    min-width: 7.25rem;
  }

  .field-hint {
    margin-top: var(--space-xs);
    font-size: 0.75rem;
    line-height: 1.45;
    color: var(--color-text-tertiary);
  }

  .me-strength {
    margin-left: var(--space-sm);
    font-weight: 600;
  }
  .me-strength--0,
  .me-strength--1 {
    color: var(--color-danger);
  }
  .me-strength--2 {
    color: var(--color-warning);
  }
  .me-strength--3,
  .me-strength--4 {
    color: var(--color-success);
  }

  @media (max-width: 980px) {
    .me-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-md);
    }

    .me-panel--context {
      padding: var(--space-md);
    }
  }

  @media (max-width: 640px) {
    .me-page {
      width: 100%;
    }

    .me-notice {
      align-items: start;
      padding: var(--space-sm);
    }

    .me-notice__icon {
      width: var(--space-xl);
      height: var(--space-xl);
    }

    .me-panel--context {
      padding: var(--space-md);
    }

    .me-panel--form {
      padding: var(--space-md);
    }

    .me-form :deep(.el-form-item__content) {
      align-items: stretch;
    }
  }
</style>
