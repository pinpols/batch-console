<template>
  <main class="docs-unavailable-page">
    <section class="docs-unavailable-page__content" :aria-label="t('docsUnavailable.title')">
      <EmptyState
        variant="service-down"
        :title="t('docsUnavailable.title')"
        :description="t('docsUnavailable.description')"
      >
        <template #action>
          <el-button type="primary" :icon="Refresh" :loading="checking" @click="retry">
            {{ t('docsUnavailable.retry') }}
          </el-button>
          <el-button :icon="ArrowLeft" @click="backToConsole">
            {{ t('docsUnavailable.back') }}
          </el-button>
        </template>
      </EmptyState>
      <p v-if="isDev" class="docs-unavailable-page__hint">
        {{ t('docsUnavailable.devHint') }} <code>npm run docs:serve</code>
      </p>
    </section>
  </main>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ArrowLeft, RefreshCw as Refresh } from '@lucide/vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { getDocsBase } from '@/components/common/docsRegistry'
  import { checkDocsAvailability } from '@/utils/serviceAvailability'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const checking = ref(false)
  const isDev = import.meta.env.DEV

  async function retry() {
    checking.value = true
    try {
      if (await checkDocsAvailability(getDocsBase())) {
        window.location.assign(getDocsBase())
      }
    } finally {
      checking.value = false
    }
  }

  function backToConsole() {
    if (window.history.length > 1) router.back()
    else void router.push('/')
  }
</script>

<style scoped>
  .docs-unavailable-page {
    min-height: 100vh;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: var(--space-xl);
    background: var(--color-bg-page);
  }

  .docs-unavailable-page__content {
    width: min(100%, 640px);
    padding: var(--space-xl);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    box-shadow: var(--shadow-card);
  }

  .docs-unavailable-page__hint {
    margin: 0;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
  }

  .docs-unavailable-page__hint code {
    color: var(--color-text-secondary);
  }
</style>
