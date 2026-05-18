<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <template #header>
        <span>{{ t('myAccount.sectionTitle') }}</span>
      </template>

      <!-- 当前账号摘要 -->
      <el-descriptions :column="2" border size="default" class="me-meta">
        <el-descriptions-item :label="t('myAccount.fieldUsername')">
          {{ auth.userInfo?.username || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('myAccount.fieldRole')">
          {{ auth.userInfo?.role || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('myAccount.fieldTenant')">
          {{ tenant.tenantId || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('myAccount.fieldPermissions')">
          <el-tag
            v-for="p in (auth.userInfo?.permissions ?? []).slice(0, 8)"
            :key="p"
            size="small"
            effect="plain"
            class="me-perm-tag"
          >
            {{ p }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 强制改密码警示 -->
      <el-alert
        v-if="auth.userInfo?.mustChangePassword"
        type="warning"
        :title="t('myAccount.mustChangeTitle')"
        :description="t('myAccount.mustChangeDescription')"
        show-icon
        :closable="false"
        class="me-must-change"
      />

      <!-- 过期临近警示 -->
      <el-alert
        v-else-if="
          auth.userInfo?.passwordExpiringIn != null && auth.userInfo.passwordExpiringIn <= 7
        "
        type="warning"
        :title="t('myAccount.expiringTitle', { days: auth.userInfo.passwordExpiringIn })"
        show-icon
        :closable="false"
        class="me-must-change"
      />
    </SectionCard>

    <SectionCard>
      <template #header>
        <span>{{ t('myAccount.changePasswordTitle') }}</span>
      </template>

      <el-form ref="formRef" :model="form" :rules="formRules" label-width="120px" class="me-form">
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
                <el-button :icon="MagicStick" @click="onGen" />
              </el-tooltip>
              <el-tooltip :content="t('common.passwordCopy')" placement="top">
                <el-button :icon="DocumentCopy" :disabled="!form.newPassword" @click="onCopy" />
              </el-tooltip>
            </template>
          </el-input>
          <div class="field-hint">
            {{ t('myAccount.hintNewPassword') }}
            <span v-if="form.newPassword" class="me-strength" :class="`me-strength--${strength}`">
              {{ PASSWORD_STRENGTH_LABEL[strength] }}
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
          <el-button type="primary" :loading="submitting" @click="submit">
            {{ t('myAccount.btnSubmit') }}
          </el-button>
          <el-button @click="onReset">{{ t('common.reset') }}</el-button>
        </el-form-item>
      </el-form>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { DocumentCopy, MagicStick } from '@element-plus/icons-vue'
  import { authApi } from '@/api/auth'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import {
    generatePassword,
    passwordStrength,
    PASSWORD_STRENGTH_LABEL,
  } from '@/utils/passwordGenerator'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const auth = useAuthStore()
  const tenant = useTenantStore()

  const formRef = ref<FormInstance>()
  const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const submitting = ref(false)
  const strength = computed(() => passwordStrength(form.newPassword))

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
    try {
      await authApi.changePassword({
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      })
      ElMessage.success(t('myAccount.changeSuccess'))
      // 改完后,如果之前是 mustChangePassword,清掉本地态,让 guard 放行
      await auth.fetchMe().catch(() => undefined)
      formRef.value?.resetFields()
      // 若强制改流程,改完跳回首页
      if (auth.userInfo?.mustChangePassword === false) {
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
  .me-meta {
    margin-bottom: var(--space-md);
  }
  .me-must-change {
    margin-top: var(--space-md);
  }
  .me-form {
    max-width: 560px;
  }
  .me-perm-tag {
    margin-right: 4px;
  }
  .field-hint {
    font-size: 12px;
    color: var(--color-text-tertiary);
    margin-top: 4px;
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
</style>
