<template>
  <!-- loading 首屏(rows 都还没拿到):骨架 -->
  <TableSkeleton v-if="loading && !hasData" :rows="skeletonRows" layout="content" />

  <!-- error:用 EmptyState 'error' 变体 + 重试按钮(若 onRetry 提供) -->
  <EmptyState v-else-if="error" variant="error" :description="errorText">
    <template v-if="onRetry" #action>
      <el-button type="primary" :icon="Refresh" @click="onRetry">{{ t('common.retry') }}</el-button>
    </template>
  </EmptyState>

  <!-- 表格列表用 inline：无数据时仍渲染表格，空态放在表体内，列头保留 -->
  <slot v-else-if="hasData || inline" />

  <!-- empty:已加载但没数据 — 支持 5 类细分文案(filter-empty/tenant-empty/no-permission/...) -->
  <slot v-else name="empty">
    <EmptyState :variant="emptyVariant" :description="emptyTextResolved || undefined" />
  </slot>
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
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { userErrorMessage } from '@/utils/userErrorMessage'
  import TableSkeleton from '@/components/table/TableSkeleton.vue'

  type EmptyVariant = 'empty' | 'filter-empty' | 'tenant-empty' | 'no-permission' | 'service-down'

  const props = withDefaults(
    defineProps<{
      loading?: boolean
      error?: unknown
      hasData?: boolean
      emptyText?: string
      errorText?: string
      skeletonRows?: number
      onRetry?: () => void | Promise<void>
      /** 5 类空态文案细分 — 详见 EmptyState variant */
      emptyVariant?: EmptyVariant
      /**
       * 为 true 时，无数据仍渲染默认插槽（表格），由表格 #empty 显示空态。
       * 加载骨架和错误态仍替换内容。
       */
      inline?: boolean
    }>(),
    {
      loading: false,
      error: undefined,
      hasData: false,
      emptyText: '',
      skeletonRows: 6,
      emptyVariant: 'empty',
      inline: false,
    },
  )

  const { t } = useI18n({ useScope: 'global' })

  const errorText = computed(() => {
    if (props.errorText?.trim()) return props.errorText.trim()
    if (props.error instanceof Error) {
      const error = props.error
      const fallbackMessage = t('empty.error')
      return userErrorMessage(error, fallbackMessage)
    }
    return t('empty.error')
  })

  const emptyTextResolved = computed(() => props.emptyText?.trim() || t('empty.default'))
</script>
