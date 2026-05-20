<template>
  <div class="pro-pagination">
    <!-- offset 模式:el-pagination 跳页 + 总数 -->
    <el-pagination
      v-if="mode === 'page'"
      small
      background
      layout="total, prev, pager, next, sizes"
      :total="total ?? 0"
      :current-page="pageNo ?? 1"
      :page-size="pageSize"
      :page-sizes="pageSizes"
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />

    <!-- cursor 模式:上一页 / 下一页 + size 选择 -->
    <div v-else class="pro-pagination__cursor">
      <el-button :disabled="!hasPrev" size="small" @click="$emit('prev')">
        {{ t('proPagination.prev') }}
      </el-button>
      <el-button :disabled="!hasMore" size="small" @click="$emit('next')">
        {{ t('proPagination.next') }}
      </el-button>
      <el-select
        :model-value="pageSize"
        size="small"
        class="pro-pagination__size"
        @change="$emit('size-change', $event)"
      >
        <el-option
          v-for="size in pageSizes"
          :key="size"
          :label="t('proPagination.pageSizeLabel', { n: size })"
          :value="size"
        />
      </el-select>
      <span class="pro-pagination__hint">{{ t('proPagination.cursorHint') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * 双轨分页组件(ADR-031)。
   * - mode='page':渲染 el-pagination,支持跳页 + 总数
   * - mode='cursor':渲染「上一页 / 下一页 + size」,不支持跳页 / 总数
   */
  import { useI18n } from 'vue-i18n'
  import type { PaginationMode } from '@/api/pagination'

  const { t } = useI18n({ useScope: 'global' })

  withDefaults(
    defineProps<{
      mode: PaginationMode
      pageNo?: number | null
      pageSize: number
      total?: number | null
      hasMore: boolean
      hasPrev?: boolean
      pageSizes?: number[]
    }>(),
    {
      pageNo: 1,
      total: 0,
      hasPrev: false,
      pageSizes: () => [15, 30, 50, 100],
    },
  )

  const emit = defineEmits<{
    'page-change': [pageNo: number]
    'size-change': [pageSize: number]
    next: []
    prev: []
  }>()

  function onPageChange(n: number) {
    emit('page-change', n)
  }
  function onSizeChange(n: number) {
    emit('size-change', n)
  }
</script>

<style scoped>
  .pro-pagination__cursor {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .pro-pagination__size {
    width: 110px;
  }
  .pro-pagination__hint {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
</style>
