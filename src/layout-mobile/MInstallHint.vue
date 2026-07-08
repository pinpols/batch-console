<template>
  <!-- iOS PWA 安装引导 banner。
       触发条件:
         - 检测到 iOS Safari
         - 不在 standalone 模式(还没加到桌面)
         - localStorage 没有 "dismissed" 标记
       关闭后 14 天内不再提示。Android 走 beforeinstallprompt(由浏览器自己弹)。 -->
  <transition name="m-install-hint-fade">
    <div
      v-if="visible"
      class="m-install-hint"
      role="dialog"
      :aria-label="t('mobile.installHint.title')"
    >
      <div class="m-install-hint__icon">
        <el-icon :size="32"><DownloadIcon /></el-icon>
      </div>
      <div class="m-install-hint__body">
        <div class="m-install-hint__title">{{ t('mobile.installHint.title') }}</div>
        <div class="m-install-hint__desc">
          {{ t('mobile.installHint.step1') }}
          <el-icon class="m-install-hint__share"><Share /></el-icon>
          {{ t('mobile.installHint.step2') }}
          <strong>{{ t('mobile.installHint.step3') }}</strong>
        </div>
      </div>
      <button class="m-install-hint__close" :aria-label="t('common.close')" @click="dismiss">
        <el-icon><Close /></el-icon>
      </button>
    </div>
  </transition>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { X as Close, Download as DownloadIcon, Share2 as Share } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })

  const visible = ref(false)
  const DISMISS_KEY = 'batch-console:m-install-hint-dismissed-at'
  const DISMISS_DAYS = 14

  function isIosSafari(): boolean {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
    // 排除 Chrome / Edge / Firefox on iOS(它们也是 WebKit 但不能"添加到主屏幕")
    const isStandalone = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
    return iOS && isStandalone
  }

  function isInStandalone(): boolean {
    // iOS Safari 特有 navigator.standalone;现代浏览器走 display-mode
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    const matchMode =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches
    return iosStandalone || matchMode
  }

  function recentlyDismissed(): boolean {
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (!raw) return false
      const at = Number(raw)
      if (!Number.isFinite(at)) return false
      return Date.now() - at < DISMISS_DAYS * 24 * 3600 * 1000
    } catch {
      return false
    }
  }

  function dismiss() {
    visible.value = false
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* private mode / quota */
    }
  }

  onMounted(() => {
    // 等 SW 注册稳定再判断;不阻塞首屏
    setTimeout(() => {
      if (isIosSafari() && !isInStandalone() && !recentlyDismissed()) {
        visible.value = true
      }
    }, 1500)
  })
</script>

<style scoped>
  .m-install-hint {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(72px + env(safe-area-inset-bottom, 0) + 8px);
    /* 略低于 tab bar (--z-tab-bar = 100),挂在 tabbar 之上但被覆盖 */
    z-index: calc(var(--z-tab-bar) - 10);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    background: var(--color-bg-card);
    border-radius: 14px;
    box-shadow:
      0 10px 30px rgb(0 0 0 / 18%),
      0 0 0 1px var(--color-border-light);
  }
  .m-install-hint__icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .m-install-hint__body {
    flex: 1;
    min-width: 0;
  }
  .m-install-hint__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin-bottom: 3px;
  }
  .m-install-hint__desc {
    font-size: 12px;
    line-height: 1.55;
    color: var(--color-text-secondary);
    word-break: break-word;
  }
  .m-install-hint__share {
    vertical-align: middle;
    color: var(--color-primary);
    margin: 0 2px;
  }
  .m-install-hint__close {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: transparent;
    border: none;
    color: var(--color-text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .m-install-hint__close:active {
    background: var(--el-fill-color-light);
  }

  .m-install-hint-fade-enter-active,
  .m-install-hint-fade-leave-active {
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
  }
  .m-install-hint-fade-enter-from,
  .m-install-hint-fade-leave-to {
    opacity: 0;
    transform: translateY(12px);
  }
</style>
