<template>
  <el-header class="layout-header">
    <div class="layout-header__surface app-surface layout-panel">
      <div class="layout-header__left">
        <div class="nav-arrows">
          <button
            type="button"
            class="nav-arrow"
            :aria-label="t('nav.back')"
            @click="router.back()"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <button
            type="button"
            class="nav-arrow"
            :aria-label="t('nav.forward')"
            @click="router.forward()"
          >
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
        <div class="page-meta">
          <el-breadcrumb class="page-meta__crumb" separator="›">
            <el-breadcrumb-item
              v-for="(c, i) in breadcrumbs"
              :key="`${c.path}:${i}`"
              :to="c.path && i < breadcrumbs.length - 1 ? c.path : undefined"
            >
              {{ c.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
      </div>

      <div class="layout-header__right">
        <div
          v-if="canSwitchTenant"
          class="tenant-chip tenant-chip--switch"
          role="group"
          :aria-label="t('nav.tenantSwitcherAria')"
        >
          <el-icon class="tenant-chip__icon"><OfficeBuilding /></el-icon>
          <TenantSelect
            :model-value="tenantIdInput"
            size="small"
            select-class="tenant-chip__select"
            :placeholder="t('nav.switchTenantPlaceholder')"
            @update:model-value="handleTenantSwitch"
          />
        </div>
        <div v-else class="tenant-chip tenant-chip--readonly">
          <el-icon class="tenant-chip__icon"><OfficeBuilding /></el-icon>
          <span class="tenant-chip__value" :title="tenantIdInput">{{ tenantIdInput }}</span>
        </div>

        <el-tooltip :content="`${t('nav.commandPalette')}(⌘/Ctrl + K)`" placement="bottom">
          <button
            type="button"
            class="header-search"
            :aria-label="t('nav.openCommandPalette')"
            @click="$emit('open-palette')"
          >
            <el-icon><Search /></el-icon>
            <span>{{ t('nav.search') }}</span>
            <kbd>{{ commandPaletteShortcutLabel }}</kbd>
          </button>
        </el-tooltip>

        <NotificationCenter
          class="layout-header__bell"
          :pending-approvals="badges.pendingApprovals"
          :open-alerts="badges.openAlerts"
          :critical-alerts="badges.criticalAlerts"
          :failed-jobs="badges.failedJobs"
          :user-id="auth.userInfo?.userId"
        />

        <el-tooltip :content="localeToggleTooltip" placement="bottom">
          <button type="button" class="icon-button header-icon" @click="toggleLocale">
            {{ localeChipLabel }}
          </button>
        </el-tooltip>

        <el-tooltip :content="t('nav.mobilePreview')" placement="bottom">
          <button type="button" class="icon-button header-icon" @click="openMobilePreview">
            <el-icon><Iphone /></el-icon>
          </button>
        </el-tooltip>

        <el-tooltip :content="t('nav.openDocsTooltip')" placement="bottom">
          <button type="button" class="icon-button header-icon" @click="openDocs">
            <el-icon><Reading /></el-icon>
          </button>
        </el-tooltip>

        <el-tooltip :content="themeActionLabel" placement="bottom">
          <button type="button" class="icon-button header-icon" @click="app.toggleTheme()">
            <el-icon><component :is="themeToolIcon" /></el-icon>
          </button>
        </el-tooltip>

        <div class="user-area">
          <el-tag v-if="auth.role" size="small" type="info" class="user-area__role">
            {{ auth.role }}
          </el-tag>
          <el-dropdown
            trigger="click"
            placement="bottom-end"
            :hide-on-click="true"
            @command="onUserCommand"
          >
            <span class="username username--clickable" tabindex="0">
              {{ auth.userInfo?.username ?? t('nav.notLoggedIn') }}
              <el-icon class="username__caret"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="auth.role === 'ADMIN'" command="profile" :icon="Key">
                  {{ t('nav.permissionAudit') }}
                </el-dropdown-item>
                <el-dropdown-item command="onboarding" :icon="Compass">
                  {{ t('nav.onboarding') }}
                </el-dropdown-item>
                <el-dropdown-item command="logout" :icon="SwitchButton" divided>
                  {{ t('nav.logout') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
  </el-header>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { ElMessageBox } from 'element-plus'
  import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    Compass,
    Iphone,
    Key,
    Monitor,
    Moon,
    OfficeBuilding,
    Reading,
    Search,
    Sunny,
    SwitchButton,
  } from '@element-plus/icons-vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import NotificationCenter from './NotificationCenter.vue'
  import { useHeaderLogic } from '@/layout/composables/useHeaderLogic'
  import { computed, onMounted, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useLocale } from '@/composables/useLocale'
  import { useMobileBadgesStore } from '@/stores/mobileBadges'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'

  const { t } = useI18n({ useScope: 'global' })
  const { current: currentLocale, setLocale } = useLocale()

  // 只有两种语言,直接切而不是下拉:tooltip 显示"切到对端"提示
  const localeToggleTooltip = computed(() =>
    currentLocale.value === 'zh-CN' ? t('layoutHeader.switchToEn') : t('layoutHeader.switchToZh'),
  )
  const localeChipLabel = computed(() => (currentLocale.value === 'zh-CN' ? 'EN' : '中'))
  const themeToolIcon = computed(() => {
    if (app.themePreference === 'system') return Monitor
    return app.themePreference === 'light' ? Sunny : Moon
  })
  // 与「打开文档中心 / Switch to English / 进入全屏」对齐，统一动词开头。
  // 点击后实际切到的是 next preference，所以这里展示的是下一步动作，不是当前状态。
  const themeActionLabel = computed(() => {
    if (app.themePreference === 'light') return t('nav.switchToThemeDark')
    if (app.themePreference === 'dark') return t('nav.switchToThemeSystem')
    return t('nav.switchToThemeLight')
  })

  function toggleLocale() {
    setLocale(currentLocale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
  }

  defineEmits<{
    (e: 'open-palette'): void
  }>()

  // 文档站入口:dev 和 prod 都直接打开根路径 /docs/。
  //
  // 注意:vitepress dev (vitepress dev) 跨仓 srcDir + cleanUrls 模式下,rewrites
  // (README.md → index.md)实测不生效,所有目录入口客户端路由 404。要本地浏览
  // 文档请用 `npm run docs:serve`(= build + preview)而不是 `npm run docs:dev`,
  // preview 是基于真 build 产物,行为与 prod 一致。
  const docsUrl = import.meta.env.DEV ? 'http://localhost:5174/docs/' : '/docs/'

  function openDocs() {
    window.open(docsUrl, '_blank', 'noopener')
  }

  function openMobilePreview() {
    window.open('/m/ops/summary', '_blank', 'noopener,noreferrer,width=430,height=860')
  }

  const router = useRouter()
  const {
    app,
    auth,
    breadcrumbs,
    tenantIdInput,
    canSwitchTenant,
    handleTenantSwitch,
    commandPaletteShortcutLabel,
    handleLogout,
  } = useHeaderLogic()

  // 通知中心:复用 mobileBadges store(getOpsSummary)的待办计数;桌面顶栏展开分类面板。
  const badges = useMobileBadgesStore()
  const tenant = useTenantStore()
  onMounted(() => void badges.refresh())
  watch(
    () => tenant.tenantId,
    () => void badges.refresh(),
  )
  // 30s 轮询 — 与 mobile layout 同节奏;后台切到隐藏会自动停(useAutoRefresh 内置)
  useAutoRefresh(() => badges.refresh(), 30_000)

  async function onUserCommand(command: string) {
    if (command === 'profile') {
      void router.push('/system/users')
      return
    }
    if (command === 'onboarding') {
      // 清掉"已完成"标记 + 立即启动 tour
      const { resetOnboarding, startOnboarding } = await import('@/composables/useOnboardingTour')
      resetOnboarding()
      startOnboarding()
      return
    }
    if (command === 'logout') {
      try {
        await ElMessageBox.confirm(t('nav.confirmLogout'), t('nav.logout'), {
          confirmButtonText: t('nav.logout'),
          cancelButtonText: t('common.cancel'),
          type: 'warning',
        })
      } catch {
        return
      }
      handleLogout()
    }
  }
</script>

<style scoped>
  .layout-header {
    --el-header-padding: 0;
    --el-header-height: auto;
    height: auto;
    min-height: 52px;
    /* 与 .layout-main 同宽：顶栏卡片与主内容卡片左右外缘对齐（未悬停时一致） */
    padding-block: 0 !important;
    padding-inline: var(--layout-main-gutter) !important;
    background: transparent;
  }

  .layout-header__surface {
    min-height: 52px;
    height: auto;
    width: 100%;
    display: grid;
    grid-template-columns: minmax(180px, auto) minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 10px;
    padding-inline: var(--layout-content-inset-inline);
    padding-block: 6px;
    box-sizing: border-box;
    background: var(--layout-header-bg);
    backdrop-filter: blur(14px);
    position: relative;
  }

  .layout-header__left {
    position: relative;
    grid-column: 1;
    justify-self: stretch;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    width: 100%;
  }

  /* 顶栏左侧 ← → 导航箭头(还原设计) */
  .nav-arrows {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .nav-arrow {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-button);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      color var(--motion-duration-sm) var(--motion-ease-standard),
      border-color var(--motion-duration-sm) var(--motion-ease-standard),
      background-color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .nav-arrow:hover {
    color: var(--color-text-primary);
    border-color: var(--color-border-strong, var(--color-border));
    background: var(--color-bg-hover, transparent);
  }

  .nav-arrow :deep(.el-icon) {
    font-size: 15px;
  }

  .layout-header__center {
    grid-column: 2;
    justify-self: stretch;
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .layout-header__right {
    grid-column: 3;
    justify-self: stretch;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
    width: 100%;
  }

  /* 用户区:role tag + 用户名下拉,常驻显示,不再悬浮收缩 */
  .user-area {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex-shrink: 0;
  }

  .user-area__role {
    flex-shrink: 0;
  }

  .page-meta {
    min-width: 0;
  }

  .page-meta__title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .page-meta__title-block {
    flex: 1;
    min-width: 0;
  }

  .page-meta__crumb {
    --el-text-color-regular: var(--color-text-secondary);
    --el-text-color-primary: var(--color-text-primary);
    line-height: 1.2;
  }

  .page-meta__crumb :deep(.el-breadcrumb__inner) {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .page-meta__crumb :deep(.el-breadcrumb__separator) {
    color: var(--color-text-tertiary);
    margin: 0 8px;
  }

  /* 末级(当前页)加重、主色文字 */
  .page-meta__crumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
    color: var(--color-text-primary);
    font-weight: 650;
  }

  .page-meta__title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
  }

  .page-meta__link {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-button);
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
  }

  .page-meta__link:hover {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }

  .header-search {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: 170px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-button);
    background: color-mix(in srgb, var(--color-bg-elevated) 74%, transparent);
    color: var(--color-text-tertiary);
    font-size: 13px;
    cursor: pointer;
    outline: none;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .header-search:hover,
  .header-search:focus-visible {
    color: var(--color-text-primary);
    border-color: color-mix(in srgb, var(--color-primary) 48%, var(--color-border) 52%);
    background: color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-elevated) 91%);
  }

  .header-search span {
    min-width: 0;
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-search kbd {
    flex-shrink: 0;
    min-width: 31px;
    padding: 1px 5px;
    border: 1px solid var(--color-border-light);
    border-radius: 5px;
    background: color-mix(in srgb, var(--color-bg-card) 70%, transparent);
    color: var(--color-text-tertiary);
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
  }

  .username {
    flex-shrink: 0;
    color: var(--color-text-secondary);
    font-size: 13px;
    white-space: nowrap;
  }

  .username--clickable {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    border-radius: 6px;
    padding: 2px 6px;
    outline: none;
    transition: background var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .username--clickable:hover,
  .username--clickable:focus-visible {
    background: var(--color-bg-elevated, color-mix(in srgb, var(--color-primary) 8%, transparent));
    color: var(--color-text-primary);
  }

  .username__caret {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  /* 当前租户常驻 chip：醒目但不喧宾夺主 */
  .tenant-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 8px;
    border-radius: var(--radius-button);
    border: 1px solid color-mix(in srgb, var(--color-primary) 28%, var(--color-border) 72%);
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-bg-elevated) 92%);
    box-shadow: inset 0 1px 0 var(--layout-panel-inset-highlight);
    min-width: 0;
    flex-shrink: 0;
  }

  .tenant-chip--readonly {
    max-width: min(320px, 40vw);
  }

  .tenant-chip--switch :deep(.tenant-chip__select) {
    width: 154px;
  }

  .tenant-chip--switch :deep(.el-select__wrapper) {
    min-height: 24px;
    border-radius: calc(var(--radius-button) - 2px);
    background: color-mix(in srgb, var(--color-bg-canvas) 72%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }

  .tenant-chip--switch :deep(.el-select__wrapper:hover),
  .tenant-chip--switch :deep(.el-select__wrapper.is-focused) {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 45%, transparent);
  }

  .tenant-chip--switch :deep(.el-select__selected-item) {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-text-primary);
  }

  .tenant-chip__icon {
    flex-shrink: 0;
    color: var(--color-primary);
    font-size: 15px;
  }

  .tenant-chip__label {
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0;
  }

  .tenant-chip__value {
    min-width: 0;
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tenant-chip__copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    margin-left: 2px;
    border-radius: var(--radius-button);
    color: var(--color-text-tertiary);
    cursor: pointer;
    outline: none;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .tenant-chip__copy:hover {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 14%, transparent 86%);
  }

  @media (max-width: 960px) {
    .tenant-chip--readonly {
      max-width: 34vw;
    }
    .tenant-chip__label {
      display: none;
    }
  }

  .icon-button {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    min-width: 32px;
    padding: 0;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-button);
    background: color-mix(in srgb, var(--color-bg-elevated) 74%, transparent);
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    outline: none;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .icon-button:hover,
  .icon-button:focus-visible {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border) 60%);
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-elevated) 90%);
  }

  .header-icon :deep(.el-icon),
  .header-icon .el-icon {
    font-size: 15px;
  }

  /* Bell badge:el-badge 默认 offset 偏外,这里挤回 icon 右上角对齐其它 icon-button */
  .layout-header__bell :deep(.el-badge__content) {
    transform: translate(-2px, 2px) scale(0.85);
    transform-origin: 100% 0%;
  }

  .locale-chip {
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    min-width: 20px;
    text-align: center;
    color: var(--el-text-color-regular);
  }

  /* 工具菜单里语言项的「EN / 中」chip：占位与 el-dropdown-item 的 icon 等宽对齐，
     避免和后面的文字粘在一起渲染成「ENSwitch to English」。 */
  :deep(.el-dropdown-menu__item) .locale-chip-mini {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1em;
    min-width: 1em;
    height: 1em;
    margin-right: 5px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0;
    color: var(--color-text-secondary);
  }
</style>
