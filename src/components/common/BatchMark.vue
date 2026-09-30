<template>
  <span
    class="batch-mark"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="label ?? t('nav.appTitle')"
  />
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  withDefaults(defineProps<{ size?: number; label?: string }>(), {
    size: 32,
  })

  const { t } = useI18n()
</script>

<style scoped>
  .batch-mark {
    display: block;
    flex: 0 0 auto;
    background: center / contain no-repeat url('/icons/icon-192-maskable.png');
  }

  :global(html.dark .batch-mark) {
    background-image: url('/icons/icon-192.png');
  }
</style>
