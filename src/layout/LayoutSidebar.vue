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

  // ≤1024 (isCompact) 才自动 collapse 侧栏(真·平板/窄屏),桌面/笔电一律保持设计稿的
  // 展开标签态(2026-07-04 阈值 1440→1024,还原设计;此前 1440 把常见笔电全收成图标条)。
  // 用户手动展开/收起后不再被跨阈值 watch 强制覆盖,避免 fighting。
  // 改造记录(2026-06-03):从 window.innerWidth + resize 监听迁到 useResponsive
  // (matchMedia)以避免 cleanup 漏装 / SSR 警告。
  const { isCompact } = useResponsive()
  const isNarrow = computed(() => isCompact.value)
  watch(
    isNarrow,
    (narrow, prev) => {
      // 首帧:以视口为准还原设计(桌面/笔电展开、窄屏收起),覆盖历史 localStorage 里
      // 早期 1440 阈值残留的 collapsed=1;之后仅跨阈值才切换,session 内用户手动切换保留。
      if (prev === undefined) {
        app.setSidebarCollapsed(narrow)
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
    border-color: var(--color-border-light);
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
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0;
    background: linear-gradient(135deg, #1d7dff 0%, #4c9dff 100%);
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
    height: 34px;
    line-height: 34px;
    border-radius: var(--radius-button);
    margin: 3px var(--layout-sidebar-inline);
    padding-left: 10px !important;
    padding-right: 10px !important;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0;
  }

  .layout-menu :deep(.el-sub-menu__title .el-icon),
  .layout-menu :deep(.el-menu-item .el-icon) {
    margin-right: 9px;
    font-size: 16px;
    opacity: 0.95;
  }

  .layout-menu :deep(.el-menu-item.is-active .el-icon) {
    opacity: 1;
  }

  .layout-menu :deep(.el-sub-menu .el-menu) {
    background-color: transparent;
    padding: 2px 0 7px;
    margin: 0 0 6px;
    border-radius: 0;
    overflow: visible;
  }

  /* 二级菜单:按设计稿回到克制列表,用左侧强调条表达当前项。 */
  .layout-menu :deep(.el-sub-menu .el-menu-item) {
    position: relative;
    height: 32px;
    line-height: 32px;
    margin: 2px 10px 2px 18px;
    font-size: 12px;
    border-radius: var(--radius-button);
    background: transparent !important;
    border: 0;
    box-shadow: none;
    transition:
      background-color var(--motion-duration-sm) var(--motion-ease-standard),
      color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .layout-menu :deep(.el-sub-menu .el-menu-item::before) {
    content: '';
    position: absolute;
    inset: 7px auto 7px 0;
    width: 2px;
    border-radius: 999px;
    background: transparent;
  }

  .layout-menu :deep(.el-sub-menu .el-menu-item:hover) {
    color: var(--layout-sidebar-active-text) !important;
    background-color: var(--layout-sidebar-hover-bg) !important;
  }

  .layout-menu :deep(.el-sub-menu .el-menu-item.is-active) {
    color: var(--layout-sidebar-active-text) !important;
    background-color: var(--layout-sidebar-active-bg) !important;
    box-shadow: none;
  }

  .layout-menu :deep(.el-sub-menu .el-menu-item.is-active::before) {
    background: var(--layout-sidebar-active-text);
  }

  :global(html.dark) .layout-menu :deep(.el-sub-menu .el-menu-item) {
    background: transparent !important;
    border-color: transparent;
    box-shadow: none;
  }

  :global(html.dark) .layout-menu :deep(.el-sub-menu .el-menu-item:hover) {
    background-color: var(--layout-sidebar-hover-bg) !important;
    color: var(--layout-sidebar-active-text) !important;
  }

  :global(html.dark) .layout-menu :deep(.el-sub-menu .el-menu-item.is-active) {
    background-color: var(--layout-sidebar-active-bg) !important;
    box-shadow: none;
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

  .layout-menu.el-menu--collapse {
    width: 100%;
  }

  .layout-menu.el-menu--collapse :deep(.el-sub-menu__title) {
    justify-content: center;
    width: 40px;
    height: 40px;
    margin: 6px auto;
    padding: 0 !important;
  }

  .layout-menu.el-menu--collapse :deep(.el-sub-menu__title .el-icon) {
    margin-right: 0;
    font-size: 17px;
  }

  .layout-menu.el-menu--collapse :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
    color: var(--layout-sidebar-active-text) !important;
    background: var(--layout-sidebar-active-bg) !important;
  }
</style>
