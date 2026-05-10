<template>
  <el-drawer v-model="visible" :title="title" :size="size">
    <slot v-if="$slots.default" />
    <template v-else-if="metaRows && metaRows.length">
      <div class="detail-drawer__meta">
        <div v-for="item in metaRows" :key="item.label" class="detail-drawer__meta-row">
          <span class="detail-drawer__label">{{ item.label }}</span>
          <CopyableText :text="item.value" />
        </div>
      </div>
    </template>
    <JsonPreview v-if="raw !== undefined" class="detail-drawer__raw" :data="raw" />
  </el-drawer>
</template>

<script setup lang="ts">
  import CopyableText from './CopyableText.vue'
  import JsonPreview from './JsonPreview.vue'

  const visible = defineModel<boolean>('visible', { required: true })

  withDefaults(
    defineProps<{
      title: string
      size?: string | number
      /** 顶部 label/value 元信息行;默认 slot 优先 */
      metaRows?: Array<{ label: string; value: string }>
      /** 底部原始 JSON 区(传则展示);与默认 slot 可共存 */
      raw?: unknown
    }>(),
    { size: '720px' },
  )
</script>

<style scoped>
  .detail-drawer__meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .detail-drawer__meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--color-bg-card) 85%, var(--color-bg-canvas) 15%);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
  }

  .detail-drawer__label {
    flex: 0 0 auto;
    min-width: 64px;
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 500;
  }

  .detail-drawer__raw {
    margin-top: 12px;
  }
</style>
