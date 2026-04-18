<template>
  <div class="login-page">
    <div class="login-bg-glow login-bg-glow--1" aria-hidden="true" />
    <div class="login-bg-glow login-bg-glow--2" aria-hidden="true" />

    <main class="login-card">
      <div class="login-card__accent" aria-hidden="true" />

      <div class="login-brand">
        <span class="login-brand__logo">BC</span>
        <div>
          <div class="login-brand__name">Batch Console</div>
          <div class="login-brand__desc">批量调度控制台</div>
        </div>
      </div>

      <header class="login-card__header">
        <h2 class="login-card__title">欢迎回来</h2>
        <p class="login-card__subtitle">请使用控制台账号登录</p>
      </header>

      <div v-if="loginTrace" class="login-trace" role="status">
        <span class="login-trace__label">Trace</span>
        <code class="login-trace__code" :title="loginTrace">{{ loginTrace }}</code>
        <el-button size="small" link type="primary" @click="copyTrace">复制</el-button>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        class="login-form"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="账号" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            size="large"
            clearable
            autocomplete="username"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            show-password
            autocomplete="current-password"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-button
          type="primary"
          native-type="submit"
          :loading="loading"
          class="login-submit"
          size="large"
        >
          {{ loading ? '登录中…' : '登 录' }}
        </el-button>
      </el-form>

      <div class="login-card__footer">
        <span class="login-card__tag">RBAC 权限</span>
        <span class="login-card__tag">租户隔离</span>
        <span class="login-card__tag">审计留痕</span>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { Lock, User } from '@element-plus/icons-vue'
  import { useRouter, useRoute } from 'vue-router'
  import type { FormInstance } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { useAuthStore } from '@/stores/auth'
  import { lastApiMeta } from '@/utils/lastApiMeta'

  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()

  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const loginTrace = ref('')
  const form = reactive({ username: '', password: '' })

  const rules = {
    username: [{ required: true, message: '请填写账号', trigger: 'blur' }],
    password: [{ required: true, message: '请填写密码', trigger: 'blur' }],
  }

  async function handleLogin() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    loading.value = true
    loginTrace.value = ''
    try {
      await auth.login(form.username, form.password)
      const redirect = (route.query.redirect as string) || '/'
      router.push(redirect)
    } catch (e: unknown) {
      const err = e as { traceId?: string }
      loginTrace.value = err.traceId ?? lastApiMeta.value?.traceId ?? ''
    } finally {
      loading.value = false
    }
  }

  function copyTrace() {
    if (!loginTrace.value) return
    void navigator.clipboard.writeText(loginTrace.value)
    ElMessage.success('已复制追踪 ID')
  }
</script>

<style scoped>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--login-page-bg);
    position: relative;
    overflow: hidden;
  }

  /* 背景光晕 */
  .login-bg-glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(80px);
  }

  .login-bg-glow--1 {
    width: 480px;
    height: 480px;
    top: -120px;
    left: -80px;
    background: rgb(22 119 255 / 10%);
  }

  .login-bg-glow--2 {
    width: 400px;
    height: 400px;
    bottom: -100px;
    right: -60px;
    background: rgb(16 185 129 / 8%);
  }

  /* 卡片 */
  .login-card {
    position: relative;
    width: 100%;
    max-width: 420px;
    padding: 40px 36px 32px;
    border-radius: 24px;
    background: rgb(255 255 255 / 82%);
    border: 1px solid rgb(255 255 255 / 60%);
    backdrop-filter: blur(20px) saturate(1.4);
    box-shadow:
      0 1px 3px rgb(0 0 0 / 4%),
      0 12px 40px rgb(15 23 42 / 8%);
  }

  html.dark .login-card {
    background: rgb(15 23 42 / 72%);
    border-color: rgb(148 163 184 / 14%);
    box-shadow:
      0 1px 3px rgb(0 0 0 / 12%),
      0 12px 40px rgb(0 0 0 / 28%);
  }

  .login-card__accent {
    position: absolute;
    top: 0;
    left: 32px;
    right: 32px;
    height: 3px;
    border-radius: 0 0 3px 3px;
    background: linear-gradient(90deg, var(--color-primary), #10b981);
  }

  /* 品牌 */
  .login-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 32px;
  }

  .login-brand__logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #fff;
    background: linear-gradient(135deg, var(--color-primary), #0f5ed9);
    box-shadow: 0 4px 12px rgb(22 119 255 / 20%);
  }

  .login-brand__name {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text-primary);
    letter-spacing: -0.01em;
  }

  .login-brand__desc {
    font-size: 12px;
    color: var(--color-text-tertiary);
    margin-top: 1px;
  }

  /* 标题 */
  .login-card__header {
    margin-bottom: 28px;
  }

  .login-card__title {
    margin: 0 0 6px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
  }

  .login-card__subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  /* Trace */
  .login-trace {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding: 10px 12px;
    font-size: 12px;
    background: rgb(241 245 249 / 60%);
    border: 1px solid var(--color-border-light);
    border-radius: 12px;
  }

  html.dark .login-trace {
    background: rgb(30 41 59 / 50%);
    border-color: rgb(148 163 184 / 14%);
  }

  .login-trace__label {
    font-weight: 600;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .login-trace__code {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: ui-monospace, monospace;
    font-size: 11px;
    color: var(--color-text-primary);
  }

  /* 表单 */
  .login-form {
    display: flex;
    flex-direction: column;
  }

  .login-form :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  .login-form :deep(.el-form-item__label) {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-bottom: 6px;
  }

  .login-form :deep(.el-input__wrapper) {
    min-height: 46px;
    border-radius: 12px;
    box-shadow: none;
    background: rgb(248 250 252 / 80%);
    border: 1px solid var(--color-border-light);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;
  }

  html.dark .login-form :deep(.el-input__wrapper) {
    background: rgb(15 23 42 / 50%);
    border-color: rgb(148 163 184 / 16%);
  }

  .login-form :deep(.el-input__wrapper:hover) {
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  }

  .login-form :deep(.el-input__wrapper.is-focus) {
    background: #fff;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgb(22 119 255 / 10%);
  }

  html.dark .login-form :deep(.el-input__wrapper.is-focus) {
    background: rgb(15 23 42 / 80%);
    box-shadow: 0 0 0 3px rgb(59 130 246 / 14%);
  }

  .login-form :deep(.el-input__prefix) {
    color: var(--color-text-tertiary);
  }

  .login-submit {
    width: 100%;
    min-height: 46px;
    margin-top: 4px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.08em;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--color-primary) 0%, #0f5ed9 100%);
    box-shadow: 0 4px 16px rgb(22 119 255 / 18%);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .login-submit:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgb(22 119 255 / 24%);
  }

  .login-submit:active {
    transform: translateY(0);
  }

  /* 底部标签 */
  .login-card__footer {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid var(--color-border-light);
  }

  .login-card__tag {
    font-size: 11px;
    font-weight: 500;
    color: var(--color-text-tertiary);
    padding: 4px 10px;
    border-radius: 6px;
    background: rgb(241 245 249 / 60%);
  }

  html.dark .login-card__tag {
    background: rgb(30 41 59 / 50%);
  }

  /* 动画 */
  @media (prefers-reduced-motion: no-preference) {
    .login-card {
      animation: card-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .login-bg-glow--1 {
      animation: glow-drift 12s ease-in-out infinite alternate;
    }

    .login-bg-glow--2 {
      animation: glow-drift 14s ease-in-out 2s infinite alternate-reverse;
    }
  }

  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes glow-drift {
    from {
      transform: translate(0, 0);
    }
    to {
      transform: translate(30px, 20px);
    }
  }

  @media (max-width: 480px) {
    .login-card {
      padding: 32px 24px 24px;
      border-radius: 20px;
    }

    .login-card__title {
      font-size: 22px;
    }
  }
</style>
