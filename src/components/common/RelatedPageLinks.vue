<template>
  <nav v-if="links.length" class="related-pages" :aria-label="t('pageHeader.relatedPages')">
    <span class="related-pages__label">{{ t('pageHeader.relatedPages') }}</span>
    <router-link v-for="path in links" :key="path" :to="path" class="related-pages__link">
      {{ t(pageTitleKey(path)) }}
    </router-link>
  </nav>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { pageTitleKey } from '@/constants/pageMeta'
  import { useRouteAccess } from '@/composables/useRouteAccess'

  /** 概览类页面互相指路；只列当前角色能打开的页面。 */
  const props = defineProps<{ paths: readonly string[] }>()

  const { t } = useI18n({ useScope: 'global' })
  const { canOpenPath } = useRouteAccess()
  const links = computed(() => props.paths.filter((path) => canOpenPath(path)))
</script>

<style scoped>
  .related-pages {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    margin: 0 0 12px;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .related-pages__link {
    color: var(--color-primary);
    text-decoration: none;
  }

  .related-pages__link:hover,
  .related-pages__link:focus-visible {
    text-decoration: underline;
  }
</style>
