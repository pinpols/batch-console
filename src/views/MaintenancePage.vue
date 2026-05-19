<template>
  <div class="maintenance-page">
    <div class="maintenance-page__inner">
      <el-icon class="maintenance-page__icon"><Tools /></el-icon>
      <h1 class="maintenance-page__title">{{ t('maintenance.pageTitle') }}</h1>
      <p class="maintenance-page__msg">
        {{ app.maintenance.message || t('maintenance.pageMessageFallback') }}
      </p>
      <p v-if="etaText" class="maintenance-page__eta">{{ etaText }}</p>
      <p class="maintenance-page__hint">{{ t('maintenance.pageHint') }}</p>
      <p class="maintenance-page__contact">{{ t('maintenance.pageContact') }}</p>
      <el-button
        type="primary"
        :icon="Refresh"
        :loading="checking"
        class="maintenance-page__retry"
        @click="checkNow"
      >
        {{ t('maintenance.pageRetry') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * 维护降级页 — 路由级 fallback。
   *
   * 用 useMaintenancePolling 30s 轮询(useAppStore.maintenance.enabled 变 false 时 watch 触发 redirect)
   * + 手动「立即重试」按钮兜底。本页本身不调用业务接口,避免被维护期 503 反复拒绝。
   */
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Tools, Refresh } from '@element-plus/icons-vue'
  import { useAppStore } from '@/stores/app'
  import { getMaintenanceStatus } from '@/api/system.maintenance'

  const app = useAppStore()
  const router = useRouter()
  const route = useRoute()
  const { t } = useI18n({ useScope: 'global' })

  const checking = ref(false)
  const now = ref(Date.now())
  let nowTimer: ReturnType<typeof setInterval> | null = null

  const etaText = computed(() => {
    const eta = app.maintenance.etaAt
    if (!eta) return ''
    const target = new Date(eta).getTime()
    if (Number.isNaN(target)) return ''
    const diffMs = target - now.value
    if (diffMs <= 0) return t('maintenance.etaPast')
    const mins = Math.round(diffMs / 60_000)
    if (mins < 60) return t('maintenance.etaInMinutes', { n: mins })
    return t('maintenance.etaInHours', { n: Math.round(mins / 60) })
  })

  async function checkNow() {
    checking.value = true
    try {
      const s = await getMaintenanceStatus()
      app.setMaintenance(s)
    } finally {
      checking.value = false
    }
  }

  // 退出维护期自动跳回原路径(redirect query)或首页
  watch(
    () => app.maintenance.enabled,
    (enabled) => {
      if (!enabled) {
        const back = (route.query.redirect as string) || '/'
        router.replace(back)
      }
    },
  )

  onMounted(() => {
    nowTimer = setInterval(() => {
      now.value = Date.now()
    }, 60_000)
  })
  onUnmounted(() => {
    if (nowTimer) clearInterval(nowTimer)
  })
</script>

<style scoped>
  .maintenance-page {
    display: grid;
    place-items: center;
    min-height: 100vh;
    min-height: 100dvh;
    padding: 24px;
    background: var(--color-bg-page, #f5f7fa);
  }
  .maintenance-page__inner {
    max-width: 480px;
    text-align: center;
    padding: 40px 32px;
    background: var(--color-bg-card, #fff);
    border-radius: 16px;
    box-shadow: 0 4px 24px rgb(0 0 0 / 6%);
  }
  .maintenance-page__icon {
    font-size: 48px;
    color: var(--color-warning, #f59e0b);
  }
  .maintenance-page__title {
    margin: 16px 0 8px;
    font-size: 22px;
    font-weight: 700;
  }
  .maintenance-page__msg {
    margin: 8px 0;
    font-size: 15px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }
  .maintenance-page__eta {
    margin: 6px 0;
    font-size: 14px;
    color: var(--color-warning, #b45309);
    font-weight: 600;
  }
  .maintenance-page__hint,
  .maintenance-page__contact {
    margin: 4px 0;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
  .maintenance-page__retry {
    margin-top: 20px;
  }
</style>
