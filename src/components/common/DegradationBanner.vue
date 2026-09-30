<template>
  <div v-if="app.isDegraded" class="degradation-banner" role="status">
    <el-icon class="degradation-banner__icon">
      <WarningFilled />
    </el-icon>
    <div class="degradation-banner__text">
      <strong>{{ t('degradation.bannerHeadline') }}</strong>
      <span class="degradation-banner__msg">{{ t('degradation.bannerMessage') }}</span>
      <span v-for="src in app.activeDegradationSources" :key="src" class="degradation-banner__chip">
        {{ src }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * 降级模式全局横幅 — 由 useAppStore.degradation 驱动。
   *
   * BE Resilience4j circuit breaker fallback 触发时,响应头 X-Degraded-Source: <src> 透传降级源。
   * Interceptor 写进 store,本组件 reactive 展示。每 15s 清理 TTL(60s)过期的源,源全清空后
   * banner 自动隐藏(circuit closed 后流量恢复)。
   *
   * 桌面顶部(LayoutHeader 上方)+ 移动 MobileAppBar 下方共用本组件,与 MaintenanceBanner 同位置。
   */
  import { onMounted, onUnmounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { TriangleAlert as WarningFilled } from '@lucide/vue'
  import { useAppStore } from '@/stores/app'

  const app = useAppStore()
  const { t } = useI18n({ useScope: 'global' })

  // 每 15s 清理过期源(TTL 60s,15s 间隔保证最长 75s 后隐藏 banner)
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    timer = setInterval(() => {
      app.pruneDegradationSources()
    }, 15_000)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })
</script>

<style scoped>
  .degradation-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    font-size: 13px;
    line-height: 1.4;
    background: color-mix(in srgb, var(--color-warning) 10%, var(--color-bg-card));
    color: var(--color-text-primary);
    border-bottom: 1px solid var(--color-warning);
  }
  .degradation-banner__icon {
    flex-shrink: 0;
    font-size: 18px;
    color: var(--color-warning);
  }
  .degradation-banner__text {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .degradation-banner__msg {
    margin-left: 6px;
    font-weight: 400;
  }
  .degradation-banner__chip {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 8px;
    border-radius: var(--radius-button);
    background: var(--color-fill-light);
    font-size: 11px;
    font-weight: 600;
  }
</style>
