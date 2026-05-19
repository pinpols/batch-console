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
  import { DEFAULT_PAGE_SIZES } from '@/constants/pagination'

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
      pageSizes: () => [...DEFAULT_PAGE_SIZES],
      hideWhenSinglePage: true,
      disabled: false,
      layout: 'total, sizes, prev, pager, next, jumper',
    },
  )

  const emit = defineEmits<{
    (e: 'update:page', v: number): void
    (e: 'update:pageSize', v: number): void
  }>()

  // 老逻辑:total <= pageSize 就隐藏整个分页条 → 用户切到 50/100 后看不见 page-size 选择器,
  // 切不回小档。修正:只在「数据本来就装不满最小档」时隐藏(true single-page);
  // 用户主动把档调大后,即便只剩 1 页也要保留 sizes + total,方便切回来。
  const visible = computed(() => {
    if (props.total <= 0) return false
    if (!props.hideWhenSinglePage) return true
    const minSize = Math.min(...(props.pageSizes ?? [props.pageSize]))
    return props.total > minSize
  })

  function onPageChange(p: number) {
    emit('update:page', p)
  }

  /** 仅上报每页条数；翻回第 1 页由 ProTable 等父组件处理 */
  function onSizeChange(s: number) {
    emit('update:pageSize', s)
  }
</script>
