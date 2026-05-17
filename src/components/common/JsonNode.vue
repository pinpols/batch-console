<template>
  <span
    v-if="kind === 'primitive'"
    :class="['json-node__val', `json-node__val--${primitiveType}`]"
    >{{ primitiveDisplay }}</span
  >
  <span v-else class="json-node__group">
    <span
      class="json-node__toggle"
      role="button"
      tabindex="0"
      @click="open = !open"
      @keydown.enter.prevent="open = !open"
      @keydown.space.prevent="open = !open"
    >
      <span class="json-node__arrow">{{ open ? '▾' : '▸' }}</span>
      <span class="json-node__bracket">{{ kind === 'array' ? '[' : '{' }}</span>
      <span v-if="!open" class="json-node__summary">
        {{ entries.length }} {{ kind === 'array' ? 'items' : 'keys' }}
      </span>
      <span v-if="!open" class="json-node__bracket">{{ kind === 'array' ? ']' : '}' }}</span>
    </span>
    <template v-if="open">
      <div v-for="(entry, idx) in entries" :key="entry.key" class="json-node__row">
        <span class="json-node__indent" :style="{ width: `${(depth + 1) * 14}px` }" />
        <span v-if="kind === 'object'" class="json-node__key">"{{ entry.key }}"</span>
        <span v-if="kind === 'object'" class="json-node__colon">:&nbsp;</span>
        <JsonNode :value="entry.value" :depth="depth + 1" :is-last="idx === entries.length - 1" />
      </div>
      <div class="json-node__row json-node__row--close">
        <span class="json-node__indent" :style="{ width: `${depth * 14}px` }" />
        <span class="json-node__bracket">{{ kind === 'array' ? ']' : '}' }}</span>
      </div>
    </template>
  </span>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'

  const props = withDefaults(
    defineProps<{
      value: unknown
      depth: number
      isLast?: boolean
    }>(),
    { isLast: true },
  )

  /** 默认顶层收缩(诊断页一屏多卡片不被刷屏),展开后子级保持 1 层可见 */
  const open = ref(props.depth > 0 && props.depth < 3)

  const kind = computed<'primitive' | 'object' | 'array'>(() => {
    const v = props.value
    if (Array.isArray(v)) return 'array'
    if (v !== null && typeof v === 'object') return 'object'
    return 'primitive'
  })

  const primitiveType = computed(() => {
    const v = props.value
    if (v === null) return 'null'
    if (typeof v === 'undefined') return 'null'
    if (typeof v === 'string') return 'string'
    if (typeof v === 'number') return 'number'
    if (typeof v === 'boolean') return 'boolean'
    return 'other'
  })

  const primitiveDisplay = computed(() => {
    const v = props.value
    if (v === null || typeof v === 'undefined') return 'null'
    if (typeof v === 'string') return `"${v}"`
    return String(v)
  })

  const entries = computed(() => {
    const v = props.value
    if (Array.isArray(v)) {
      return v.map((item, i) => ({ key: String(i), value: item as unknown }))
    }
    if (v !== null && typeof v === 'object') {
      return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({
        key: k,
        value: val,
      }))
    }
    return []
  })
</script>

<style scoped>
  .json-node__group {
    display: inline;
  }

  .json-node__toggle {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    gap: 2px;
  }

  .json-node__toggle:hover .json-node__arrow {
    color: var(--color-primary);
  }

  .json-node__arrow {
    display: inline-block;
    width: 12px;
    color: var(--color-text-tertiary);
    font-size: 10px;
    line-height: 1;
  }

  .json-node__bracket {
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  .json-node__summary {
    margin: 0 4px;
    color: var(--color-text-tertiary);
    font-style: italic;
    font-size: 11.5px;
  }

  .json-node__row {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .json-node__indent {
    display: inline-block;
    flex-shrink: 0;
  }

  .json-node__key {
    color: #c5343d;
  }

  html.dark .json-node__key {
    color: #ff6b7a;
  }

  .json-node__colon {
    color: var(--color-text-secondary);
  }

  .json-node__val--string {
    color: #1a7f37;
    word-break: break-all;
  }

  html.dark .json-node__val--string {
    color: #7ee787;
  }

  .json-node__val--number {
    color: #d97706;
  }

  html.dark .json-node__val--number {
    color: #f0883e;
  }

  .json-node__val--boolean {
    color: #7c3aed;
    font-weight: 600;
  }

  html.dark .json-node__val--boolean {
    color: #c084fc;
  }

  .json-node__val--null {
    color: var(--color-text-tertiary);
    font-style: italic;
  }
</style>
