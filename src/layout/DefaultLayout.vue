<template>
  <el-container class="layout-root" :class="{ 'is-focus': app.focusMode }">
    <LayoutSidebar />

    <el-container class="layout-shell">
      <LayoutHeader @open-palette="paletteOpen = true" />

      <el-main class="layout-main">
        <!-- 外层 surface 固定不缩放；内层 body 为实际纵向滚动层（整页不滚）。 -->
        <div class="layout-main__surface layout-panel">
          <div v-if="app.focusMode" class="focus-fab">
            <el-tooltip content="退出全屏（Esc）" placement="left">
              <el-button circle class="focus-fab__btn" @click="app.setFocusMode(false)">
                <el-icon>
                  <FullScreen />
                </el-icon>
              </el-button>
            </el-tooltip>
          </div>
          <div class="layout-main__body">
            <div class="layout-main__content">
              <RouterView v-slot="{ Component, route: r }">
                <ErrorBoundary :route-key="r.fullPath">
                  <KeepAlive :max="20">
                    <component :is="Component" :key="r.fullPath" />
                  </KeepAlive>
                </ErrorBoundary>
              </RouterView>
            </div>
          </div>
        </div>
      </el-main>
    </el-container>

    <CommandPalette v-model="paletteOpen" :groups="visibleGroups" :recent-tabs="tabsStore.list" />
    <SwUpdatePrompt />
  </el-container>
</template>

<script setup lang="ts">
  import { watch, onMounted, onUnmounted } from 'vue'
  import { useRoute } from 'vue-router'
  import { FullScreen } from '@element-plus/icons-vue'
  import CommandPalette from '@/components/common/CommandPalette.vue'
  import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
  import SwUpdatePrompt from '@/components/common/SwUpdatePrompt.vue'
  import LayoutSidebar from '@/layout/LayoutSidebar.vue'
  import LayoutHeader from '@/layout/components/LayoutHeader.vue'
  import { useHeaderLogic } from '@/layout/composables/useHeaderLogic'
  import { useNetworkStatus } from '@/composables/useNetworkStatus'
  import { shouldShowOnboarding, startOnboarding } from '@/composables/useOnboardingTour'

  const route = useRoute()
  const { app, tabsStore, paletteOpen, visibleGroups } = useHeaderLogic()
  // 全局网络状态监听:断网/恢复弹消息(配合 axios retry,短抖用户无感)
  useNetworkStatus()

  function onGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable) return
      e.preventDefault()
      paletteOpen.value = true
      return
    }
    if (!app.focusMode) return
    if (e.key === 'Escape') app.setFocusMode(false)
  }

  const LAYOUT_SHELL_LOCK_CLASS = 'layout-shell-lock'

  onMounted(() => {
    document.documentElement.classList.add(LAYOUT_SHELL_LOCK_CLASS)
    window.addEventListener('keydown', onGlobalKeydown)
    // 首次登录后引导;延迟 800ms 等 Header / Sidebar 渲染完再标 anchor
    if (shouldShowOnboarding()) {
      setTimeout(() => startOnboarding(), 800)
    }
  })
  onUnmounted(() => {
    document.documentElement.classList.remove(LAYOUT_SHELL_LOCK_CLASS)
    window.removeEventListener('keydown', onGlobalKeydown)
  })

  watch(
    () => route.fullPath,
    () => tabsStore.addFromRoute(route),
    { immediate: true },
  )
</script>

<style scoped>
  .layout-root {
    min-height: 100vh;
    background: var(--color-bg-canvas);
    /* 四边等距：侧栏 | 顶栏 | 主区外缘对齐；内层由 --layout-panel-hover-safe 为 hover scale 留空 */
    padding: var(--layout-panel-hover-safe);
    gap: var(--layout-panel-gap);
    overflow: hidden;
  }

  .layout-shell {
    min-width: 0;
    min-height: calc(100vh - (var(--layout-panel-hover-safe) * 2) - var(--layout-panel-gap));
    display: flex;
    flex-direction: column;
    background: transparent;
    overflow: visible;
    gap: var(--layout-header-main-gap);
    /**
     * 顶栏卡片内边距 = 主内容壳 padding + 主区内层 page-scroll-edge-bleed，
     * 与 el-main 内「白卡片 + layout-main__content」文字起始线同一垂线。
     */
    --layout-main-gutter: 6px;
    --layout-card-border-width: 1px;
    --layout-card-padding: 16px;
    --layout-content-inset-inline: calc(var(--layout-card-padding) + var(--page-scroll-edge-bleed));
  }

  .layout-root.is-focus {
    padding: 0;
    gap: 0;
  }

  .layout-root.is-focus .layout-sidebar {
    display: none;
  }

  .layout-root.is-focus :deep(.layout-header) {
    display: none;
  }

  .layout-root.is-focus .layout-shell {
    min-height: 0;
    flex: 1;
  }

  /* 全屏内容区：禁用 hover 放大，避免干扰阅读与遮挡 */
  .layout-root.is-focus .app-surface:hover,
  .layout-root.is-focus :deep(.el-card:hover),
  .layout-root.is-focus .layout-main__surface:hover {
    transform: none !important;
    box-shadow:
      var(--shadow-surface),
      inset 0 1px 0 var(--layout-panel-inset-highlight);
    border-color: var(--color-border-light);
  }

  .layout-root.is-focus .app-surface,
  .layout-root.is-focus :deep(.el-card),
  .layout-root.is-focus .layout-main__surface {
    transition: none !important;
  }

  .layout-root.is-focus .layout-main__surface {
    padding: 0;
    border-radius: 0;
    border: none;
    box-shadow: none;
  }

  .layout-root.is-focus .layout-main {
    padding: 0;
  }

  .focus-fab {
    position: fixed;
    right: 14px;
    bottom: 14px;
    z-index: 1999;
  }

  .focus-fab__btn {
    backdrop-filter: blur(10px);
  }

  .layout-main {
    --el-main-padding: 0;
    display: flex;
    flex-direction: column;
    padding: var(--layout-main-gutter) !important;
    min-height: 0;
    flex: 1;
    overflow: visible;
    background: transparent;
    gap: 0;
  }

  /** 主内容卡片外壳：不参与滚动。 */
  .layout-main__surface {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: visible;
    padding: var(--layout-card-padding);
    background: var(--color-bg-card);
    border: var(--layout-card-border-width) solid var(--color-border-light);
    border-radius: var(--layout-panel-radius);
    transform-origin: 50% 50%;
    transition:
      transform var(--motion-duration-sm) var(--motion-ease-emphasized),
      box-shadow var(--motion-duration-md) var(--motion-ease-standard),
      border-color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  /** 主壳保持稳定，仅通过描边反馈 hover，避免弹层/点击时定位闪烁。 */
  .layout-main__surface:hover {
    transform: none;
    border-color: color-mix(in srgb, var(--color-border) 68%, var(--color-primary) 32%);
  }

  @media (prefers-reduced-motion: reduce) {
    .layout-main__surface,
    .layout-main__surface:hover {
      transition: none;
      transform: none;
    }
  }

  /** 实际滚动层：列表/长页仅在白卡片内滚，侧栏与顶栏固定 */
  .layout-main__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--color-text-tertiary) 38%, transparent) transparent;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .layout-main__body::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .layout-main__body::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-text-tertiary) 30%, transparent);
    border: 2px solid transparent;
    background-clip: content-box;
  }

  .layout-main__body::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--color-primary) 46%, transparent);
    background-clip: content-box;
  }

  .layout-main__content {
    flex: 1;
    min-height: 0;
    box-sizing: border-box;
    /**
     * 顶边单独收紧；左右与底边仍用 --page-scroll-edge-bleed。
     */
    padding: var(--page-scroll-edge-top) var(--page-scroll-edge-bleed) var(--page-scroll-edge-bleed);
  }

  .layout-main__body :deep(.page-container) {
    flex: 1;
    min-height: 0;
  }

  @media (max-width: 720px) {
    .layout-root {
      padding: 10px;
      gap: 8px;
    }
    .layout-shell {
      min-height: calc(100vh - 28px);
      gap: var(--layout-header-main-gap);
      --layout-main-gutter: 5px;
      --layout-card-padding: 12px;
    }
  }
</style>
