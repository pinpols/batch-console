<template>
  <nav class="mobile-tab-bar" role="navigation" :aria-label="t('nav.mobileTab.ariaLabel')">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="mobile-tab"
      :class="{ 'mobile-tab--active': isActive(tab.path) }"
    >
      <div class="mobile-tab__icon-wrap">
        <el-icon class="mobile-tab__icon">
          <component :is="tab.icon" />
        </el-icon>
        <span
          v-if="badgeOf(tab.path) > 0"
          class="mobile-tab__badge"
          :class="{ 'mobile-tab__badge--danger': isDangerBadge(tab.path) }"
        >
          {{ badgeOf(tab.path) > 99 ? '99+' : badgeOf(tab.path) }}
        </span>
      </div>
      <span class="mobile-tab__label">{{ t(tab.labelKey) }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Histogram, Stamp, WarningFilled, Monitor, Memo } from '@element-plus/icons-vue'
  import { useMobileBadgesStore } from '@/stores/mobileBadges'

  const route = useRoute()
  const badges = useMobileBadgesStore()
  const { t } = useI18n()

  const tabs = [
    { path: '/m/ops/summary', labelKey: 'nav.mobileTab.summary', icon: Histogram },
    { path: '/m/approvals', labelKey: 'nav.mobileTab.approvals', icon: Stamp },
    { path: '/m/alerts', labelKey: 'nav.mobileTab.alerts', icon: WarningFilled },
    { path: '/m/jobs', labelKey: 'nav.mobileTab.jobs', icon: Monitor },
    { path: '/m/catchup', labelKey: 'nav.mobileTab.catchup', icon: Memo },
  ]

  const isActive = computed(() => (path: string) => route.path.startsWith(path))

  function badgeOf(path: string): number {
    if (path === '/m/approvals') return badges.approvalsBadge
    if (path === '/m/alerts') return badges.alertsBadge
    if (path === '/m/jobs') return badges.jobsBadge
    return 0
  }

  function isDangerBadge(path: string): boolean {
    // 告警 + 失败任务用红色徽章；待审批用普通
    if (path === '/m/alerts') return badges.criticalAlerts > 0 || badges.openAlerts > 0
    if (path === '/m/jobs') return badges.failedJobs > 0
    return false
  }
</script>

<style scoped>
  .mobile-tab-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    background: var(--color-bg-card);
    border-top: 1px solid var(--color-border-light);
    padding-bottom: env(safe-area-inset-bottom, 0);
    z-index: 100;
    box-shadow: 0 -2px 12px rgb(15 23 42 / 6%);
  }

  .mobile-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 8px 4px 6px;
    color: var(--color-text-tertiary);
    text-decoration: none;
    font-size: 11px;
    transition:
      color 0.15s ease,
      transform 0.15s ease;
  }

  .mobile-tab:active {
    transform: scale(0.94);
  }

  .mobile-tab__icon-wrap {
    position: relative;
    display: inline-flex;
  }

  .mobile-tab__icon {
    font-size: 22px;
  }

  .mobile-tab__badge {
    position: absolute;
    top: -4px;
    right: -10px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--color-primary);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 18px;
    letter-spacing: 0;
    text-align: center;
    box-shadow: 0 0 0 2px var(--color-bg-card);
  }

  .mobile-tab__badge--danger {
    background: var(--el-color-danger);
  }

  .mobile-tab__label {
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .mobile-tab--active {
    color: var(--color-primary);
  }

  .mobile-tab--active .mobile-tab__label {
    font-weight: 700;
  }
</style>
