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
        <el-button type="primary" :icon="Refresh" @click="onRetry">{{
          t('common.retry')
        }}</el-button>
      </template>
    </EmptyState>
    <template v-else>
      <el-table
        ref="tableRef"
        :data="data"
        v-loading="loading"
        stripe
        size="small"
        highlight-current-row
        :border="border"
        :empty-text="hasActiveFilters ? resolvedFilteredEmpty : resolvedEmpty"
        class="pro-table__table console-table"
        v-bind="$attrs"
      >
        <slot />
        <!-- 过滤无结果时不抢 #empty 槽,继续走 filteredEmptyText;
             仅在"零数据 + 无筛选"时让父组件用 #empty 渲染引导卡片(EmptyState + CTA) -->
        <template v-if="!hasActiveFilters && $slots.empty" #empty>
          <slot name="empty" />
        </template>
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
  import { computed, onMounted, ref } from 'vue'
  import type { TableInstance } from 'element-plus'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })
  import TableSkeleton from '@/components/table/TableSkeleton.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { DEFAULT_PAGE_SIZES } from '@/constants/pagination'

  defineOptions({ inheritAttrs: false })

  const props = withDefaults(
    defineProps<{
      // el-table `data` 要求 mutable any[]。这里用 unknown[](非 readonly)既兼容
      // el-table 内部赋值,也保留对调用方"传 RemoteData<T>[] 等子集"的接纳。
      data: unknown[]
      loading?: boolean
      total: number
      /** 1-based，与 OpenAPI PageRequest.pageNo 一致 */
      page: number
      pageSize: number
      /** 单元格线框表格 */
      border?: boolean
      /** 空数据文案;不传则用 i18n proTable.empty */
      emptyText?: string
      /** 有筛选条件时的空数据文案;不传则用 i18n proTable.filteredEmpty */
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
      /** pageSize 持久化到 localStorage(默认开,opt-out 用 false) */
      persistPageSize?: boolean
      /** 持久化 key 后缀;不传则自动用 route.path,确保每页独立 */
      persistKey?: string
    }>(),
    {
      loading: false,
      border: true,
      hasActiveFilters: false,
      showPager: true,
      hidePagerWhenSinglePage: true,
      pageSizes: () => [...DEFAULT_PAGE_SIZES],
      skeletonRows: 6,
      error: undefined,
      persistPageSize: true,
    },
  )

  // pageSize 持久化:用户在 A 页选 50,刷新或 B 页回 A 页应该还是 50,而不是掉回 20
  // key:'pro-table:pageSize:' + (显式传的 persistKey ?? 当前路由 path)
  const route = useRoute()
  const storageKey = computed(
    () => 'pro-table:pageSize:' + (props.persistKey || route.path || 'global'),
  )

  onMounted(() => {
    if (!props.persistPageSize) return
    try {
      const saved = Number(localStorage.getItem(storageKey.value))
      if (saved > 0 && saved !== props.pageSize && (props.pageSizes ?? []).includes(saved)) {
        emit('update:pageSize', saved)
      }
    } catch {
      /* localStorage 不可用(隐身模式 / quota) — 忽略 */
    }
  })

  const resolvedEmpty = computed(() => props.emptyText?.trim() || t('proTable.empty'))
  const resolvedFilteredEmpty = computed(
    () => props.filteredEmptyText?.trim() || t('proTable.filteredEmpty'),
  )

  const resolvedErrorText = computed(() => {
    if (props.errorText?.trim()) return props.errorText.trim()
    if (props.error instanceof Error && props.error.message) return props.error.message
    return t('proTable.loadFailed')
  })

  const emit = defineEmits<{
    (e: 'update:page', v: number): void
    (e: 'update:pageSize', v: number): void
    (e: 'change'): void
  }>()

  // 暴露内部 el-table 句柄,供批量选择场景清空勾选(useBulkSelection.bindTable 用)
  const tableRef = ref<TableInstance>()
  defineExpose({
    clearSelection: () => tableRef.value?.clearSelection(),
    toggleRowSelection: (row: unknown, selected?: boolean) =>
      tableRef.value?.toggleRowSelection(row as Record<string, unknown>, selected),
  })

  function onPageChange(p: number) {
    emit('update:page', p)
    emit('change')
  }

  function onSizeChange(s: number) {
    if (props.persistPageSize) {
      try {
        localStorage.setItem(storageKey.value, String(s))
      } catch {
        /* localStorage 不可用 — 忽略 */
      }
    }
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

  /* query slot 内的 ListPageQueryBar 自管 margin-bottom,这里清 0 避免叠加;
     非 ListPageQueryBar 内容(自定义 toolbar 之类)需要自己加 margin */
  .pro-table__query {
    margin-bottom: 0;
  }

  .pro-table__toolbar {
    margin-bottom: var(--page-block-gap);
  }

  .pro-table__pager {
    width: 100%;
    min-width: 0;
  }
</style>
