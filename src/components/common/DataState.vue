<template>
  <!-- loading 首屏(rows 都还没拿到):骨架 -->
  <TableSkeleton v-if="loading && !hasData" :rows="skeletonRows" />

  <!-- error:用 EmptyState 'error' 变体 + 重试按钮(若 onRetry 提供) -->
  <EmptyState v-else-if="error" variant="error" :description="errorText">
    <template v-if="onRetry" #action>
      <el-button type="primary" :icon="Refresh" @click="onRetry">重试</el-button>
    </template>
  </EmptyState>

  <!-- empty:已加载但没数据 -->
  <EmptyState v-else-if="!hasData" :description="emptyText" />

  <!-- 有数据:把内容交给 default slot,父组件渲染 el-table 等 -->
  <slot v-else />
</template>

<script setup lang="ts">
  /**
   * 列表 / 卡片三态(loading / error / empty / data)统一容器。
   *
   * 用法:
   *   <DataState :loading="loading" :error="errorRef" :has-data="rows.length > 0" :on-retry="load">
   *     <el-table :data="rows" ...>...</el-table>
   *   </DataState>
   *
   * 设计意图:
   *  - 首屏 loading 用骨架(感知更快),数据已有时只用 v-loading 不切骨架避免抖动
   *  - error 与 empty 区别清晰,error 有重试 CTA;以前各页都把 error 退化成"暂无数据",
   *    用户分不清是真空还是失败
   *  - 不强制迁移,新页 + 高流量页用,存量页可保留 v-loading + empty-text 范式
   */
  import { computed } from 'vue'
  import { Refresh } from '@element-plus/icons-vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import TableSkeleton from '@/components/table/TableSkeleton.vue'

  const props = withDefaults(
    defineProps<{
      loading?: boolean
      error?: unknown
      hasData?: boolean
      emptyText?: string
      errorText?: string
      skeletonRows?: number
      onRetry?: () => void | Promise<void>
    }>(),
    {
      loading: false,
      error: null,
      hasData: false,
      emptyText: '暂无数据',
      skeletonRows: 6,
    },
  )

  const errorText = computed(() => {
    if (props.errorText?.trim()) return props.errorText.trim()
    if (props.error instanceof Error) return props.error.message || '加载失败,请重试'
    return '加载失败,请重试'
  })
</script>
