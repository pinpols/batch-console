<template>
  <div v-show="visible" class="table-pager-bar">
    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      :total="total"
      :page-sizes="pageSizes"
      :disabled="disabled"
      size="small"
      :layout="layout"
      background
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'

  const props = withDefaults(
    defineProps<{
      page: number
      pageSize: number
      total: number
      pageSizes?: number[]
      /** 总条数不超过每页条数时隐藏（空表也隐藏） */
      hideWhenSinglePage?: boolean
      disabled?: boolean
      layout?: string
    }>(),
    {
      pageSizes: () => [20, 50, 100, 200],
      hideWhenSinglePage: true,
      disabled: false,
      layout: 'total, sizes, prev, pager, next, jumper',
    },
  )

  const emit = defineEmits<{
    (e: 'update:page', v: number): void
    (e: 'update:pageSize', v: number): void
  }>()

  const visible = computed(() => {
    if (props.total <= 0) return false
    if (!props.hideWhenSinglePage) return true
    return props.total > props.pageSize
  })

  function onPageChange(p: number) {
    emit('update:page', p)
  }

  /** 仅上报每页条数；翻回第 1 页由 ProTable 等父组件处理 */
  function onSizeChange(s: number) {
    emit('update:pageSize', s)
  }
</script>
