<template>
  <el-header class="layout-header">
    <div class="layout-header__surface app-surface layout-panel">
      <div class="layout-header__left">
        <el-button text class="icon-button layout-header__fold" @click="app.toggleSidebar()">
          <el-icon>
            <Fold v-if="!app.sidebarCollapsed" />
            <Expand v-else />
          </el-icon>
        </el-button>
        <div class="page-meta">
          <div class="page-meta__title-row">
            <div class="page-meta__title-block">
              <el-breadcrumb v-if="breadcrumbs.length > 1" class="page-meta__crumb" separator="/">
                <el-breadcrumb-item
                  v-for="(c, i) in breadcrumbs"
                  :key="`${c.path}:${i}`"
                  :to="i < breadcrumbs.length - 1 ? c.path : undefined"
                >
                  {{ c.title }}
                </el-breadcrumb-item>
              </el-breadcrumb>
              <div class="page-meta__title">{{ currentTitle }}</div>
            </div>
            <el-tooltip content="复制当前页面完整链接（含查询参数）" placement="bottom">
              <el-button
                text
                class="icon-button page-meta__copy-link"
                aria-label="复制当前链接"
                @click="copyCurrentUrl"
              >
                <el-icon><Link /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
          <div v-if="showLayoutSubtitle" class="page-meta__subtitle">
            {{ currentSubtitle }}
          </div>
        </div>
      </div>

      <div class="layout-header__center">
        <LayoutTabs />
      </div>

      <div class="layout-header__right">
        <el-tooltip content="命令面板（⌘/Ctrl + K）" placement="bottom">
          <el-button
            text
            class="icon-button"
            aria-label="打开命令面板"
            @click="$emit('open-palette')"
          >
            <span class="palette-shortcut">{{ commandPaletteShortcutLabel }}</span>
          </el-button>
        </el-tooltip>
        <el-tooltip :content="themeToggleLabel" placement="bottom">
          <el-button
            text
            class="icon-button"
            :aria-label="themeToggleAriaLabel"
            @click="app.toggleTheme()"
          >
            <el-icon>
              <Monitor v-if="app.themePreference === 'system'" />
              <Sunny v-else-if="app.themePreference === 'light'" />
              <Moon v-else />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip :content="app.focusMode ? '退出全屏内容区' : '全屏内容区'" placement="bottom">
          <el-button
            text
            class="icon-button"
            aria-label="全屏内容区"
            @click="app.toggleFocusMode()"
          >
            <el-icon>
              <FullScreen />
            </el-icon>
          </el-button>
        </el-tooltip>
        <!-- 当前租户：常驻醒目展示，不藏在悬浮面板里 -->
        <div v-if="canSwitchTenant" class="tenant-chip tenant-chip--switch">
          <el-icon class="tenant-chip__icon"><OfficeBuilding /></el-icon>
          <span class="tenant-chip__label">租户</span>
          <TenantSelect
            :model-value="tenantIdInput"
            size="small"
            select-class="query-w-168"
            placeholder="切换租户"
            @update:model-value="handleTenantSwitch"
          />
          <el-tooltip content="复制 tenantId" placement="bottom">
            <span
              class="tenant-chip__copy"
              role="button"
              tabindex="0"
              aria-label="复制 tenantId"
              @click.stop="copyTenant"
              @keydown.enter.prevent.stop="copyTenant"
            >
              <el-icon><DocumentCopy /></el-icon>
            </span>
          </el-tooltip>
        </div>
        <div v-else class="tenant-chip tenant-chip--readonly">
          <el-icon class="tenant-chip__icon"><OfficeBuilding /></el-icon>
          <span class="tenant-chip__label">租户</span>
          <span class="tenant-chip__value" :title="tenantIdInput">{{ tenantIdInput }}</span>
          <el-tooltip content="复制 tenantId" placement="bottom">
            <span
              class="tenant-chip__copy"
              role="button"
              tabindex="0"
              aria-label="复制 tenantId"
              @click.stop="copyTenant"
              @keydown.enter.prevent.stop="copyTenant"
            >
              <el-icon><DocumentCopy /></el-icon>
            </span>
          </el-tooltip>
        </div>

        <div class="header-controls">
          <el-tooltip content="更多（悬浮展开）" placement="bottom">
            <el-button text class="icon-button header-controls__handle" aria-label="更多">
              <el-icon>
                <MoreFilled />
              </el-icon>
            </el-button>
          </el-tooltip>
          <div class="header-controls__content">
            <el-tag v-if="auth.role" size="small" type="info">{{ auth.role }}</el-tag>
            <el-dropdown trigger="click" placement="bottom-end" @command="onUserCommand">
              <span class="username username--clickable" tabindex="0">
                {{ auth.userInfo?.username ?? '未登录' }}
                <el-icon class="username__caret"><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="auth.role === 'ADMIN'" command="profile" :icon="Key">
                    权限自查
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" :icon="SwitchButton" divided>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
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
    DocumentCopy,
    Expand,
    Fold,
    FullScreen,
    Key,
    Link,
    Monitor,
    MoreFilled,
    Moon,
    OfficeBuilding,
    Sunny,
    SwitchButton,
  } from '@element-plus/icons-vue'
  import LayoutTabs from '@/layout/LayoutTabs.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import { useHeaderLogic } from '@/layout/composables/useHeaderLogic'

  defineEmits<{
    (e: 'open-palette'): void
  }>()

  const router = useRouter()
  const {
    app,
    auth,
    breadcrumbs,
    copyCurrentUrl,
    tenantIdInput,
    canSwitchTenant,
    handleTenantSwitch,
    copyTenant,
    currentTitle,
    currentSubtitle,
    showLayoutSubtitle,
    themeToggleLabel,
    themeToggleAriaLabel,
    commandPaletteShortcutLabel,
    handleLogout,
  } = useHeaderLogic()

  async function onUserCommand(command: string) {
    if (command === 'profile') {
      void router.push('/system/users')
      return
    }
    if (command === 'logout') {
      try {
        await ElMessageBox.confirm('确认退出登录?', '退出登录', {
          confirmButtonText: '退出',
          cancelButtonText: '取消',
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
    min-height: 48px;
    /* 与 .layout-main 同宽：顶栏卡片与主内容卡片左右外缘对齐（未悬停时一致） */
    padding-block: 0 !important;
    padding-inline: var(--layout-main-gutter) !important;
    background: transparent;
  }

  .layout-header__surface {
    min-height: 48px;
    height: auto;
    width: 100%;
    display: grid;
    /* 左随内容、中栏铺满：标签紧跟标题，避免大块中空 */
    grid-template-columns: auto 1fr auto;
    align-items: center;
    column-gap: 12px;
    padding-inline: var(--layout-content-inset-inline);
    padding-block: 5px;
    box-sizing: border-box;
    background: var(--layout-header-bg);
    backdrop-filter: blur(12px);
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

  /**
   * 折出文档流，避免把标题整体向右推；与顶栏 surface 内边距同源。
   */
  .layout-header__fold {
    --fold-w: min(22px, calc(var(--layout-content-inset-inline) - 1px));
    position: absolute;
    left: calc(0px - var(--layout-content-inset-inline));
    top: 50%;
    width: var(--fold-w);
    min-width: var(--fold-w) !important;
    height: 28px;
    padding: 0 !important;
    margin: 0;
    transform: translateY(-50%);
    z-index: 2;
  }

  .layout-header__fold :deep(.el-icon) {
    font-size: 16px;
  }

  .layout-header__center {
    grid-column: 2;
    justify-self: stretch;
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .layout-header__right {
    grid-column: 3;
    justify-self: stretch;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
    width: 100%;
  }

  .header-controls {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .header-controls__content {
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 10px;
    min-width: 0;
    overflow: hidden;
    transition: max-width 0.22s cubic-bezier(0.33, 1, 0.68, 1);
  }

  /* 默认收起：只保留 "更多" 把手 */
  .header-controls:not(:hover):not(:focus-within) .header-controls__content {
    max-width: 0;
    pointer-events: none;
    overflow: hidden;
  }

  /* 悬浮/聚焦展开 */
  .header-controls:hover .header-controls__content,
  .header-controls:focus-within .header-controls__content {
    max-width: min(1040px, 94vw);
    pointer-events: auto;
    overflow: visible;
  }

  @media (prefers-reduced-motion: reduce) {
    .header-controls__content {
      transition: none;
    }
  }

  .header-controls:hover .header-controls__handle,
  .header-controls:focus-within .header-controls__handle {
    opacity: 0.55;
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

  .page-meta__copy-link {
    flex-shrink: 0;
    margin-top: 0;
  }

  .page-meta__crumb {
    margin-bottom: 2px;
    --el-text-color-regular: var(--color-text-tertiary);
    --el-text-color-primary: var(--color-text-secondary);
  }

  .page-meta__crumb :deep(.el-breadcrumb__inner) {
    font-size: 12px;
    font-weight: 600;
  }

  .page-meta__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
  }

  .page-meta__subtitle {
    margin-top: 1px;
    color: var(--color-text-tertiary);
    font-size: 11px;
    line-height: 1.25;
  }

  .palette-shortcut {
    display: inline-block;
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.02em;
    color: var(--color-text-tertiary);
    padding: 2px 6px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    line-height: 1.2;
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
    padding: 4px 10px;
    border-radius: var(--radius-content);
    border: 1px solid color-mix(in srgb, var(--color-primary) 32%, var(--color-border) 68%);
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card) 90%);
    box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
    min-width: 0;
    flex-shrink: 0;
  }

  .tenant-chip--readonly {
    max-width: min(320px, 40vw);
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
    font-weight: 600;
    letter-spacing: 0.02em;
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
    border-radius: var(--radius-content);
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
    padding: 6px;
  }
</style>
