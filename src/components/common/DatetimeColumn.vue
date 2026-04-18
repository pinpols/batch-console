<template>
  <el-table-column v-bind="colProps" :formatter="formatter" />
</template>

<script setup lang="ts">
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

  function formatter(_row: unknown, _col: unknown, val: unknown): string {
    return fmtDatetime(val)
  }
</script>
