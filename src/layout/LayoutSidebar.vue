<template>
  <el-aside
    class="layout-sidebar app-surface layout-panel"
    :width="app.sidebarCollapsed ? '72px' : '224px'"
  >
    <div class="brand">
      <div class="brand__logo">BC</div>
      <div v-if="!app.sidebarCollapsed" class="brand__text">
        <div class="brand__title">{{ t('nav.appTitle') }}</div>
        <div class="brand__subtitle">Batch Console</div>
      </div>
    </div>

    <el-menu
      class="layout-menu"
      :collapse="app.sidebarCollapsed"
      :default-active="activeMenu"
      :unique-opened="true"
      router
    >
      <template v-for="group in visibleGroups" :key="group.key">
        <el-sub-menu :index="group.key">
          <template #title>
            <el-icon>
              <component :is="group.icon" />
            </el-icon>
            <span>{{ resolveGroupTitle(group) }}</span>
          </template>
          <el-menu-item
            v-for="item in group.children.filter((c) => !c.hidden)"
            :key="item.path"
            :index="item.path"
            @mouseenter="prefetchRouteComponent(item.path)"
            @focus="prefetchRouteComponent(item.path)"
          >
            <el-icon v-if="item.icon">
              <component :is="item.icon" />
            </el-icon>
            {{ resolveItemTitle(item) }}
          </el-menu-item>
        </el-sub-menu>
      </template>
    </el-menu>
  </el-aside>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { useAppStore } from '@/stores/app'
  import { usePermissionStore } from '@/stores/permission'
  import type { NavigationGroup, NavigationItem } from '@/constants/navigation'
  import { pathToKey } from '@/constants/pathKey'
  import { useResponsive } from '@/composables/useResponsive'

  const app = useAppStore()

  // ≤1440 (isCompact) 自动 collapse 侧栏腾内容区,>1440 还原用户偏好。
  // 阈值 1280→1440(2026-06-16):1366×768 这类最常见笔电原先保留满侧栏内容只剩 ~1100,
  // 抬到 1440 让它也自动收起腾出 ~150px。用户在 ≤1440 手动展开后不再强制 collapse
  // (watch 跨阈值才触发),避免 fighting。
  // 改造记录(2026-06-03):从 window.innerWidth + resize 监听迁到 useResponsive
  // (matchMedia)以避免 cleanup 漏装 / SSR 警告。
  const { isCompact } = useResponsive()
  const isNarrow = computed(() => isCompact.value)
  watch(
    isNarrow,
    (narrow, prev) => {
      if (prev === undefined) {
        if (narrow) app.setSidebarCollapsed(true)
        return
      }
      if (narrow !== prev) app.setSidebarCollapsed(narrow)
    },
    { immediate: true },
  )
  const permission = usePermissionStore()
  const route = useRoute()
  const router = useRouter()
  const { t, te } = useI18n({ useScope: 'global' })

  function resolveGroupTitle(group: NavigationGroup): string {
    const key = `nav.group.${group.key}`
    return te(key) ? t(key) : group.title
  }

  function resolveItemTitle(item: NavigationItem): string {
    const key = `page.${pathToKey(item.path)}.title`
    return te(key) ? t(key) : item.title
  }

  const activeMenu = computed(() => (route.meta.activeMenu as string) ?? route.path)
  const visibleGroups = computed(() => permission.visibleGroups)

  function prefetchRouteComponent(path: string) {
    try {
      const resolved = router.resolve(path)
      for (const record of resolved.matched) {
        // Vue Router 类型上 components.default 可能是 Component 或 lazy import 函数;
        // 这里只关心 lazy:用 typeof 判 + Function 强类型再调,绕过 union 报错。
        const loader = record.components?.default as (() => Promise<unknown>) | undefined
        if (typeof loader === 'function') {
          Promise.resolve(loader()).catch(() => {
            /* ignore prefetch failures */
          })
        }
      }
    } catch {
      /* ignore */
    }
  }
</script>

<style scoped>
  .layout-sidebar {
    display: flex;
    flex-direction: column;
    background: var(--layout-sidebar-bg);
    /* 与 app-surface 合并：勿只写 width/background，否则会盖掉全局 surface 的 transform 动效 */
    transition:
      width 0.2s ease,
      background 0.2s ease,
      transform var(--motion-duration-sm) var(--motion-ease-emphasized),
      box-shadow var(--motion-duration-md) var(--motion-ease-standard),
      border-color var(--motion-duration-sm) var(--motion-ease-standard);
    transform-origin: 50% 50%;
    overflow: hidden;
    border: 1px solid var(--color-border-light);
    --el-menu-bg-color: transparent;
    --el-menu-text-color: var(--layout-sidebar-text);
    --el-menu-hover-text-color: var(--layout-sidebar-hover-text);
    --el-menu-hover-bg-color: var(--layout-sidebar-hover-bg);
    --el-menu-active-color: var(--layout-sidebar-active-text);
  }

  /** 左侧栏保持稳定，仅通过阴影与描边响应 hover，避免布局级 scale 影响弹层定位。 */
  .layout-sidebar:hover {
    transform: none;
    box-shadow:
      var(--shadow-surface-hover),
      inset 0 1px 0 var(--layout-panel-inset-highlight);
    border-color: color-mix(in srgb, var(--color-border) 68%, var(--color-primary) 32%);
  }

  @media (prefers-reduced-motion: reduce) {
    .layout-sidebar,
    .layout-sidebar:hover {
      transition:
        width 0.2s ease,
        background 0.2s ease !important;
      transform: none !important;
    }
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    flex-shrink: 0;
    min-height: 56px;
    padding: var(--layout-sidebar-brand-pad-block) var(--layout-sidebar-inline);
    border-bottom: 1px solid var(--layout-sidebar-brand-divider);
  }

  .brand__logo {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: var(--radius-content);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    background: linear-gradient(135deg, #1677ff 0%, #4ca1ff 100%);
  }

  .brand__title {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }

  .brand__subtitle {
    color: var(--layout-sidebar-text-muted);
    font-size: 12px;
    line-height: 1.3;
  }

  .layout-menu {
    flex: 1;
    min-height: 0;
    padding-top: 8px;
    border-right: none;
    background: transparent;
    overflow-y: auto;
    overflow-x: hidden;
    /* 不显示滚动条，小屏仍可滚轮滚动 */
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .layout-menu::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }

  .layout-menu :deep(.el-sub-menu__title),
  .layout-menu :deep(.el-menu-item) {
    color: var(--layout-sidebar-text);
    height: 38px;
    line-height: 38px;
    border-radius: var(--radius-content);
    margin: 4px var(--layout-sidebar-inline);
    padding-left: 9px !important;
    padding-right: 9px !important;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.1px;
  }

  .layout-menu :deep(.el-sub-menu__title .el-icon),
  .layout-menu :deep(.el-menu-item .el-icon) {
    margin-right: 7px;
    font-size: 16px;
    opacity: 0.95;
  }

  .layout-menu :deep(.el-menu-item.is-active .el-icon) {
    opacity: 1;
  }

  .layout-menu :deep(.el-sub-menu .el-menu) {
    background-color: var(--layout-sidebar-subnav-bg);
    padding: 5px 0 8px;
    margin: 0 var(--layout-sidebar-inline) 6px;
    border-radius: var(--radius-content);
    overflow: hidden;
  }

  /* 二级菜单卡片化（sub-menu 内的 item） */
  .layout-menu :deep(.el-sub-menu .el-menu-item) {
    height: 40px;
    line-height: 40px;
    margin: 4px 8px;
    font-size: 12px;
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--layout-sidebar-bg) 18%, var(--color-bg-card) 82%);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 70%, transparent 30%);
    box-shadow: 0 6px 18px rgb(15 23 42 / 8%);
    transition:
      transform var(--motion-duration-sm) var(--motion-ease-emphasized),
      box-shadow var(--motion-duration-md) var(--motion-ease-standard),
      border-color var(--motion-duration-sm) var(--motion-ease-standard),
      background-color var(--motion-duration-sm) var(--motion-ease-standard),
      color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .layout-menu :deep(.el-sub-menu .el-menu-item:hover) {
    transform: translateY(-1px);
    box-shadow: 0 10px 26px rgb(15 23 42 / 12%);
    color: var(--layout-sidebar-active-text) !important;
    border-color: color-mix(in srgb, var(--color-primary) 34%, var(--color-border) 66%) !important;
    background-color: color-mix(
      in srgb,
      var(--color-primary) 16%,
      var(--color-bg-card) 84%
    ) !important;
  }

  .layout-menu :deep(.el-sub-menu .el-menu-item.is-active) {
    color: var(--layout-sidebar-active-text) !important;
    background-color: color-mix(
      in srgb,
      var(--color-primary) 20%,
      var(--color-bg-card) 80%
    ) !important;
    border-color: color-mix(in srgb, var(--color-primary) 36%, var(--color-border) 64%) !important;
    box-shadow:
      0 16px 34px rgb(15 23 42 / 14%),
      0 0 0 1px rgb(22 119 255 / 12%);
  }

  .layout-menu :deep(.el-sub-menu .el-menu-item.is-active:hover) {
    background-color: color-mix(
      in srgb,
      var(--color-primary) 24%,
      var(--color-bg-card) 76%
    ) !important;
  }

  :global(html.dark) .layout-menu :deep(.el-sub-menu .el-menu-item) {
    background: color-mix(in srgb, var(--color-bg-card) 92%, #000 8%);
    border-color: color-mix(in srgb, var(--color-border-light) 55%, transparent 45%);
    box-shadow: 0 10px 22px rgb(0 0 0 / 38%);
  }

  :global(html.dark) .layout-menu :deep(.el-sub-menu .el-menu-item:hover) {
    background-color: color-mix(
      in srgb,
      var(--color-primary) 20%,
      var(--color-bg-card) 80%
    ) !important;
    color: var(--layout-sidebar-active-text) !important;
    border-color: color-mix(in srgb, var(--color-primary) 44%, var(--color-border) 56%) !important;
    box-shadow: 0 14px 30px rgb(0 0 0 / 46%);
  }

  :global(html.dark) .layout-menu :deep(.el-sub-menu .el-menu-item.is-active) {
    background-color: color-mix(
      in srgb,
      var(--color-primary) 28%,
      var(--color-bg-card) 72%
    ) !important;
    border-color: color-mix(in srgb, var(--color-primary) 46%, var(--color-border) 54%) !important;
    box-shadow:
      0 18px 36px rgb(0 0 0 / 52%),
      0 0 0 1px rgb(255 255 255 / 6%);
  }

  /* 一级菜单 & 分组标题 hover（避免覆盖二级卡片 hover/active） */
  .layout-menu :deep(.el-menu > .el-sub-menu > .el-sub-menu__title:hover),
  .layout-menu :deep(.el-menu > .el-menu-item:hover) {
    color: color-mix(in srgb, var(--layout-sidebar-text) 70%, #ffffff 30%) !important;
    background-color: color-mix(
      in srgb,
      var(--layout-sidebar-hover-bg) 55%,
      transparent 45%
    ) !important;
  }

  .layout-menu :deep(.el-menu-item.is-active) {
    color: var(--layout-sidebar-active-text) !important;
    background-color: var(--layout-sidebar-active-bg) !important;
  }

  .layout-menu :deep(.el-menu-item.is-active:hover) {
    background-color: var(--layout-sidebar-active-hover-bg) !important;
  }
</style>
