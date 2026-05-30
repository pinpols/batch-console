<template>
  <div class="mobile-layout">
    <MobileAppBar :scrolled="scrolled" />
    <MaintenanceBanner />
    <DegradationBanner />
    <main ref="contentRef" class="mobile-layout__content" @scroll.passive="onScroll">
      <router-view v-slot="{ Component, route: r }">
        <transition :name="pageTransition">
          <keep-alive :max="10">
            <component :is="Component" :key="r.fullPath" />
          </keep-alive>
        </transition>
      </router-view>
    </main>
    <MobileTabBar />
    <CommandPalette
      v-model="paletteOpen"
      :groups="permission.visibleGroups"
      :recent-tabs="tabsStore.list"
    />
    <MInstallHint />
    <SwUpdatePrompt />
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import MobileAppBar from './MobileAppBar.vue'
  import MobileTabBar from './MobileTabBar.vue'
  import MaintenanceBanner from '@/components/common/MaintenanceBanner.vue'
  import DegradationBanner from '@/components/common/DegradationBanner.vue'
  import SwUpdatePrompt from '@/components/common/SwUpdatePrompt.vue'
  import CommandPalette from '@/components/common/CommandPalette.vue'
  import { useMaintenancePolling } from '@/composables/useMaintenancePolling'
  import './styles/mobile-common.css'
  import { useMobileBadgesStore } from '@/stores/mobileBadges'
  import { useTenantStore } from '@/stores/tenant'
  import { usePermissionStore } from '@/stores/permission'
  import { useTabsStore } from '@/stores/tabs'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import { useMobileTracker } from '@/composables/useMobileTracker'

  const badges = useMobileBadgesStore()
  const tenant = useTenantStore()
  const permission = usePermissionStore()
  const tabsStore = useTabsStore()
  const paletteOpen = ref(false)

  // 维护模式探活共享 DefaultLayout 同一逻辑;两套布局只会有一个挂载,不会双轮询
  useMaintenancePolling()

  // 移动端用户操作埋点:全局 click 委托,覆盖所有 .m-btn / .m-tab / .m-card 等共享组件
  useMobileTracker()

  // Large Title 滚动塌缩:scrollTop > 24px 时 AppBar 显示 inline title + 实底,
  // 否则透明,大标题在内容区(.m-page__title)。阈值 24 是经验值,刚好让大标题
  // 第一行完全滚出 nav bar 视线。
  const contentRef = ref<HTMLElement | null>(null)
  const scrolled = ref(false)
  function onScroll() {
    const el = contentRef.value
    if (!el) return
    scrolled.value = el.scrollTop > 24
  }

  // 页面切换 push/pop 方向:
  //   - 路径加深(/m/jobs → /m/jobs/123)= push,从右滑入
  //   - 路径变浅 = pop,从左滑入
  //   - 同层级或 tab 切换 = 默认 fade
  const route = useRoute()
  const pageTransition = ref<'page-fade' | 'page-push' | 'page-pop'>('page-fade')
  watch(
    () => route.path,
    (to, from) => {
      if (!from) return
      const toDepth = to.split('/').filter(Boolean).length
      const fromDepth = from.split('/').filter(Boolean).length
      if (toDepth > fromDepth) pageTransition.value = 'page-push'
      else if (toDepth < fromDepth) pageTransition.value = 'page-pop'
      else pageTransition.value = 'page-fade'
      // 切页时把滚动状态重置,避免新页 nav bar 一开始就 condensed
      scrolled.value = false
      contentRef.value?.scrollTo({ top: 0 })
    },
  )

  onMounted(() => void badges.refresh())
  watch(
    () => tenant.tenantId,
    () => void badges.refresh(),
  )
  // 30s 轮询所有 tab 的徽章，切后台时暂停
  useAutoRefresh(() => badges.refresh(), 30_000)

  // 移动端也支持 ⌘K / Ctrl+K(主要给挂键盘的平板用)
  function onGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable) return
      e.preventDefault()
      paletteOpen.value = true
    }
  }
  onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>

<style scoped>
  .mobile-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    /* iOS grouped background;mobile-common.css 会再用 var(--ios-bg-grouped) 覆盖一遍 */
    background: #f2f2f7;
  }

  /* 内边距按 iOS 标准:左右 16px,顶部 10px(给页面 .m-page 留收紧空间),底部留 tabbar + home indicator */
  .mobile-layout__content {
    flex: 1;
    padding: 10px 16px calc(76px + env(safe-area-inset-bottom, 0));
    overflow-y: auto;
  }

  /* 切页时 enter/leave 同时在场,让旧页 absolute 浮起,新页 normal flow 占位,
     避免 out-in 模式下的"旧页先消失出现空白再载入"闪屏 */
  .mobile-layout__content :deep(.page-fade-leave-active),
  .mobile-layout__content :deep(.page-push-leave-active),
  .mobile-layout__content :deep(.page-pop-leave-active) {
    position: absolute;
    top: 10px;
    left: 16px;
    right: 16px;
    bottom: calc(76px + env(safe-area-inset-bottom, 0));
    overflow: hidden;
  }
  .mobile-layout__content {
    position: relative;
  }

  /* tab 间切换:微 fade,避免界面闪 */
  .page-fade-enter-active,
  .page-fade-leave-active {
    transition: opacity 0.12s ease;
  }
  .page-fade-enter-from,
  .page-fade-leave-to {
    opacity: 0;
  }

  /* iOS push:新页从右滑入,旧页轻微左移 + 浅淡 */
  .page-push-enter-active,
  .page-push-leave-active {
    transition:
      transform 0.32s cubic-bezier(0.32, 0.72, 0, 1),
      opacity 0.32s ease;
  }
  .page-push-enter-from {
    transform: translateX(100%);
  }
  .page-push-leave-to {
    transform: translateX(-22%);
    opacity: 0.55;
  }

  /* iOS pop:反过来,旧页向右滑出,新页从左侧浅 22% 处复位 */
  .page-pop-enter-active,
  .page-pop-leave-active {
    transition:
      transform 0.32s cubic-bezier(0.32, 0.72, 0, 1),
      opacity 0.32s ease;
  }
  .page-pop-enter-from {
    transform: translateX(-22%);
    opacity: 0.55;
  }
  .page-pop-leave-to {
    transform: translateX(100%);
  }
</style>
