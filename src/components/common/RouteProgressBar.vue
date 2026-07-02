<template>
  <Teleport to="body">
    <Transition name="route-progress-fade">
      <div
        v-if="progress.loading"
        class="route-progress"
        role="progressbar"
        aria-busy="true"
        aria-valuemin="0"
        aria-valuemax="1"
        :aria-label="t('common.pageSwitching')"
      >
        <div class="route-progress__track">
          <div class="route-progress__lead" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { useRouteProgressStore } from '@/stores/routeProgress'

  const { t } = useI18n()
  const progress = useRouteProgressStore()
</script>

<style scoped>
  .route-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-route-progress);
    height: 3px;
    pointer-events: none;
    overflow: hidden;
    background: rgb(22 119 255 / 12%);
  }

  .route-progress__track {
    position: relative;
    height: 100%;
    width: 100%;
  }

  .route-progress__lead {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 38%;
    max-width: 240px;
    border-radius: 0 2px 2px 0;
    background: linear-gradient(
      90deg,
      var(--color-primary),
      color-mix(in srgb, var(--color-primary) 70%, #ffffff 30%)
    );
    box-shadow: 0 0 10px color-mix(in srgb, var(--color-primary) 40%, transparent);
    animation: route-progress-sweep 0.95s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes route-progress-sweep {
    0% {
      transform: translateX(-100%);
    }

    100% {
      transform: translateX(320%);
    }
  }

  .route-progress-fade-enter-active,
  .route-progress-fade-leave-active {
    transition: opacity 0.18s ease;
  }

  .route-progress-fade-enter-from,
  .route-progress-fade-leave-to {
    opacity: 0;
  }
</style>
