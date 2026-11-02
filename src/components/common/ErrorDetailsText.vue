<template>
  <CopyableText v-if="code || message" :text="fullText" :copyable="false">
    <span v-if="code" class="mono">[{{ code }}]</span>{{ code && message ? ' ' : ''
    }}<span v-if="message">{{ message }}</span>
  </CopyableText>
  <span v-else class="muted">—</span>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import CopyableText from './CopyableText.vue'

  const props = defineProps<{ code?: string | null; message?: string | null }>()
  const fullText = computed(() => {
    const code = props.code ? `[${props.code}]` : ''
    const separator = props.code && props.message ? ' ' : ''
    return `${code}${separator}${props.message || ''}`
  })
</script>
