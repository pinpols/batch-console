<template>
  <Transition name="sw-fade">
    <div v-if="needRefresh" class="sw-prompt" role="alert" aria-live="polite">
      <div class="sw-prompt__icon">
        <el-icon><Refresh /></el-icon>
      </div>
      <div class="sw-prompt__content">
        <div class="sw-prompt__title">{{ t('pwa.updateReady') }}</div>
      </div>
      <div class="sw-prompt__actions">
        <el-button type="primary" size="small" @click="reload">{{ t('pwa.updateNow') }}</el-button>
        <el-button size="small" text @click="dismiss">{{ t('pwa.updateLater') }}</el-button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  /**
   * SW(Service Worker)新版本就绪提示。
   *
   * vite-plugin-pwa 配置 `registerType: 'autoUpdate'` 会自动接管 SW,但页面上的 JS
   * chunk 可能还是旧的(bfcache / 长时间未刷新);这里给用户一个"刷新到最新"按钮,
   * 同时配合 ElMessage `offlineReady` 在首次安装完成时提示离线已可用。
   *
   * 用法:在 DefaultLayout / MobileLayout 顶层 import 一次即可。
   */
  import { onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Refresh } from '@element-plus/icons-vue'

  const { t } = useI18n()
  const needRefresh = ref(false)
  let updateSW: ((reload?: boolean) => Promise<void>) | null = null

  onMounted(async () => {
    // dev 模式下 vite-plugin-pwa 不注入 virtual:pwa-register;dynamic import + try
    // 兜底,生产构建命中真 SW,dev 直接静默跳过(无 SW 时不需要任何提示)
    try {
      const mod = await import('virtual:pwa-register').catch(() => null)
      if (!mod) return
      updateSW = mod.registerSW({
        immediate: true,
        onNeedRefresh() {
          needRefresh.value = true
        },
        onOfflineReady() {
          ElMessage({
            message: t('pwa.offlineReady'),
            type: 'success',
            duration: 3000,
            grouping: true,
          })
        },
      })
    } catch {
      /* SW 不可用(老浏览器 / 私有模式)→ 静默 */
    }
  })

  async function reload() {
    if (updateSW) await updateSW(true)
    else window.location.reload()
  }

  function dismiss() {
    needRefresh.value = false
  }
</script>

<style scoped>
  .sw-prompt {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    background: var(--color-bg-card);
    box-shadow: 0 8px 24px rgb(15 23 42 / 12%);
    border: 1px solid var(--color-border-light);
    max-width: calc(100vw - 32px);
    z-index: 2200;
  }

  .sw-prompt__icon {
    display: inline-flex;
    width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--el-color-primary-light-9);
    color: var(--color-primary);
    font-size: 18px;
    flex-shrink: 0;
  }

  .sw-prompt__content {
    flex: 1;
    min-width: 0;
  }

  .sw-prompt__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    line-height: 1.5;
  }

  .sw-prompt__actions {
    display: inline-flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .sw-fade-enter-active,
  .sw-fade-leave-active {
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
  }

  .sw-fade-enter-from,
  .sw-fade-leave-to {
    opacity: 0;
    transform: translate(-50%, 12px);
  }
</style>
