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
          <component :is="isActive(tab.path) ? tab.iconFilled : tab.icon" />
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
  import {
    BarChart3 as Histogram,
    BarChart3 as DataAnalysis,
    Stamp,
    ClipboardList as Memo,
    TriangleAlert as Warning,
    TriangleAlert as WarningFilled,
    Monitor,
    SlidersHorizontal as Operation,
    Cpu,
    Coins as Coin,
  } from 'lucide-vue-next'
  import { useMobileBadgesStore } from '@/stores/mobileBadges'

  const route = useRoute()
  const badges = useMobileBadgesStore()
  const { t } = useI18n({ useScope: 'global' })

  /**
   * 移动端底部 Tab 设计:**5 主功能 + 5 应急深链**
   *
   * 这里只放最高频的 5 个 Tab(告警 / 审批 / 概览 / 作业 / Worker),刻意保持简洁。
   *
   * 另外 5 个路由(/m/catchup、/m/files、/m/outbox、/m/logs、/m/jobs/:id)在 router
   * 里注册但**不放 Tab**,设计为**应急深链入口**:
   *   - PWA 推送通知点开 → /m/catchup、/m/outbox
   *   - 扫码 / 邮件 / 上游链接 → /m/files、/m/logs
   *   - Tab 点击作业 → drill 到 /m/jobs/:id
   *
   * 这是产品决策,不是遗漏。改动前请先确认是否需要把某条提升为常驻 Tab。
   */
  // iOS Tab Bar:每个 tab 给 line/filled 一对图标,active 时切换到 filled
  // Element Plus icons 集成对偶有限,这里挑接近 SF Symbols line/fill 视觉的成对图标
  const tabs = [
    {
      path: '/m/alerts',
      labelKey: 'nav.mobileTab.alerts',
      icon: Warning,
      iconFilled: WarningFilled,
    },
    {
      path: '/m/approvals',
      labelKey: 'nav.mobileTab.approvals',
      icon: Memo,
      iconFilled: Stamp,
    },
    {
      path: '/m/ops/summary',
      labelKey: 'nav.mobileTab.summary',
      icon: DataAnalysis,
      iconFilled: Histogram,
    },
    {
      path: '/m/jobs',
      labelKey: 'nav.mobileTab.jobs',
      icon: Operation,
      iconFilled: Monitor,
    },
    {
      path: '/m/workers',
      labelKey: 'nav.mobileTab.workers',
      icon: Coin,
      iconFilled: Cpu,
    },
  ]

  const isActive = computed(() => (path: string) => route.path.startsWith(path))

  function badgeOf(path: string): number {
    if (path === '/m/approvals') return badges.approvalsBadge
    if (path === '/m/alerts') return badges.alertsBadge
    if (path === '/m/jobs') return badges.jobsBadge
    return 0
  }

  function isDangerBadge(path: string): boolean {
    // 只有真正的待办/告警才显示导航徽章；历史失败数在运维摘要中查看。
    if (path === '/m/alerts') return badges.criticalAlerts > 0 || badges.openAlerts > 0
    return false
  }
</script>

<style scoped>
  /* iOS Liquid Glass Tab Bar:毛玻璃底 + 内顶高光 + rim glow + safe-area 留白 */
  .mobile-tab-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    background: color-mix(in srgb, #ffffff 72%, transparent 28%);
    backdrop-filter: saturate(180%) blur(28px);
    -webkit-backdrop-filter: saturate(180%) blur(28px);
    border-top: 0.5px solid rgb(60 60 67 / 18%);
    /* Liquid Glass:
       1) inset 顶部 1px 半透白 → 玻璃顶缘折射 highlight
       2) inset 顶部 6px 极淡白渐变 → specular(模拟漫反射)
       3) 外向上阴影抬起 */
    box-shadow:
      inset 0 0.5px 0 rgb(255 255 255 / 80%),
      inset 0 6px 12px rgb(255 255 255 / 20%),
      0 -2px 12px rgb(0 0 0 / 6%);
    padding-bottom: env(safe-area-inset-bottom, 0);
    z-index: var(--z-tab-bar);
    position: fixed; /* override 安全 */
  }

  /* rim light:左右两端微淡彩色辉光 — Liquid Glass 标志性边缘 chromatic aberration */
  .mobile-tab-bar::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background:
      radial-gradient(circle at 0% 0%, rgb(0 122 255 / 8%) 0%, transparent 35%),
      radial-gradient(circle at 100% 0%, rgb(90 200 250 / 8%) 0%, transparent 35%);
    mix-blend-mode: screen;
  }

  /* 暗色 Liquid Glass:把 inset 高光透明度调高一倍,黑底上才看得见折射 */
  :global(html.dark .mobile-tab-bar) {
    background: color-mix(in srgb, #10151d 88%, transparent 12%);
    border-top: 0.5px solid rgb(148 163 184 / 28%);
    box-shadow:
      inset 0 0.5px 0 rgb(255 255 255 / 16%),
      inset 0 6px 12px rgb(96 165 250 / 5%),
      0 -1px 0 rgb(255 255 255 / 4%),
      0 -8px 24px rgb(0 0 0 / 50%);
  }

  :global(html.dark .mobile-tab-bar::before) {
    background:
      radial-gradient(circle at 0% 0%, rgb(10 132 255 / 14%) 0%, transparent 40%),
      radial-gradient(circle at 100% 0%, rgb(94 92 230 / 12%) 0%, transparent 40%);
  }

  .mobile-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 7px 4px 5px;
    color: rgb(60 60 67 / 60%);
    text-decoration: none;
    font-size: 10px;
    letter-spacing: 0.01em;
    font-weight: 500;
    transition: color 0.1s ease;
  }

  :global(html.dark .mobile-tab) {
    color: rgb(235 235 245 / 60%);
  }

  .mobile-tab:active {
    opacity: 0.5;
  }

  .mobile-tab__icon-wrap {
    position: relative;
    display: inline-flex;
  }

  .mobile-tab__icon {
    font-size: 26px;
  }

  .mobile-tab__badge {
    position: absolute;
    top: -5px;
    right: -10px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: #ff3b30;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    letter-spacing: 0;
    text-align: center;
    box-shadow: 0 0 0 1.5px #ffffff;
  }

  :global(html.dark .mobile-tab__badge) {
    box-shadow: 0 0 0 1.5px #1c1c1e;
  }

  .mobile-tab__badge--danger {
    background: #ff3b30;
  }

  .mobile-tab__label {
    font-weight: 500;
  }

  .mobile-tab--active {
    color: #007aff;
  }

  .mobile-tab--active .mobile-tab__label {
    font-weight: 600;
  }
</style>
