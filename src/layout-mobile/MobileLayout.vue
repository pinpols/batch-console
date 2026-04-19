<template>
  <div class="mobile-layout">
    <MobileAppBar />
    <main class="mobile-layout__content">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <MobileTabBar />
  </div>
</template>

<script setup lang="ts">
  import { onMounted, watch } from 'vue'
  import MobileAppBar from './MobileAppBar.vue'
  import MobileTabBar from './MobileTabBar.vue'
  import './styles/mobile-common.css'
  import { useMobileBadgesStore } from '@/stores/mobileBadges'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'

  const badges = useMobileBadgesStore()
  const tenant = useTenantStore()
  onMounted(() => void badges.refresh())
  watch(
    () => tenant.tenantId,
    () => void badges.refresh(),
  )
  // 30s 轮询所有 tab 的徽章，切后台时暂停
  useAutoRefresh(() => badges.refresh(), 30_000)
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
