<template>
  <PageContainer>
    <PageHeader />

    <section class="me-hero" :class="{ 'me-hero--reminder': showPasswordReminder }">
      <div class="me-hero__icon" aria-hidden="true">
        <ShieldCheck v-if="showPasswordReminder" :size="26" />
        <UserRound v-else :size="26" />
      </div>
      <div class="me-hero__content">
        <div class="me-hero__topline">
          <el-tag :type="showPasswordReminder ? 'warning' : 'info'" effect="plain" size="small">
            {{
              showPasswordReminder ? t('myAccount.securityRequired') : t('myAccount.securityNormal')
            }}
          </el-tag>
          <span class="me-hero__tenant">{{ tenant.tenantId || '—' }}</span>
        </div>
        <h2>
          {{ showPasswordReminder ? t('myAccount.mustChangeTitle') : t('myAccount.sectionTitle') }}
        </h2>
        <p>
          {{
            showPasswordReminder
              ? t('myAccount.mustChangeDescription')
              : t('myAccount.accountDescription')
          }}
        </p>
      </div>
    </section>

    <div class="me-layout">
      <section class="me-panel me-panel--context">
        <div class="me-panel__header">
          <div>
            <h2>{{ t('myAccount.accountContextTitle') }}</h2>
            <p>{{ t('myAccount.accountContextDescription') }}</p>
          </div>
          <KeyRound :size="20" aria-hidden="true" />
        </div>

        <dl class="me-facts">
          <div class="me-fact">
            <dt>{{ t('myAccount.fieldUsername') }}</dt>
            <dd>{{ auth.userInfo?.username || '—' }}</dd>
          </div>
          <div class="me-fact">
            <dt>{{ t('myAccount.fieldRole') }}</dt>
            <dd>{{ auth.userInfo?.role || '—' }}</dd>
          </div>
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

      <section class="me-panel me-panel--form">
        <div class="me-panel__header">
          <div>
            <h2>{{ t('myAccount.changePasswordTitle') }}</h2>
            <p>{{ t('myAccount.changePasswordDescription') }}</p>
          </div>
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
            <el-input
              v-model="form.newPassword"
              type="password"
              show-password
              :placeholder="t('myAccount.placeholderNewPassword')"
              maxlength="256"
              autocomplete="new-password"
            >
              <template #append>
                <el-tooltip :content="t('common.passwordGenerate')" placement="top">
                  <el-button
                    :icon="MagicStick"
                    :aria-label="t('common.passwordGenerate')"
                    @click="onGen"
                  />
                </el-tooltip>
                <el-tooltip :content="t('common.passwordCopy')" placement="top">
                  <el-button
                    :icon="DocumentCopy"
                    :disabled="!form.newPassword"
                    :aria-label="t('common.passwordCopy')"
                    @click="onCopy"
                  />
                </el-tooltip>
              </template>
            </el-input>
            <div class="field-hint">
              {{ t('myAccount.hintNewPassword') }}
              <span v-if="form.newPassword" class="me-strength" :class="`me-strength--${strength}`">
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
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    Copy as DocumentCopy,
    KeyRound,
    ShieldCheck,
    Sparkles as MagicStick,
    UserRound,
  } from 'lucide-vue-next'
  import { authApi } from '@/api/auth'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import {
    generatePassword,
    passwordStrength,
    getPasswordStrengthLabel,
  } from '@/utils/passwordGenerator'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'

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

  function onGen() {
    form.newPassword = generatePassword(16)
    form.confirmPassword = form.newPassword
    ElMessage.success(t('common.passwordGeneratedToast'))
  }

  async function onCopy() {
    if (!form.newPassword) return
    try {
      await navigator.clipboard.writeText(form.newPassword)
      ElMessage.success(t('common.passwordCopiedToast'))
    } catch {
      ElMessage.warning(t('common.passwordCopyFailed'))
    }
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
  .me-hero {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    border: 1px solid var(--color-border-light);
    border-radius: 10px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-card)) 0%,
      var(--color-bg-card) 54%
    );
    box-shadow: 0 1px 2px color-mix(in srgb, #1f2937 5%, transparent);
  }

  .me-hero--reminder {
    border-color: color-mix(in srgb, var(--color-warning) 32%, var(--color-border-light));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-card)) 0%,
      var(--color-bg-card) 58%
    );
  }

  .me-hero__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    color: var(--color-primary);
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border-light));
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-card));
  }

  .me-hero--reminder .me-hero__icon {
    color: var(--color-warning);
    border-color: color-mix(in srgb, var(--color-warning) 28%, var(--color-border-light));
    background: color-mix(in srgb, var(--color-warning) 12%, var(--color-bg-card));
  }

  .me-hero__content {
    min-width: 0;
  }

  .me-hero__topline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .me-hero__tenant {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .me-hero h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 650;
    line-height: 1.28;
    color: var(--color-text-primary);
    letter-spacing: 0;
  }

  .me-hero p {
    max-width: 760px;
    margin: 5px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .me-layout {
    display: grid;
    grid-template-columns: minmax(280px, 0.82fr) minmax(420px, 1fr);
    gap: 16px;
    align-items: start;
  }

  .me-panel {
    min-width: 0;
    padding: 18px 20px;
    border: 1px solid var(--color-border-light);
    border-radius: 10px;
    background: var(--color-bg-card);
    box-shadow: 0 1px 2px color-mix(in srgb, #1f2937 5%, transparent);
  }

  .me-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    margin-bottom: 14px;
  }

  .me-panel__header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.4;
    color: var(--color-text-primary);
    letter-spacing: 0;
  }

  .me-panel__header p {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-tertiary);
  }

  .me-panel__header svg {
    flex: none;
    margin-top: 2px;
    color: var(--color-text-tertiary);
  }

  .me-facts {
    display: grid;
    gap: 0;
    margin: 0;
  }

  .me-fact {
    display: grid;
    grid-template-columns: 86px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    min-height: 44px;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border-light);
  }

  .me-fact:last-child {
    border-bottom: none;
  }

  .me-fact dt {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .me-fact dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .me-permissions {
    margin-top: 12px;
    padding-top: 14px;
    border-top: 1px solid var(--color-border-light);
  }

  .me-permissions__label {
    display: block;
    margin-bottom: 10px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .me-permissions__list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .me-perm-tag {
    max-width: 100%;
  }

  .me-permissions__more {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .me-alert {
    margin-top: 16px;
  }

  .me-form {
    max-width: 560px;
  }

  .me-form :deep(.el-form-item__label) {
    padding-bottom: 6px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .me-form :deep(.el-form-item) {
    margin-bottom: 17px;
  }

  .me-form :deep(.el-input__wrapper) {
    min-height: 36px;
    border-radius: var(--radius-button);
  }

  .me-form :deep(.el-form-item__error) {
    padding-top: 3px;
    font-size: 12px;
  }

  .me-submit {
    min-width: 108px;
  }

  .field-hint {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--color-text-tertiary);
  }

  .me-strength {
    margin-left: 8px;
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
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .me-hero,
    .me-panel {
      padding: 18px;
    }

    .me-hero {
      grid-template-columns: 1fr;
    }

    .me-hero__icon {
      width: 48px;
      height: 48px;
    }

    .me-fact {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .me-form :deep(.el-form-item__content) {
      align-items: stretch;
    }
  }
</style>
