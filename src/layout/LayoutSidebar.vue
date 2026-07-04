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
      :default-openeds="openedGroups"
      :unique-opened="false"
      router
    >
      <el-sub-menu v-for="group in visibleGroups" :key="group.key" :index="group.key">
        <template #title>
          <el-icon v-if="group.icon" class="group-icon"><component :is="group.icon" /></el-icon>
          <span class="group-title">{{ resolveGroupTitle(group) }}</span>
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
          <template #title>{{ resolveItemTitle(item) }}</template>
        </el-menu-item>
      </el-sub-menu>
    </el-menu>

    <button
      class="sidebar-foot"
      type="button"
      :title="t('nav.collapseToggle')"
      @click="app.toggleSidebar()"
    >
      <span v-if="!app.sidebarCollapsed" class="sidebar-foot__status">
        <span class="sidebar-foot__dot" />
        {{ t('nav.serviceHealthy') }}
        <span class="sidebar-foot__ver">· v{{ appVersion }}</span>
      </span>
      <el-icon class="sidebar-foot__chevron"
        ><Fold v-if="!app.sidebarCollapsed" /><Expand v-else
      /></el-icon>
    </button>
  </el-aside>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { PanelLeftClose as Fold, PanelLeftOpen as Expand } from 'lucide-vue-next'
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
  // 还原设计:默认只展开「当前路由所在组」,其余分组收起(显示 › 箭头);非 unique-opened
  // 允许用户再手动展开其它组。
  const openedGroups = computed(() => {
    const active = activeMenu.value
    const g = visibleGroups.value.find((grp) => grp.children?.some((c) => c.path === active))
    return g ? [g.key] : visibleGroups.value[0] ? [visibleGroups.value[0].key] : []
  })
  const appVersion = __APP_VERSION__

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
    /* 扁平设计:无 4 边边框(右侧 1px 分隔线由 app.css 全局提供),无阴影光圈 */
    border: none;
    box-shadow: none;
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
    /* 还原设计:logo 区无底部分隔线(设计 brand border-bottom: none) */
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

  /* 分组标题(可折叠,带箭头 chevron):设计稿的克制灰色 section 标签。 */
  .layout-menu :deep(.el-sub-menu__title) {
    height: 34px;
    padding: 0 var(--layout-sidebar-inline) !important;
    margin-top: 8px;
    color: var(--layout-sidebar-text-muted);
    background: transparent !important;
  }

  .layout-menu :deep(.el-sub-menu:first-child .el-sub-menu__title) {
    margin-top: 2px;
  }

  .layout-menu :deep(.el-sub-menu__title .group-title) {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: none;
  }

  /* 展开态:分组标题只显文字(还原设计,无组图标);组图标仅收起态用于图标轨。 */
  .layout-menu:not(.el-menu--collapse) :deep(.el-sub-menu__title .group-icon) {
    display: none;
  }

  .layout-menu :deep(.el-sub-menu__title:hover) {
    color: var(--layout-sidebar-hover-text) !important;
    background: transparent !important;
  }

  /* 还原设计:分组箭头收起=›(右)、展开=⌄(下);EP 默认是 ⌄/^,这里改基态为右、展开转下 */
  .layout-menu :deep(.el-sub-menu__icon-arrow) {
    font-size: 12px;
    opacity: 0.7;
    transform: rotate(-90deg) !important;
    transition: transform var(--motion-duration-sm) var(--motion-ease-standard);
    margin-top: 0;
  }

  .layout-menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title .el-sub-menu__icon-arrow) {
    transform: rotate(0deg) !important;
  }

  /* 组内子菜单容器留白 */
  .layout-menu :deep(.el-sub-menu .el-menu) {
    background: transparent;
    padding: 2px 0 4px;
  }

  /* 导航项:图标 + 文字,始终可见;当前项 = 高亮底 + 左强调条。 */
  .layout-menu :deep(.el-menu-item) {
    position: relative;
    color: var(--layout-sidebar-text);
    height: 32px;
    line-height: 32px;
    border-radius: 7px;
    margin: 1px var(--layout-sidebar-inline);
    padding-left: 8px !important;
    padding-right: 8px !important;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0;
    transition:
      background-color var(--motion-duration-sm) var(--motion-ease-standard),
      color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .layout-menu :deep(.el-menu-item .el-icon) {
    margin-right: 9px;
    font-size: 17px;
    opacity: 0.9;
  }

  .layout-menu :deep(.el-menu-item::before) {
    content: '';
    position: absolute;
    inset: 8px auto 8px 0;
    width: 3px;
    border-radius: 999px;
    background: transparent;
  }

  .layout-menu :deep(.el-menu-item:hover) {
    color: var(--layout-sidebar-active-text) !important;
    background-color: var(--layout-sidebar-hover-bg) !important;
  }

  .layout-menu :deep(.el-menu-item.is-active) {
    color: var(--layout-sidebar-active-text) !important;
    background-color: var(--layout-sidebar-active-bg) !important;
    font-weight: 600;
  }

  .layout-menu :deep(.el-menu-item.is-active .el-icon) {
    opacity: 1;
  }

  .layout-menu :deep(.el-menu-item.is-active::before) {
    background: var(--layout-sidebar-active-text);
  }

  /* 收起态(≤1024 / 手动):图标居中,隐藏分组标题文字。 */
  .layout-menu.el-menu--collapse {
    width: 100%;
  }

  .layout-menu.el-menu--collapse :deep(.el-sub-menu__title) {
    justify-content: center;
    height: 40px;
    margin: 4px auto;
    padding: 0 !important;
  }

  .layout-menu.el-menu--collapse :deep(.el-sub-menu__title .group-icon) {
    margin-right: 0;
    font-size: 17px;
  }

  .layout-menu.el-menu--collapse :deep(.el-menu-item) {
    justify-content: center;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .layout-menu.el-menu--collapse :deep(.el-menu-item .el-icon) {
    margin-right: 0;
  }

  /* 底部状态行 + 折叠钮(还原设计稿「● 服务正常 · vX.Y」)。 */
  .sidebar-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
    height: 40px;
    padding: 0 var(--layout-sidebar-inline);
    border-top: 1px solid var(--layout-sidebar-brand-divider);
    background: transparent;
    color: var(--layout-sidebar-text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .sidebar-foot:hover {
    color: var(--layout-sidebar-active-text);
  }

  .sidebar-foot__status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    white-space: nowrap;
  }

  .sidebar-foot__dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--el-color-success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-success) 22%, transparent);
    flex-shrink: 0;
  }

  .sidebar-foot__ver {
    color: var(--layout-sidebar-text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .sidebar-foot__chevron {
    font-size: 15px;
    flex-shrink: 0;
  }

  .layout-sidebar.el-aside :deep(.el-menu--collapse) + .sidebar-foot,
  :deep(.el-menu--collapse) ~ .sidebar-foot {
    justify-content: center;
  }
</style>
