<template>
  <div class="virtual-pro-table">
    <div v-if="$slots.query" class="virtual-pro-table__query">
      <slot name="query" />
    </div>
    <div v-if="$slots.toolbar" class="virtual-pro-table__toolbar">
      <slot name="toolbar" />
    </div>

    <TableSkeleton v-if="loading && !data.length" :rows="skeletonRows" />

    <EmptyState v-else-if="error && !data.length" variant="error" :description="resolvedErrorText">
      <template v-if="onRetry" #action>
        <el-button type="primary" :icon="Refresh" @click="onRetry">
          {{ t('common.retry') }}
        </el-button>
      </template>
    </EmptyState>

    <template v-else>
      <el-auto-resizer>
        <template #default="{ height, width }">
          <el-table-v2
            :columns="columns as Column<unknown>[]"
            :data="data as unknown[]"
            :width="width"
            :height="height || defaultHeight"
            :row-key="rowKey"
            :estimated-row-height="estimatedRowHeight"
            :fixed="true"
            class="virtual-pro-table__table"
          >
            <template v-if="loading" #empty>
              <div class="virtual-pro-table__loading">
                <el-icon class="is-loading"><Loading /></el-icon>
                {{ t('proTable.loadingMore') }}
              </div>
            </template>
          </el-table-v2>
        </template>
      </el-auto-resizer>
      <TablePagerBar
        v-if="showPager"
        class="virtual-pro-table__pager"
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
  /**
   * 虚拟滚动版列表表格,基于 el-table-v2。
   *
   * 跟 ProTable 的差异:
   *  - 列定义走 :columns props(不是 slot),每行 { key, dataKey, title, width, cellRenderer }
   *  - 适合行数 ≥ 1000 / 单页超大数据集场景;普通分页(20-200 行)用 ProTable 即可
   *  - 不支持复杂 slot 定制(自定义渲染走 cellRenderer)
   *
   * 用法:
   *   const columns = [
   *     { key: 'id', dataKey: 'id', title: 'ID', width: 80 },
   *     { key: 'name', dataKey: 'name', title: '名称', width: 200 },
   *     {
   *       key: 'op', title: '操作', width: 120,
   *       cellRenderer: ({ rowData }) => h('el-button', { onClick: () => view(rowData) }, '查看'),
   *     },
   *   ]
   *   <VirtualProTable :data="rows" :loading="loading" :total="total" :columns="columns" ... />
   *
   * loading / error / empty / 分页 三态行为跟 ProTable 完全一致。
   */
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh, LoaderCircle as Loading } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })
  import type { Column } from 'element-plus'
  import TableSkeleton from '@/components/table/TableSkeleton.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import EmptyState from '@/components/common/EmptyState.vue'

  const props = withDefaults(
    defineProps<{
      data: readonly unknown[]
      columns: readonly Column<unknown>[]
      loading?: boolean
      total: number
      page: number
      pageSize: number
      rowKey?: string
      /** 估算行高(px),el-table-v2 用以预估视口外渲染数;默认 48 */
      estimatedRowHeight?: number
      /** 容器高度兜底(auto-resizer 失效时);默认 480 */
      defaultHeight?: number
      showPager?: boolean
      hidePagerWhenSinglePage?: boolean
      pageSizes?: number[]
      skeletonRows?: number
      error?: unknown
      errorText?: string
      onRetry?: () => void | Promise<void>
    }>(),
    {
      loading: false,
      rowKey: 'id',
      estimatedRowHeight: 48,
      defaultHeight: 480,
      showPager: true,
      hidePagerWhenSinglePage: true,
      pageSizes: () => [50, 100, 200, 500],
      skeletonRows: 8,
      error: undefined,
    },
  )

  const emit = defineEmits<{
    (e: 'update:page', v: number): void
    (e: 'update:pageSize', v: number): void
    (e: 'change'): void
  }>()

  const resolvedErrorText = computed(() => {
    if (props.errorText?.trim()) return props.errorText.trim()
    if (props.error instanceof Error && props.error.message) return props.error.message
    return t('proTable.loadFailed')
  })

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
  .virtual-pro-table {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
  }
  .virtual-pro-table__query,
  .virtual-pro-table__toolbar {
    margin-bottom: var(--page-block-gap);
  }
  .virtual-pro-table__table {
    height: 480px;
    min-height: 240px;
  }
  .virtual-pro-table__pager {
    width: 100%;
    margin-top: var(--page-block-gap);
  }
  .virtual-pro-table__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 32px 0;
    color: var(--color-text-secondary, #606266);
  }
</style>
