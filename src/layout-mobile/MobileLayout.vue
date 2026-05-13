<template>
  <div class="mobile-layout">
    <MobileAppBar @open-palette="paletteOpen = true" />
    <main class="mobile-layout__content">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <MobileTabBar />
    <CommandPalette
      v-model="paletteOpen"
      :groups="permission.visibleGroups"
      :recent-tabs="tabsStore.list"
    />
    <SwUpdatePrompt />
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onUnmounted, ref, watch } from 'vue'
  import MobileAppBar from './MobileAppBar.vue'
  import MobileTabBar from './MobileTabBar.vue'
  import SwUpdatePrompt from '@/components/common/SwUpdatePrompt.vue'
  import CommandPalette from '@/components/common/CommandPalette.vue'
  import './styles/mobile-common.css'
  import { useMobileBadgesStore } from '@/stores/mobileBadges'
  import { useTenantStore } from '@/stores/tenant'
  import { usePermissionStore } from '@/stores/permission'
  import { useTabsStore } from '@/stores/tabs'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'

  const badges = useMobileBadgesStore()
  const tenant = useTenantStore()
  const permission = usePermissionStore()
  const tabsStore = useTabsStore()
  const paletteOpen = ref(false)
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
    background: var(--color-bg-body);
  }

  .mobile-layout__content {
    flex: 1;
    padding: 12px 12px calc(72px + env(safe-area-inset-bottom, 0));
    overflow-y: auto;
  }

  .page-fade-enter-active,
  .page-fade-leave-active {
    transition: opacity 0.12s ease;
  }

  .page-fade-enter-from,
  .page-fade-leave-to {
    opacity: 0;
  }
</style>
