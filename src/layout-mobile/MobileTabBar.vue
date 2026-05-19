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
    Histogram,
    DataAnalysis,
    Stamp,
    Memo,
    Warning,
    WarningFilled,
    Monitor,
    Operation,
    Cpu,
    Coin,
  } from '@element-plus/icons-vue'
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
    // 告警 + 失败任务用红色徽章；待审批用普通
    if (path === '/m/alerts') return badges.criticalAlerts > 0 || badges.openAlerts > 0
    if (path === '/m/jobs') return badges.failedJobs > 0
    return false
  }
</script>

<style scoped>
  /* iOS Tab Bar:毛玻璃 + 极细顶分隔线 + 跟随 home indicator 留白 + 顶向阴影抬起 */
  .mobile-tab-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    background: color-mix(in srgb, #ffffff 78%, transparent 22%);
    backdrop-filter: saturate(180%) blur(24px);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
    border-top: 0.5px solid rgb(60 60 67 / 18%);
    box-shadow: 0 -2px 12px rgb(0 0 0 / 6%);
    padding-bottom: env(safe-area-inset-bottom, 0);
    z-index: 100;
  }

  /* 暗色:全黑底容易跟内容糊在一起,加更明显顶分隔 + 强阴影 + 顶部高光线 */
  :global(html.dark) .mobile-tab-bar {
    background: color-mix(in srgb, #1c1c1e 82%, transparent 18%);
    border-top: 0.5px solid rgb(84 84 88 / 75%);
    box-shadow:
      0 -1px 0 rgb(255 255 255 / 4%),
      0 -8px 24px rgb(0 0 0 / 50%);
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

  :global(html.dark) .mobile-tab {
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

  :global(html.dark) .mobile-tab__badge {
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
