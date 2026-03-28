<template>
  <div class="login-page">
    <div class="login-hero">
      <div class="login-hero__badge">Batch Console</div>
      <h1>批量调度控制台</h1>
      <p>面向文件导入、任务编排、执行监控与运维治理的企业级控制台骨架。</p>
      <ul>
        <li>状态驱动的任务监控</li>
        <li>DAG 编排与执行追踪</li>
        <li>统一权限与主题基线</li>
      </ul>
    </div>

    <el-card class="login-card" shadow="never">
      <div class="login-card__title">登录系统</div>
      <div class="login-card__subtitle">使用你的运维账号进入控制台</div>

      <el-form ref="formRef" :model="form" :rules="rules" class="login-form" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large">
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password>
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading" class="login-submit" size="large">
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { Lock, User } from '@element-plus/icons-vue'
  import { useRouter, useRoute } from 'vue-router'
  import type { FormInstance } from 'element-plus'
  import { useAuthStore } from '@/stores/auth'

  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()

  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const form = reactive({ username: '', password: '' })

  const rules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  }

  async function handleLogin() {
    await formRef.value?.validate()
    loading.value = true
    try {
      await auth.login(form.username, form.password)
      const redirect = (route.query.redirect as string) || '/'
      router.push(redirect)
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped>
  .login-page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(360px, 420px);
    gap: 48px;
    align-items: center;
    padding: 48px;
    background:
      radial-gradient(circle at top left, rgb(22 119 255 / 12%), transparent 36%),
      radial-gradient(circle at bottom right, rgb(82 196 26 / 10%), transparent 28%),
      linear-gradient(180deg, #f8fbff 0%, #f5f7fa 100%);
  }

  .login-hero {
    max-width: 560px;
  }

  .login-hero__badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border: 1px solid rgb(22 119 255 / 20%);
    border-radius: 999px;
    color: var(--color-primary);
    font-size: 12px;
    font-weight: 600;
    background: rgb(22 119 255 / 8%);
  }

  .login-hero h1 {
    margin: 20px 0 12px;
    font-size: 42px;
    line-height: 1.1;
    letter-spacing: -0.03em;
  }

  .login-hero p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 16px;
    line-height: 1.8;
  }

  .login-hero ul {
    display: grid;
    gap: 12px;
    margin: 32px 0 0;
    padding: 0;
    list-style: none;
  }

  .login-hero li {
    position: relative;
    padding-left: 20px;
    color: var(--color-text-primary);
    font-size: 14px;
    line-height: 1.6;
  }

  .login-hero li::before {
    content: '';
    position: absolute;
    top: 8px;
    left: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-primary);
  }

  .login-card {
    padding: 8px;
    border: 1px solid var(--color-border-light);
    border-radius: 16px;
  }

  .login-card__title {
    margin: 4px 0 6px;
    font-size: 20px;
    font-weight: 600;
  }

  .login-card__subtitle {
    margin-bottom: 24px;
    color: var(--color-text-tertiary);
    font-size: 13px;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .login-submit {
    width: 100%;
    margin-top: 8px;
  }

  @media (max-width: 960px) {
    .login-page {
      grid-template-columns: 1fr;
      padding: 24px;
    }

    .login-hero h1 {
      font-size: 32px;
    }
  }
</style>
