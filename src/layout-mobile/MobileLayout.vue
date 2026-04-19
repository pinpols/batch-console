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
  import MobileAppBar from './MobileAppBar.vue'
  import MobileTabBar from './MobileTabBar.vue'
  import './styles/mobile-common.css'
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
