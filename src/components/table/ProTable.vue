<template>
  <div class="pro-table">
    <div v-if="$slots.query" class="pro-table__query">
      <slot name="query" />
    </div>
    <div v-if="$slots.toolbar" class="pro-table__toolbar">
      <slot name="toolbar" />
    </div>
    <TableSkeleton v-if="loading && !data.length" :rows="skeletonRows" />
    <!-- 加载失败 + 没有历史数据时,展示错误态(可选 retry CTA);避免和"暂无数据"混淆 -->
    <EmptyState v-else-if="error && !data.length" variant="error" :description="resolvedErrorText">
      <template v-if="onRetry" #action>
        <el-button type="primary" :icon="Refresh" @click="onRetry">重试</el-button>
      </template>
    </EmptyState>
    <template v-else>
      <el-table
        :data="data"
        v-loading="loading"
        stripe
        size="small"
        highlight-current-row
        :border="border"
        :empty-text="hasActiveFilters ? filteredEmptyText : emptyText"
        class="pro-table__table console-table"
        v-bind="$attrs"
      >
        <slot />
      </el-table>
      <TablePagerBar
        v-if="showPager"
        class="pro-table__pager"
        :page="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="pageSizes"
        :hide-when-single-page="hidePagerWhenSinglePage"
        @update:page="onPageChange"
        @update:page-size="onSizeChange"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { Refresh } from '@element-plus/icons-vue'
  import TableSkeleton from '@/components/table/TableSkeleton.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import EmptyState from '@/components/common/EmptyState.vue'

  defineOptions({ inheritAttrs: false })

  const props = withDefaults(
    defineProps<{
      data: readonly unknown[]
      loading?: boolean
      total: number
      /** 1-based，与 OpenAPI PageRequest.pageNo 一致 */
      page: number
      pageSize: number
      /** 单元格线框表格 */
      border?: boolean
      /** 空数据文案 */
      emptyText?: string
      /** 有筛选条件时的空数据文案 */
      filteredEmptyText?: string
      /** 当前是否有筛选条件激活 */
      hasActiveFilters?: boolean
      showPager?: boolean
      /** 仅一页数据时隐藏分页条 */
      hidePagerWhenSinglePage?: boolean
      pageSizes?: number[]
      /** 骨架屏行数（首次加载时显示） */
      skeletonRows?: number
      /** 加载失败状态(优先于 emptyText 展示);传 Error 或任意 truthy 值 */
      error?: unknown
      /** 错误态文案;不传则取 error.message 或"加载失败,请重试" */
      errorText?: string
      /** 可选重试回调,传了就在错误态渲染"重试"按钮 */
      onRetry?: () => void | Promise<void>
    }>(),
    {
      loading: false,
      border: true,
      emptyText: '暂无数据',
      filteredEmptyText: '未找到符合条件的数据，请调整筛选条件',
      hasActiveFilters: false,
      showPager: true,
      hidePagerWhenSinglePage: true,
      pageSizes: () => [20, 50, 100, 200],
      skeletonRows: 6,
      error: null,
    },
  )

  // errorText 优先级:显式传 → error.message → 默认文案
  const resolvedErrorText = computed(() => {
    if (props.errorText?.trim()) return props.errorText.trim()
    if (props.error instanceof Error && props.error.message) return props.error.message
    return '加载失败,请重试'
  })

  const emit = defineEmits<{
    (e: 'update:page', v: number): void
    (e: 'update:pageSize', v: number): void
    (e: 'change'): void
  }>()

  function onPageChange(p: number) {
    emit('update:page', p)
    emit('change')
  }

  function onSizeChange(s: number) {
    emit('update:pageSize', s)
    emit('update:page', 1)
    emit('change')
  }
</script>

<style scoped>
  .pro-table {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    align-self: stretch;
  }

  .pro-table__query {
    margin-bottom: var(--page-block-gap);
  }

  .pro-table__toolbar {
    margin-bottom: var(--page-block-gap);
  }

  .pro-table__pager {
    width: 100%;
    min-width: 0;
  }
</style>
