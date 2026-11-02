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
    background-image: url('/icons/batch-mark-foreground.svg'), var(--brand-mark-fill);
    background-position: center;
    background-size: contain;
    background-repeat: no-repeat;
    box-shadow:
      0 1px 2px color-mix(in srgb, var(--color-brand-mark-bg) 10%, transparent),
      0 4px 10px color-mix(in srgb, var(--color-brand-mark-bg) 8%, transparent);
  }

  .batch-mark--tight {
    box-shadow: 0 2px 6px color-mix(in srgb, var(--color-brand-mark-bg) 10%, transparent);
  }
</style>
