<template>
  <div class="m-page m-desktop-only">
    <div class="m-desktop-only__panel">
      <div class="m-desktop-only__icon" aria-hidden="true">
        <MonitorSmartphone :size="28" />
      </div>
      <h1>{{ t('mobile.desktopOnly.title') }}</h1>
      <p>{{ t('mobile.desktopOnly.description') }}</p>
      <div class="m-desktop-only__actions">
        <el-button type="primary" @click="openDesktop">
          {{ t('mobile.desktopOnly.openDesktop') }}
        </el-button>
        <el-button @click="goMobileHome">{{ t('mobile.desktopOnly.backHome') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { MonitorSmartphone } from '@lucide/vue'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const redirectPath = computed(() => {
    const raw = route.query.redirect
    return typeof raw === 'string' && raw.startsWith('/') ? raw : '/'
  })

  function openDesktop() {
    void router.push({ path: redirectPath.value, query: { desktop: '1' } })
  }

  function goMobileHome() {
    void router.push('/m/ops/summary')
  }
</script>

<style scoped>
  .m-desktop-only {
    min-height: 100%;
    display: grid;
    place-items: center;
    padding: 32px 18px;
  }

  .m-desktop-only__panel {
    width: 100%;
    display: grid;
    gap: 14px;
    padding: 24px;
    border: 1px solid var(--color-border-light);
    border-radius: 18px;
    background: var(--color-bg-card);
    box-shadow: var(--shadow-card);
  }

  .m-desktop-only__icon {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }

  .m-desktop-only h1 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 20px;
    font-weight: 700;
  }

  .m-desktop-only p {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }

  .m-desktop-only__actions {
    display: grid;
    gap: 10px;
    margin-top: 8px;
  }

  .m-desktop-only__actions :deep(.el-button) {
    width: 100%;
    margin-left: 0;
  }
</style>
