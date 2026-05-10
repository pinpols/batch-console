<template>
  <pre class="json-preview"><code>{{ formatted }}</code></pre>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    /** 任意值:对象 / 数组自动 JSON.stringify(2) 美化;字符串原样;null/undefined → 空串 */
    data: unknown
  }>()

  const formatted = computed(() => {
    const v = props.data
    if (v == null) return ''
    if (typeof v === 'string') return v
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  })
</script>
