<template>
  <el-table-column v-bind="colProps">
    <template #default="{ row }">
      <!-- 还原设计:时间/编号一律等宽字体 -->
      <span class="dt-mono">{{ fmtDatetime(cellValue(row)) }}</span>
    </template>
  </el-table-column>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { fmtDatetime } from '@/utils/datetime'

  interface Props {
    prop: string
    label?: string
    width?: string | number
    minWidth?: string | number
    sortable?: boolean | string
    fixed?: boolean | string
    showOverflowTooltip?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    width: 160,
  })

  const colProps = computed(() => ({
    prop: props.prop,
    label: props.label,
    width: props.width,
    minWidth: props.minWidth,
    sortable: props.sortable,
    fixed: props.fixed,
    showOverflowTooltip: props.showOverflowTooltip,
  }))

  function cellValue(row: unknown): unknown {
    return (row as Record<string, unknown>)?.[props.prop]
  }
</script>

<style scoped>
  .dt-mono {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-secondary);
  }
</style>
