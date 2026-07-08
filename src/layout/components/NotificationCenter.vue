<template>
  <el-popover
    :width="320"
    trigger="click"
    placement="bottom-end"
    popper-class="notif-center__popper"
    @show="onOpen"
  >
    <template #reference>
      <el-badge
        :value="total"
        :hidden="total === 0"
        :max="99"
        class="notif-center__badge"
        :type="severity"
      >
        <el-button text class="icon-button" :aria-label="bellAria">
          <el-icon><Bell /></el-icon>
        </el-button>
        <span
          v-if="hasNew"
          class="notif-center__new-dot"
          :aria-label="t('notificationCenter.newItems')"
        />
      </el-badge>
    </template>

    <div class="notif-center" role="region" :aria-label="t('notificationCenter.title')">
      <header class="notif-center__head">
        <span class="notif-center__title">{{ t('notificationCenter.title') }}</span>
      </header>

      <p v-if="total === 0" class="notif-center__empty">
        {{ t('notificationCenter.empty') }}
      </p>

      <ul v-else class="notif-center__list">
        <li v-if="pendingApprovals > 0">
          <button type="button" class="notif-center__row" @click="go('/approvals')">
            <el-icon class="notif-center__icon"><Stamp /></el-icon>
            <span class="notif-center__label">{{ t('notificationCenter.pendingApprovals') }}</span>
            <el-tag size="small" type="warning" effect="light">{{ pendingApprovals }}</el-tag>
            <el-icon class="notif-center__chev"><ArrowRight /></el-icon>
          </button>
        </li>
        <li v-if="openAlerts > 0">
          <button
            type="button"
            class="notif-center__row"
            @click="go('/observability/alerts', { status: 'OPEN' })"
          >
            <el-icon class="notif-center__icon" :class="{ 'is-critical': criticalAlerts > 0 }">
              <Warning />
            </el-icon>
            <span class="notif-center__label">
              {{ t('notificationCenter.openAlerts') }}
              <small v-if="criticalAlerts > 0" class="notif-center__critical">
                {{ t('notificationCenter.criticalSuffix', { n: criticalAlerts }) }}
              </small>
            </span>
            <el-tag size="small" :type="criticalAlerts > 0 ? 'danger' : 'warning'" effect="light">{{
              openAlerts
            }}</el-tag>
            <el-icon class="notif-center__chev"><ArrowRight /></el-icon>
          </button>
        </li>
        <li v-if="failedJobs > 0">
          <button
            type="button"
            class="notif-center__row"
            @click="go('/monitor/job-instances', { status: 'FAILED' })"
          >
            <el-icon class="notif-center__icon is-critical"><CircleClose /></el-icon>
            <span class="notif-center__label">{{ t('notificationCenter.failedJobs') }}</span>
            <el-tag size="small" type="danger" effect="light">{{ failedJobs }}</el-tag>
            <el-icon class="notif-center__chev"><ArrowRight /></el-icon>
          </button>
        </li>
      </ul>

      <footer class="notif-center__foot">
        <el-button text type="primary" size="small" @click="go('/ops/summary')">
          {{ t('notificationCenter.viewOpsSummary') }}
        </el-button>
      </footer>
    </div>

    <!-- 屏幕阅读器实时播报待处理总数 -->
    <span class="sr-only" aria-live="polite">{{
      total > 0 ? t('notificationCenter.srSummary', { n: total }) : ''
    }}</span>
  </el-popover>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import {
    Bell,
    Stamp,
    TriangleAlert as Warning,
    CircleX as CircleClose,
    ArrowRight,
  } from 'lucide-vue-next'

  const props = defineProps<{
    pendingApprovals: number
    openAlerts: number
    criticalAlerts: number
    failedJobs: number
    /** 当前用户标识,用于「已读」分桶 */
    userId?: string
  }>()

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()

  const total = computed(() => props.pendingApprovals + props.openAlerts + props.failedJobs)

  const severity = computed<'danger' | 'warning' | 'info'>(() => {
    if (props.criticalAlerts > 0 || props.failedJobs > 0) return 'danger'
    if (total.value > 0) return 'warning'
    return 'info'
  })

  const bellAria = computed(() =>
    total.value > 0
      ? t('notificationCenter.srSummary', { n: total.value })
      : t('notificationCenter.empty'),
  )

  // 「有新增」红点:与上次打开通知中心时记录的总数对比,变多则提示。
  function seenKey(): string {
    return `bc:notif-seen:${props.userId || 'anon'}`
  }
  function readSeen(): number {
    try {
      const v = Number(localStorage.getItem(seenKey()))
      return Number.isFinite(v) ? v : 0
    } catch {
      return 0
    }
  }
  const lastSeen = ref(readSeen())
  const hasNew = computed(() => total.value > lastSeen.value)

  function onOpen() {
    lastSeen.value = total.value
    try {
      localStorage.setItem(seenKey(), String(total.value))
    } catch {
      /* localStorage 不可用 — 仅内存态 */
    }
  }

  function go(path: string, query?: Record<string, string>) {
    void router.push({ path, query })
  }
</script>

<style scoped>
  .notif-center__badge {
    position: relative;
  }

  .notif-center__badge :deep(.el-badge__content) {
    top: 4px;
    right: 5px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border: 0;
    border-radius: 999px;
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 700;
    line-height: 16px;
    box-shadow: 0 0 0 2px var(--layout-header-bg);
  }

  .notif-center__new-dot {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-danger, #f56c6c);
    box-shadow: 0 0 0 2px var(--color-bg-card, #fff);
    animation: notif-pulse 1.6s ease-in-out infinite;
  }

  @keyframes notif-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .notif-center__new-dot {
      animation: none;
    }
  }

  .notif-center__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-sm, 8px);
    border-bottom: 1px solid var(--color-border-light);
  }

  .notif-center__title {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .notif-center__empty {
    padding: var(--space-lg, 16px) 0;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm, 13px);
  }

  .notif-center__list {
    list-style: none;
    margin: var(--space-sm, 8px) 0;
    padding: 0;
  }

  .notif-center__row {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 8px);
    width: 100%;
    padding: var(--space-sm, 8px) var(--space-xs, 6px);
    border: none;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-sm, 6px);
    color: var(--color-text-primary);
    font-size: var(--font-size-sm, 13px);
    text-align: left;
  }

  .notif-center__row:hover {
    background: var(--color-bg-hover, #f5f7fa);
  }

  .notif-center__icon {
    color: var(--color-warning);
    flex-shrink: 0;
  }

  .notif-center__icon.is-critical {
    color: var(--color-danger);
  }

  .notif-center__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .notif-center__critical {
    color: var(--color-danger);
    margin-left: 4px;
  }

  .notif-center__chev {
    color: var(--color-text-placeholder);
    flex-shrink: 0;
  }

  .notif-center__foot {
    padding-top: var(--space-sm, 8px);
    border-top: 1px solid var(--color-border-light);
    text-align: center;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
