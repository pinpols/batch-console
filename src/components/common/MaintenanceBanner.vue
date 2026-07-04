<template>
  <div v-if="app.maintenance.enabled" class="maintenance-banner" :class="toneClass" role="alert">
    <el-icon class="maintenance-banner__icon">
      <Warning />
    </el-icon>
    <div class="maintenance-banner__text">
      <strong>{{ headline }}</strong>
      <span v-if="app.maintenance.message" class="maintenance-banner__msg">
        {{ app.maintenance.message }}
      </span>
      <span v-if="etaText" class="maintenance-banner__eta">· {{ etaText }}</span>
      <!-- 受影响子系统 chip:有 affectedServices 列表时按 service 展示,否则不渲染(banner 走 message 兜底) -->
      <span
        v-for="svc in app.maintenance.affectedServices"
        :key="svc"
        class="maintenance-banner__svc"
      >
        {{ svc }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * 维护模式全局横幅 — 由 useAppStore.maintenance 驱动。
   *
   * 桌面顶部(LayoutHeader 上方)+ 移动端 MobileAppBar 下方共用本组件。enabled=false 时
   * 整个组件不渲染(v-if),零成本。
   */
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { TriangleAlert as Warning } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'

  const app = useAppStore()
  const { t } = useI18n({ useScope: 'global' })

  const toneClass = computed(() => {
    if (app.maintenance.adminBypass) return 'maintenance-banner--admin'
    return app.maintenance.readOnly ? 'maintenance-banner--readonly' : 'maintenance-banner--blocked'
  })

  const headline = computed(() => {
    if (app.maintenance.adminBypass) return t('maintenance.bannerAdminBypass')
    return app.maintenance.readOnly
      ? t('maintenance.bannerReadonly')
      : t('maintenance.bannerBlocked')
  })

  // ETA 倒计时 — 每分钟刷新一次,精度够,避免频繁 reactivity
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now()
    }, 60_000)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  const etaText = computed(() => {
    const eta = app.maintenance.etaAt
    if (!eta) return ''
    const target = new Date(eta).getTime()
    if (Number.isNaN(target)) return ''
    const diffMs = target - now.value
    if (diffMs <= 0) return t('maintenance.etaPast')
    const mins = Math.round(diffMs / 60_000)
    if (mins < 60) return t('maintenance.etaInMinutes', { n: mins })
    const hours = Math.round(mins / 60)
    return t('maintenance.etaInHours', { n: hours })
  })
</script>

<style scoped>
  .maintenance-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    font-size: 13px;
    line-height: 1.4;
    border-bottom: 1px solid transparent;
  }
  .maintenance-banner--blocked {
    background: var(--color-danger-light, #fee2e2);
    color: var(--color-danger, #b91c1c);
    border-bottom-color: rgb(185 28 28 / 18%);
  }
  .maintenance-banner--readonly {
    background: var(--color-warning-light, #fef3c7);
    color: var(--color-warning, #b45309);
    border-bottom-color: rgb(180 83 9 / 18%);
  }
  .maintenance-banner--admin {
    background: var(--color-info-light, #e0e7ff);
    color: var(--color-info, #1e40af);
    border-bottom-color: rgb(30 64 175 / 18%);
  }
  .maintenance-banner__svc {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 8px;
    border-radius: 10px;
    background: rgb(255 255 255 / 60%);
    font-size: 11px;
    font-weight: 600;
  }
  .maintenance-banner__icon {
    flex-shrink: 0;
    font-size: 18px;
  }
  .maintenance-banner__text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .maintenance-banner__msg {
    margin-left: 6px;
    font-weight: 400;
  }
  .maintenance-banner__eta {
    margin-left: 6px;
    opacity: 0.8;
  }
</style>
