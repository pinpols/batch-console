<template>
  <!-- 还原设计(login 样张):左营销面板(标语+指标)+ 右表单分屏。 -->
  <div class="login-page">
    <aside class="login-hero">
      <div class="login-brand">
        <span class="login-brand__logo">BC</span>
        <div>
          <div class="login-brand__name">{{ t('nav.appTitle') }}</div>
          <div class="login-brand__desc">Batch Console</div>
        </div>
      </div>

      <div class="login-hero__body">
        <h1 class="login-hero__title">{{ t('login.heroTitle') }}</h1>
        <p class="login-hero__desc">{{ t('login.heroDesc') }}</p>
      </div>

      <div class="login-hero__visual" aria-hidden="true">
        <img src="/images/login-batch-pipeline.png" alt="" />
      </div>

      <div class="login-hero__foot">© 2026 Batch Console · v{{ appVersion }}</div>
    </aside>

    <main class="login-card">
      <header class="login-card__header">
        <h2 class="login-card__title">{{ t('login.welcome') }}</h2>
        <p class="login-card__subtitle">{{ t('login.subtitle') }}</p>
      </header>

      <div v-if="loginTrace" class="login-trace" role="status">
        <span class="login-trace__label">{{ t('login.traceLabel') }}</span>
        <code class="login-trace__code" :title="loginTrace">{{ loginTrace }}</code>
        <el-button size="small" link type="primary" @click="copyTrace">
          {{ t('login.copy') }}
        </el-button>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        class="login-form"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item :label="t('login.usernameLabel')" prop="username">
          <el-input
            v-model="form.username"
            :placeholder="t('login.usernamePlaceholder')"
            size="large"
            autocomplete="username"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
            <template #suffix>
              <el-icon
                v-if="form.username"
                class="input-clear-btn"
                role="button"
                tabindex="0"
                :aria-label="t('login.clearUsernameAria')"
                @click="form.username = ''"
                @keydown.enter.space.prevent="form.username = ''"
              >
                <CircleClose />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item :label="t('login.passwordLabel')" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            :placeholder="t('login.passwordPlaceholder')"
            size="large"
            show-password
            autocomplete="current-password"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <div v-if="captchaVisible" class="login-captcha">
          <div class="login-captcha__hint">{{ t('login.captchaHint') }}</div>
          <CaptchaChallenge
            :key="captchaKey"
            :provider="captchaConfig.provider"
            :site-key="captchaConfig.siteKey"
            @token="onCaptchaToken"
          />
        </div>

        <el-button
          type="primary"
          native-type="submit"
          :loading="loading"
          class="login-submit"
          size="large"
        >
          {{ loading ? t('login.submitting') : t('login.submit') }}
        </el-button>
      </el-form>
    </main>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { CircleX as CircleClose, Lock, User } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })
  import { useRouter, useRoute } from 'vue-router'
  import type { FormInstance } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import { useAuthStore } from '@/stores/auth'
  import { authApi } from '@/api/auth'
  import { getCaptchaConfig } from '@/api/captcha'
  import type { CaptchaConfig } from '@/api/captcha'
  import CaptchaChallenge from '@/components/common/CaptchaChallenge.vue'
  import type { AxiosRequestConfig } from 'axios'
  import { lastApiMeta } from '@/utils/lastApiMeta'

  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()

  const formRef = ref<FormInstance>()
  const loading = ref(false)
  const appVersion = __APP_VERSION__
  const loginTrace = ref('')
  const form = reactive({ username: '', password: '' })

  // ────────────────────────────── 验证码状态
  const captchaConfig = ref<CaptchaConfig>({ provider: 'none', loginProtectionEnabled: false })
  // 是否展示验证码组件:仅在登录失败返回 CAPTCHA_REQUIRED 后才展示。
  const captchaVisible = ref(false)
  // 用户过验证拿到的 token;提交后清空,token 用错/过期再回到验证态。
  const captchaToken = ref('')
  // 刷新 key:强制重建 CaptchaChallenge 组件(换一张挑战)。
  const captchaKey = ref(0)

  function isCaptchaRequiredError(e: unknown): boolean {
    const err = e as { captchaRequired?: boolean }
    return err?.captchaRequired === true
  }

  function onCaptchaToken(token: string) {
    captchaToken.value = token
  }

  // 兜底:登录页挂载时主动调一次 /auth/logout,让后端 Set-Cookie max-age=0
  // 清掉浏览器里可能残留的失效 HttpOnly cookie。否则 cookie 过期 / 服务端 secret
  // 轮换后,浏览器会把毒 cookie 自动带给后续 /auth/login,旧版后端 filter 会直接
  // 401 INVALID_CONSOLE_JWT,用户陷死无法重新登录(必须手清浏览器数据)。
  // 失败静默 —— 后端可能 401(cookie 已失效)或 5xx,都不影响接下来用户输密码登录。
  onMounted(() => {
    // _silent:抑制失败 toast(详见 src/api/interceptors.ts LoggedConfig._silent)。
    // 失效 cookie 时这次 logout 会 401,不该让用户在登录页一打开就看到"未授权"。
    void authApi.logout({ _silent: true } as AxiosRequestConfig).catch(() => {})
    // 拉验证码配置:loginProtectionEnabled && provider!=none 时才可能需要验证码;
    // 但只有登录失败返回 CAPTCHA_REQUIRED 才真正展示组件(渐进式,首登无摩擦)。
    void getCaptchaConfig()
      .then((cfg) => {
        captchaConfig.value = cfg
      })
      .catch(() => {
        // 配置拉取失败不阻断登录(后端会按需 401 CAPTCHA_REQUIRED 兜底)
      })
  })

  /** 当前 provider 是否具备展示验证码的条件(配置开启 + 非 none)。 */
  function captchaAvailable(): boolean {
    return captchaConfig.value.loginProtectionEnabled && captchaConfig.value.provider !== 'none'
  }

  const rules = {
    username: [{ required: true, message: t('login.usernameRequired'), trigger: 'blur' }],
    password: [{ required: true, message: t('login.passwordRequired'), trigger: 'blur' }],
  }

  async function handleLogin() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
    // 已进入验证码态:必须先过验证拿到 token 才能提交。
    if (captchaVisible.value && !captchaToken.value) {
      ElMessage.warning(t('login.captchaRequired'))
      return
    }
    loading.value = true
    loginTrace.value = ''
    try {
      await auth.login(form.username, form.password, captchaToken.value || undefined)
      const redirect = (route.query.redirect as string) || '/'
      router.push(redirect)
    } catch (e: unknown) {
      const err = e as { traceId?: string }
      loginTrace.value = err.traceId ?? lastApiMeta.value?.traceId ?? ''
      if (isCaptchaRequiredError(e) && captchaAvailable()) {
        // 触发验证码:展示组件,清掉旧 token,换一张新挑战。
        // token 用错/过期再次登录仍会 CAPTCHA_REQUIRED → 回到此态并刷新挑战。
        captchaVisible.value = true
        captchaToken.value = ''
        captchaKey.value += 1
      } else if (captchaVisible.value) {
        // 已在验证码态但本次登录失败(密码错/token 过期等):清 token + 换新挑战,
        // 让用户重新拖。
        captchaToken.value = ''
        captchaKey.value += 1
      }
    } finally {
      loading.value = false
    }
  }

  function copyTrace() {
    if (!loginTrace.value) return
    void navigator.clipboard.writeText(loginTrace.value)
    ElMessage.success(t('login.copySuccess'))
  }
</script>

<style scoped>
  /* 还原设计:左右分屏 —— 左营销面板(page 底)+ 右表单区(card 底),1px 分隔线。 */
  .login-page {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: stretch;
    background: var(--color-bg-page);
  }

  .login-hero {
    flex: 1 1 56%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 44px 56px 24px;
    min-width: 0;
  }

  .login-hero__body {
    max-width: 460px;
    margin-top: clamp(28px, 5vh, 60px);
  }

  .login-hero__title {
    margin: 0 0 16px;
    font-size: 28px;
    font-weight: 700;
    line-height: 1.4;
    color: var(--color-text-primary);
    letter-spacing: 0;
    white-space: pre-line;
  }

  .login-hero__desc {
    margin: 0 0 36px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--color-text-secondary);
  }

  .login-hero__visual {
    width: min(100%, 540px, 74vh);
    aspect-ratio: 2 / 1;
    margin-top: clamp(16px, 2.5vh, 28px);
    overflow: hidden;
    border: 1px solid rgb(96 165 250 / 22%);
    border-radius: 14px;
    background: #06111f;
    box-shadow: 0 18px 44px rgb(0 0 0 / 18%);
  }

  .login-hero__visual img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.94;
  }

  .login-hero__foot {
    margin-top: auto;
    padding-top: 16px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  /* 右表单区:边到边面板,非浮卡 */
  .login-card {
    position: relative;
    flex: 0 0 44%;
    max-width: 560px;
    min-width: 380px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: clamp(120px, 20vh, 184px) 56px 48px;
    background: var(--color-bg-card);
    border-left: 1px solid var(--color-border);
  }

  .login-card__subtitle {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--color-text-secondary);
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
    border-radius: var(--radius-content);
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
    margin-bottom: 24px;
  }

  .login-card__title {
    margin: 0 0 6px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0;
    color: var(--color-text-primary);
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
    border-radius: var(--radius-content);
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
    border-radius: var(--radius-content);
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

  .input-clear-btn {
    cursor: pointer;
    color: var(--color-text-tertiary);
    font-size: 15px;
    transition: color 0.15s ease;
  }

  .input-clear-btn:hover {
    color: var(--color-text-secondary);
  }

  .login-captcha {
    margin-bottom: var(--space-md);
  }

  .login-captcha__hint {
    margin-bottom: var(--space-sm);
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .login-submit {
    width: 100%;
    min-height: 46px;
    margin-top: 4px;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0;
    border: none;
    border-radius: var(--radius-content);
    color: var(--button-primary-text);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--button-primary-bg) 88%, #ffffff 12%) 0%,
      var(--button-primary-bg) 100%
    );
    box-shadow: 0 4px 16px color-mix(in srgb, var(--button-primary-bg) 20%, transparent);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .login-submit:hover {
    transform: translateY(-1px);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--button-primary-bg-hover) 88%, #ffffff 12%) 0%,
      var(--button-primary-bg-hover) 100%
    );
    box-shadow: 0 6px 20px color-mix(in srgb, var(--button-primary-bg) 26%, transparent);
  }

  .login-submit:active {
    transform: translateY(0);
  }

  /* 窄屏:营销面板收起,只留表单 */
  @media (max-width: 860px) {
    .login-hero {
      display: none;
    }

    .login-card {
      flex: 1;
      max-width: none;
      min-width: 0;
      border-left: none;
      padding: 40px 28px;
    }
  }
</style>
