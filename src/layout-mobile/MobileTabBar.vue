<template>
  <nav class="mobile-tab-bar" role="navigation" aria-label="底部导航">
    <router-link
      v-for="tab in tabs"
      :key="tab.path"
      :to="tab.path"
      class="mobile-tab"
      :class="{ 'mobile-tab--active': isActive(tab.path) }"
    >
      <el-icon class="mobile-tab__icon">
        <component :is="tab.icon" />
      </el-icon>
      <span class="mobile-tab__label">{{ tab.label }}</span>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import { Histogram, Stamp, WarningFilled, Monitor, Memo } from '@element-plus/icons-vue'

  const route = useRoute()

  const tabs = [
    { path: '/m/ops/summary', label: '概览', icon: Histogram },
    { path: '/m/approvals', label: '审批', icon: Stamp },
    { path: '/m/alerts', label: '告警', icon: WarningFilled },
    { path: '/m/jobs', label: '任务', icon: Monitor },
    { path: '/m/catchup', label: '补跑', icon: Memo },
  ]

  const isActive = computed(() => (path: string) => route.path.startsWith(path))
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

  .mobile-tab__icon {
    font-size: 22px;
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
