<template>
  <div class="json-preview" :class="{ 'json-preview--inline': inline }">
    <div v-if="$slots.summary" class="json-preview__summary">
      <slot name="summary" :data="parsed" />
    </div>
    <button
      v-if="!inline && copyable && hasContent"
      class="json-preview__copy"
      type="button"
      :title="copied ? t('common.copied') : t('common.copy')"
      @click="copy"
    >
      <el-icon :size="14"><component :is="copied ? Check : DocumentCopy" /></el-icon>
    </button>
    <div v-if="!hasContent" class="json-preview__empty">—</div>
    <JsonNode v-else :value="parsed" :depth="0" :is-last="true" />
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { ElIcon } from 'element-plus'
  import { Copy as DocumentCopy, Check } from 'lucide-vue-next'
  import { useI18n } from 'vue-i18n'
  import JsonNode from './JsonNode.vue'

  const props = withDefaults(
    defineProps<{
      data: unknown
      copyable?: boolean
      inline?: boolean
    }>(),
    { copyable: true, inline: false },
  )

  const { t } = useI18n({ useScope: 'global' })
  const copied = ref(false)

  // 把 data 归一为可遍历值:object/array 原样、JSON 字符串先 parse、其他原值
  const parsed = computed(() => {
    const v = props.data
    if (v == null || v === '') return null
    if (typeof v === 'string') {
      const trimmed = v.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.parse(trimmed)
        } catch {
          return v
        }
      }
      return v
    }
    return v
  })

  const hasContent = computed(() => {
    const v = parsed.value
    if (v == null) return false
    if (typeof v === 'string') return v.length > 0
    return true
  })

  const serialized = computed(() => {
    const v = parsed.value
    if (v == null) return ''
    if (typeof v === 'string') return v
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  })

  async function copy() {
    try {
      await navigator.clipboard.writeText(serialized.value)
      copied.value = true
      setTimeout(() => (copied.value = false), 1500)
    } catch {
      /* clipboard 拒绝时静默,主要发生在非 https 场景 */
    }
  }
</script>

<style scoped>
  .json-preview {
    position: relative;
    font-family:
      ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--color-text-primary);
    background: var(--color-bg-subtle, #fafbfc);
    border: 1px solid var(--color-border-light);
    border-radius: 8px;
    padding: 12px 14px;
    overflow: auto;
    max-height: 480px;
  }

  html.dark .json-preview {
    background: rgb(255 255 255 / 3%);
  }

  .json-preview--inline {
    padding: 4px 8px;
    max-height: none;
    background: transparent;
    border: none;
  }

  .json-preview__empty {
    color: var(--color-text-tertiary);
  }

  .json-preview__summary {
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--color-border-light);
    font-family: var(--font-family-base, system-ui, sans-serif);
    font-size: 12.5px;
    color: var(--color-text-secondary);
  }

  .json-preview__copy {
    position: absolute;
    top: 6px;
    right: 6px;
    background: rgb(255 255 255 / 80%);
    border: 1px solid var(--color-border-light);
    border-radius: 6px;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--color-text-secondary);
    z-index: 1;
    transition:
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .json-preview__copy:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }

  html.dark .json-preview__copy {
    background: rgb(0 0 0 / 30%);
  }
</style>
