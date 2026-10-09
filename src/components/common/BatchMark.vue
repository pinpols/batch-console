<template>
  <span
    class="batch-mark"
    :class="{ 'batch-mark--tight': tight }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="label ?? t('nav.appTitle')"
  />
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'

  withDefaults(defineProps<{ size?: number; label?: string; tight?: boolean }>(), {
    size: 32,
    tight: false,
  })

  const { t } = useI18n()
</script>

<style scoped>
  .batch-mark {
    display: block;
    flex: 0 0 auto;
    overflow: hidden;
    border-radius: 25%;
    background: center / contain no-repeat url('/icons/icon-192-maskable.png');
  }

  .batch-mark--tight {
    background-size: 122%;
  }

  :global(html.dark .batch-mark) {
    background-image: url('/icons/icon-192.png');
  }
</style>
