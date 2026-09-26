<template>
  <div class="captcha-challenge">
    <div class="captcha-thirdparty">
      <div v-if="thirdPartyError" class="captcha-fallback" role="alert">
        {{ t('captcha.loadFailed') }}
        <el-button size="small" link type="primary" native-type="button" @click="initThirdParty">
          {{ t('captcha.retry') }}
        </el-button>
      </div>
      <div v-else ref="widgetRef" class="captcha-widget-container" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { CaptchaProvider } from '@/api/captcha'
  import { loadScript } from '@/utils/loadScript'
  import { logError } from '@/utils/logger'

  const props = defineProps<{
    provider: CaptchaProvider
    siteKey?: string
  }>()

  const emit = defineEmits<{
    (e: 'token', token: string): void
  }>()

  const { t } = useI18n({ useScope: 'global' })

  // ────────────────────────────── 第三方 provider
  const widgetRef = ref<HTMLElement>()
  const thirdPartyError = ref(false)

  // 各家官方 SDK 脚本地址
  const SDK_SRC: Record<string, string> = {
    cloudflare: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    tencent: 'https://turing.captcha.qcloud.com/TCaptcha.js',
    aliyun: 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js',
  }

  type TurnstileApi = {
    render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => void
  }
  type TencentCaptchaCtor = new (
    appId: string,
    callback: (res: { ret: number; ticket?: string; randstr?: string }) => void,
  ) => { show: () => void }
  type AliyunInitFn = (opts: {
    SceneId: string
    prefix?: string
    mode: string
    element: string
    captchaVerifyCallback: (param: string) => Promise<{ captchaResult: boolean }>
    getInstance: (instance: unknown) => void
  }) => void

  type CaptchaWindow = Window & {
    turnstile?: TurnstileApi
    TencentCaptcha?: TencentCaptchaCtor
    initAliyunCaptcha?: AliyunInitFn
  }

  async function initThirdParty() {
    thirdPartyError.value = false
    const src = SDK_SRC[props.provider]
    if (!src || !props.siteKey) {
      thirdPartyError.value = true
      return
    }
    try {
      await loadScript(src)
      const w = window as CaptchaWindow
      if (props.provider === 'cloudflare') {
        // Cloudflare Turnstile:回调拿到 token(cf-turnstile-response)
        if (!w.turnstile || !widgetRef.value) throw new Error('turnstile unavailable')
        w.turnstile.render(widgetRef.value, {
          sitekey: props.siteKey,
          callback: (token: string) => emit('token', token),
        })
      } else if (props.provider === 'tencent') {
        // 腾讯天御:回调拿 ticket + randstr,emit "<ticket>:<randstr>"
        if (!w.TencentCaptcha) throw new Error('TencentCaptcha unavailable')
        const captcha = new w.TencentCaptcha(props.siteKey, (res) => {
          if (res.ret === 0 && res.ticket && res.randstr) {
            emit('token', `${res.ticket}:${res.randstr}`)
          }
        })
        captcha.show()
      } else if (props.provider === 'aliyun') {
        // 阿里云验证码 2.0:回调拿 captchaVerifyParam
        if (!w.initAliyunCaptcha || !widgetRef.value) throw new Error('AliyunCaptcha unavailable')
        widgetRef.value.id = 'aliyun-captcha-element'
        w.initAliyunCaptcha({
          SceneId: props.siteKey,
          mode: 'embed',
          element: '#aliyun-captcha-element',
          captchaVerifyCallback: async (param: string) => {
            emit('token', param)
            return { captchaResult: true }
          },
          getInstance: () => {},
        })
      }
    } catch (err) {
      thirdPartyError.value = true
      logError('captcha.thirdparty.init_failed', {
        provider: props.provider,
        message: String(err),
      })
    }
  }

  onMounted(() => {
    if (props.provider !== 'none') {
      void initThirdParty()
    }
  })
</script>

<style scoped>
  .captcha-challenge {
    width: 100%;
  }

  .captcha-fallback {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    font-size: 13px;
    border-radius: var(--radius-content);
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
  }

  .captcha-widget-container {
    display: flex;
    justify-content: center;
    min-height: 44px;
  }
</style>
