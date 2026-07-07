<template>
  <!--
    还原设计原稿:侧栏不再用 el-menu(EP 默认样式反复打架),改为设计源同构的原生结构。
    所有数值取自 design/Batch Console 重设计.dc.html 实测:
    项 32px/radius 7/pad 0 8/gap 9/icon 17/字 13;组标题 11.5px #9aa1ae;
    active = accent 文字 + accent-soft 底;收起态宽 58 图标轨。
    逻辑保留:permission.visibleGroups / vue-router / 折叠 / hover 预取 / i18n。
  -->
  <el-aside class="layout-sidebar" :width="app.sidebarCollapsed ? '58px' : '224px'">
    <div class="brand">
      <div class="brand__logo">BC</div>
      <div v-if="!app.sidebarCollapsed" class="brand__text">
        <div class="brand__title">{{ t('nav.appTitle') }}</div>
        <div class="brand__subtitle">Batch Console</div>
      </div>
    </div>

    <nav class="nav">
      <div v-for="group in visibleGroups" :key="group.key" class="nav__group">
        <button
          v-if="!app.sidebarCollapsed"
          type="button"
          class="nav__group-hd"
          @click="toggleGroup(group.key)"
        >
          <span class="nav__group-title">{{ resolveGroupTitle(group) }}</span>
          <el-icon class="nav__chevron" :class="{ 'is-open': isOpen(group.key) }">
            <ChevronDown />
          </el-icon>
        </button>
        <div v-show="app.sidebarCollapsed || isOpen(group.key)" class="nav__items">
          <RouterLink
            v-for="item in group.children.filter((c) => !c.hidden)"
            :key="item.path"
            :to="item.path"
            class="nav__item"
            :class="{ 'is-active': activeMenu === item.path }"
            :title="resolveItemTitle(item)"
            @mouseenter="prefetchRouteComponent(item.path)"
            @focus="prefetchRouteComponent(item.path)"
          >
            <el-icon v-if="item.icon" class="nav__icon">
              <component :is="item.icon" />
            </el-icon>
            <span v-if="!app.sidebarCollapsed" class="nav__label">{{
              resolveItemTitle(item)
            }}</span>
          </RouterLink>
        </div>
      </div>
    </nav>

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
      <el-icon class="sidebar-foot__chevron">
        <PanelLeftClose v-if="!app.sidebarCollapsed" /><PanelLeftOpen v-else />
      </el-icon>
    </button>
  </el-aside>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'
  import { usePermissionStore } from '@/stores/permission'
  import type { NavigationGroup, NavigationItem } from '@/constants/navigation'
  import { pathToKey } from '@/constants/pathKey'
  import { useResponsive } from '@/composables/useResponsive'

  const app = useAppStore()

  // ≤1024 (isCompact) 才自动 collapse 侧栏(真·平板/窄屏),桌面/笔电一律展开还原设计。
  // 首帧以视口为准,覆盖历史 localStorage 残留;之后仅跨阈值切换,session 内手动切换保留。
  const { isCompact } = useResponsive()
  const isNarrow = computed(() => isCompact.value)
  watch(
    isNarrow,
    (narrow, prev) => {
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

  const visibleGroups = computed(() => permission.visibleGroups)

  // 侧栏高亮:优先「真实路径 + query 最具体命中」的菜单项,再回退 meta.activeMenu。
  // 修复两类「点了不高亮 = 选不中」:
  //  ① 借用 activeMenu 的项(文件渠道 /files/channels 把 activeMenu 借给 /files/templates
  //     以躲后端菜单守卫弹回)—— 靠真实 path 直接命中自己;
  //  ② 同 path 多 tab(Catch-up = /approvals?tab=catch-up 与「审批」= /approvals 同 path)
  //     —— query 约束更多者更具体,tab 命中时让位给 Catch-up。
  // 真实路径不是任何菜单项时(详情/编辑等子页)才回退 meta.activeMenu 指回列表。
  function splitTarget(p: string): { path: string; query: Record<string, string> } {
    const qi = p.indexOf('?')
    if (qi < 0) return { path: p, query: {} }
    const query: Record<string, string> = {}
    new URLSearchParams(p.slice(qi + 1)).forEach((v, k) => {
      query[k] = v
    })
    return { path: p.slice(0, qi), query }
  }

  const flatItems = computed<NavigationItem[]>(() =>
    visibleGroups.value.flatMap((g) => g.children ?? []),
  )

  const activeMenu = computed(() => {
    let best: string | null = null
    let bestScore = -1
    for (const it of flatItems.value) {
      const tgt = splitTarget(it.path)
      if (route.path !== tgt.path) continue
      const entries = Object.entries(tgt.query)
      if (!entries.every(([k, v]) => String(route.query[k] ?? '') === v)) continue
      if (entries.length > bestScore) {
        best = it.path
        bestScore = entries.length
      }
    }
    if (best !== null) return best
    return (route.meta.activeMenu as string) ?? route.path
  })

  // 还原设计默认态:只展开「当前路由所在组」,其余收起(›);用户可手动开合任意组。
  const manualOpen = ref<Record<string, boolean>>({})
  const activeGroupKey = computed(
    () =>
      visibleGroups.value.find((g) => g.children?.some((c) => c.path === activeMenu.value))?.key ??
      visibleGroups.value[0]?.key,
  )
  function isOpen(key: string): boolean {
    return manualOpen.value[key] ?? key === activeGroupKey.value
  }
  function toggleGroup(key: string) {
    manualOpen.value[key] = !isOpen(key)
  }
  // 路由切到别的组时,让新活动组自然展开(清掉对它的手动收起标记)
  watch(activeGroupKey, (k) => {
    if (k && manualOpen.value[k] === false) delete manualOpen.value[k]
  })

  const appVersion = __APP_VERSION__

  function prefetchRouteComponent(path: string) {
    try {
      const resolved = router.resolve(path)
      for (const record of resolved.matched) {
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
    border: none;
    border-right: 1px solid var(--color-border);
    box-shadow: none;
    overflow: hidden;
    transition:
      width 0.2s ease,
      background 0.2s ease;
  }

  /* ── brand(设计:无底部分隔线) ── */
  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    flex-shrink: 0;
    min-height: 66px;
    padding: 16px 14px;
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
    background: linear-gradient(135deg, #1d7dff 0%, #4c9dff 100%);
    flex-shrink: 0;
  }

  .brand__title {
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
  }

  .brand__subtitle {
    color: var(--layout-sidebar-text-muted);
    font-size: 12px;
    line-height: 1.3;
    white-space: nowrap;
  }

  /* ── nav ── */
  .nav {
    flex: 1;
    min-height: 0;
    padding: 19px 10px 8px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }

  .nav::-webkit-scrollbar {
    display: none;
  }

  /* 组间距:收起组之间紧凑(8px,组头自带 32 高);展开组由 items 的 padding-bottom
     再补呼吸,展开内容到下一组头 ≈ 20px(设计节奏)。此前统一 24px 导致收起组间空隙过大。 */
  .nav__group + .nav__group {
    margin-top: 8px;
  }

  .nav__items {
    padding-bottom: 12px;
  }

  /* 组标题行:11.5px #9aa1ae + 右侧 chevron(收起 › / 展开 ⌄) */
  .nav__group-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 32px;
    padding: 0 4px;
    border: none;
    background: transparent;
    color: var(--layout-sidebar-text-muted);
    cursor: pointer;
  }

  .nav__group-hd:hover {
    color: var(--layout-sidebar-hover-text);
  }

  .nav__group-title {
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .nav__chevron {
    font-size: 13px;
    opacity: 0.7;
    transform: rotate(-90deg);
    transition: transform 0.15s ease;
  }

  .nav__chevron.is-open {
    transform: rotate(0deg);
  }

  /* 导航项(设计实测:32px / radius 7 / pad 0 8 / gap 9 / 字 13) */
  .nav__item {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 32px;
    padding: 0 8px;
    margin-bottom: 1px;
    border-radius: 7px;
    color: var(--layout-sidebar-text);
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
    transition:
      background-color 0.12s ease,
      color 0.12s ease;
  }

  .nav__item:hover {
    color: var(--layout-sidebar-hover-text);
    background: var(--layout-sidebar-hover-bg);
  }

  .nav__item.is-active {
    color: var(--layout-sidebar-active-text);
    background: var(--layout-sidebar-active-bg);
    font-weight: 600;
    position: relative;
  }

  /* 设计规格:激活项左强调条 */
  .nav__item.is-active::before {
    content: '';
    position: absolute;
    left: -10px;
    top: 7px;
    bottom: 7px;
    width: 3px;
    border-radius: 999px;
    background: var(--layout-sidebar-active-text);
  }

  .nav__icon {
    font-size: 17px;
    flex-shrink: 0;
    opacity: 0.9;
  }

  .nav__item.is-active .nav__icon {
    opacity: 1;
  }

  .nav__label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 收起态:58px 图标轨,项图标居中 */
  .layout-sidebar[style*='58px'] .nav {
    padding: 4px 8px 8px;
  }

  .layout-sidebar[style*='58px'] .nav__item {
    justify-content: center;
    padding: 0;
  }

  /* ── footer:● 服务正常 · vX.Y + 折叠钮 ── */
  .sidebar-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
    height: 40px;
    padding: 0 14px;
    border: none;
    border-top: 1px solid var(--color-border);
    background: transparent;
    color: var(--layout-sidebar-text-muted);
    font-size: 12px;
    cursor: pointer;
    transition: color 0.12s ease;
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
    background: var(--color-success);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 22%, transparent);
    flex-shrink: 0;
  }

  .sidebar-foot__ver {
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .sidebar-foot__chevron {
    font-size: 15px;
    flex-shrink: 0;
  }
</style>
