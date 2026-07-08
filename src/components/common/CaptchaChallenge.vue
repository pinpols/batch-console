<template>
  <div class="captcha-challenge">
    <!-- selfhosted:滑块拖到缺口 -->
    <div v-if="provider === 'selfhosted'" class="captcha-selfhosted">
      <div v-if="selfHostedError" class="captcha-fallback" role="alert">
        {{ t('captcha.loadFailed') }}
        <el-button size="small" link type="primary" @click="refreshChallenge">
          {{ t('captcha.refresh') }}
        </el-button>
      </div>
      <template v-else>
        <div ref="trackRef" class="captcha-track" :class="{ 'is-passed': passed }">
          <!-- 缺口标记(目标位置) -->
          <div class="captcha-gap" :style="{ left: gapPx }" aria-hidden="true" />
          <div class="captcha-track__hint">
            {{ passed ? t('captcha.passed') : t('captcha.slideHint') }}
          </div>
          <button
            type="button"
            class="captcha-handle"
            :class="{ 'is-passed': passed }"
            :style="{ left: handlePx }"
            :aria-label="t('captcha.handleAria')"
            @mousedown="onDragStart"
            @touchstart.passive="onDragStart"
          >
            <el-icon v-if="passed"><Check /></el-icon>
            <el-icon v-else><DArrowRight /></el-icon>
          </button>
        </div>
        <div class="captcha-actions">
          <el-button
            size="small"
            link
            type="primary"
            :loading="challengeLoading"
            @click="refreshChallenge"
          >
            {{ t('captcha.refresh') }}
          </el-button>
        </div>
      </template>
    </div>

    <!-- 第三方 provider:动态加载官方 SDK,渲染容器 -->
    <div v-else class="captcha-thirdparty">
      <div v-if="thirdPartyError" class="captcha-fallback" role="alert">
        {{ t('captcha.loadFailed') }}
        <el-button size="small" link type="primary" @click="initThirdParty">
          {{ t('captcha.retry') }}
        </el-button>
      </div>
      <div v-else ref="widgetRef" class="captcha-widget-container" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Check, ChevronsRight as DArrowRight } from 'lucide-vue-next'
  import { getSelfHostedChallenge } from '@/api/captcha'
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

  // ────────────────────────────── selfhosted 滑块
  const TRACK_WIDTH = 300
  const HANDLE_WIDTH = 40
  const MAX_X = TRACK_WIDTH - HANDLE_WIDTH

  const trackRef = ref<HTMLElement>()
  const challengeId = ref('')
  const gap = ref(0)
  const handleX = ref(0)
  const passed = ref(false)
  const challengeLoading = ref(false)
  const selfHostedError = ref(false)

  const handlePx = ref('0px')
  const gapPx = ref('0px')

  function syncPx() {
    handlePx.value = `${handleX.value}px`
    // 缺口中心对齐到 gap(以 handle 宽度居中显示)
    const clampedGap = Math.max(0, Math.min(gap.value, MAX_X))
    gapPx.value = `${clampedGap}px`
  }

  let dragging = false
  let startPointerX = 0
  let startHandleX = 0

  function pointerX(e: MouseEvent | TouchEvent): number {
    if ('touches' in e && e.touches.length) return e.touches[0].clientX
    if ('changedTouches' in e && e.changedTouches.length) return e.changedTouches[0].clientX
    return (e as MouseEvent).clientX
  }

  function onDragStart(e: MouseEvent | TouchEvent) {
    if (passed.value || selfHostedError.value) return
    dragging = true
    startPointerX = pointerX(e)
    startHandleX = handleX.value
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragMove, { passive: false })
    window.addEventListener('touchend', onDragEnd)
  }

  function onDragMove(e: MouseEvent | TouchEvent) {
    if (!dragging) return
    if ('preventDefault' in e && typeof e.preventDefault === 'function') e.preventDefault()
    const delta = pointerX(e) - startPointerX
    handleX.value = Math.max(0, Math.min(startHandleX + delta, MAX_X))
    syncPx()
  }

  function onDragEnd() {
    if (!dragging) return
    dragging = false
    removeDragListeners()
    // 用户松手位置即 position(像素 X);emit "challengeId:position"
    const position = Math.round(handleX.value)
    passed.value = true
    emit('token', `${challengeId.value}:${position}`)
  }

  function removeDragListeners() {
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchmove', onDragMove)
    window.removeEventListener('touchend', onDragEnd)
  }

  async function refreshChallenge() {
    challengeLoading.value = true
    selfHostedError.value = false
    passed.value = false
    handleX.value = 0
    try {
      const c = await getSelfHostedChallenge()
      challengeId.value = c.challengeId
      gap.value = c.gap
      syncPx()
    } catch (err) {
      selfHostedError.value = true
      logError('captcha.selfhosted.challenge_failed', { message: String(err) })
    } finally {
      challengeLoading.value = false
    }
  }

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
    if (props.provider === 'selfhosted') {
      void refreshChallenge()
    } else if (props.provider !== 'none') {
      void initThirdParty()
    }
  })

  onBeforeUnmount(() => {
    removeDragListeners()
  })
</script>

<style scoped>
  .captcha-challenge {
    width: 100%;
  }

  .captcha-track {
    position: relative;
    width: 100%;
    max-width: 300px;
    height: 44px;
    margin: 0 auto;
    border-radius: var(--radius-content);
    background: var(--color-bg-subtle);
    border: 1px solid var(--color-border-light);
    overflow: hidden;
    user-select: none;
  }

  .captcha-track.is-passed {
    border-color: var(--color-success);
  }

  .captcha-track__hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--color-text-tertiary);
    pointer-events: none;
  }

  .captcha-track.is-passed .captcha-track__hint {
    color: var(--color-success);
  }

  .captcha-gap {
    position: absolute;
    top: 50%;
    width: var(--space-lg);
    height: var(--space-lg);
    transform: translateY(-50%);
    border-radius: var(--space-xs);
    background: color-mix(in srgb, var(--color-primary) 16%, transparent);
    border: 1px dashed var(--color-primary);
  }

  .captcha-handle {
    position: absolute;
    top: 0;
    width: 40px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: var(--radius-content);
    cursor: grab;
    color: var(--button-primary-text);
    background: var(--color-primary);
    box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent);
    touch-action: none;
  }

  .captcha-handle:active {
    cursor: grabbing;
  }

  .captcha-handle.is-passed {
    background: var(--color-success);
    cursor: default;
  }

  .captcha-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-xs);
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
