<template>
  <el-drawer v-model="visible" :title="title" size="720px">
    <div v-if="row" class="detail-drawer">
      <div class="detail-drawer__meta">
        <div v-for="item in metaRows" :key="item.label" class="detail-drawer__meta-row">
          <span class="detail-drawer__label">{{ item.label }}</span>
          <CopyableText :text="item.value" />
        </div>
      </div>
      <pre class="json-preview">{{ detailJson }}</pre>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import CopyableText from '@/components/common/CopyableText.vue'

  const visible = defineModel<boolean>('visible', { required: true })

  const props = defineProps<{
    title: string
    row: Record<string, unknown> | null
    metaRows: Array<{ label: string; value: string }>
  }>()

  const detailJson = computed(() => {
    if (!props.row) return ''
    try {
      return JSON.stringify(props.row, null, 2)
    } catch {
      return String(props.row)
    }
  })
</script>
