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
    overflow: hidden;
    border-radius: 25%;
    background-image: url('/icons/batch-mark-foreground.svg'), var(--brand-mark-fill);
    background-position: center;
    background-size: contain;
    background-repeat: no-repeat;
  }
</style>
