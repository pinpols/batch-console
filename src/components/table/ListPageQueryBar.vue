<template>
  <el-form
    inline
    class="query-form"
    :class="`query-form--cols-${cols}`"
    v-bind="attrs"
    @submit.prevent="emit('search')"
  >
    <!-- prepend: 查询条件之前的辅助内容；新增/创建类主操作应放 PageHeader 或子模块标题右侧。 -->
    <slot name="prepend" />
    <slot />
    <el-form-item v-if="showTrailing" class="query-actions">
      <el-button
        v-if="showSearch"
        type="primary"
        :icon="Search"
        :loading="filterBusy"
        :disabled="disabled"
        @click="emit('search')"
      >
        {{ t('common.search') }}
      </el-button>
      <el-button
        v-if="showReset"
        :icon="RefreshLeft"
        :loading="filterBusy"
        :disabled="disabled"
        @click="emit('reset')"
      >
        {{ t('common.reset') }}
      </el-button>
      <el-button
        v-if="showRefresh"
        :icon="Refresh"
        :loading="refreshLoading"
        :disabled="disabled"
        @click="emit('refresh')"
      >
        {{ t('common.refresh') }}
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
  import { computed, useAttrs } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'
  const { t } = useI18n({ useScope: 'global' })

  defineOptions({ inheritAttrs: false })

  const props = withDefaults(
    defineProps<{
      /** 查询 / 重置按钮 loading */
      filterBusy?: boolean
      /** 刷新按钮 loading；不传则与 filterBusy 相同 */
      refreshBusy?: boolean
      disabled?: boolean
      showSearch?: boolean
      showReset?: boolean
      showRefresh?: boolean
      /** 网格列数 2/3/4 三档,默认 3。字段少用 2,字段多用 4 */
      cols?: 2 | 3 | 4
    }>(),
    {
      filterBusy: false,
      refreshBusy: undefined,
      disabled: false,
      showSearch: true,
      showReset: true,
      showRefresh: true,
      cols: 3,
    },
  )

  const emit = defineEmits<{
    search: []
    reset: []
    refresh: []
  }>()

  const attrs = useAttrs()

  const refreshLoading = computed(() =>
    props.refreshBusy === undefined ? props.filterBusy : props.refreshBusy,
  )

  const showTrailing = computed(() => props.showSearch || props.showReset || props.showRefresh)
</script>

<style scoped>
  /* 自管 margin-bottom:让裸用 ListPageQueryBar(不套 ProTable)的页面也跟下方表格
     有标准间距。ProTable 那边把 .pro-table__query 的 margin 清 0 避免叠加 */
  .query-form {
    margin-bottom: var(--page-block-gap);
  }

  /* ──────────────────────────────────────────────
   * Grid 布局:列等宽自动折行,扫视性 > 紧凑性
   * 每列最小 300px,自适应填满容器宽度
   * ────────────────────────────────────────────── */
  .query-form.el-form--inline {
    display: grid;
    gap: 12px 20px;
    align-items: center;
    padding: 16px 20px;
    background: color-mix(in srgb, var(--color-bg-card) 60%, var(--color-bg-subtle, #fafbfc));
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content, 10px);
  }

  /* 字段少 → 2 列;min 防过窄,max 防超宽 */
  .query-form--cols-2.el-form--inline {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: min(100%, 560px);
    max-width: 880px;
  }

  /* 默认 3 列 */
  .query-form--cols-3.el-form--inline {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-width: min(100%, 840px);
    max-width: 1320px;
  }

  /* 字段多 → 4 列 */
  .query-form--cols-4.el-form--inline {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    min-width: min(100%, 1120px);
    max-width: 1680px;
  }

  html.dark .query-form.el-form--inline {
    background: rgb(255 255 255 / 2%);
  }

  /* 响应式降级:窄屏自动收 1 档 */
  @media (max-width: 1100px) {
    .query-form--cols-4.el-form--inline {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .query-form--cols-3.el-form--inline {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .query-form.el-form--inline {
      grid-template-columns: 1fr !important;
      padding: 12px;
    }
  }

  /* 日期范围:占 2 个 grid 列;datetime 范围更长占 3 列 */
  .query-form :deep(.el-form-item:has(.el-date-editor--daterange)),
  .query-form :deep(.el-form-item.query-span-2) {
    grid-column: span 2;
  }

  .query-form :deep(.el-form-item:has(.el-date-editor--datetimerange)),
  .query-form :deep(.el-form-item.query-span-3) {
    grid-column: span 3;
  }

  /* 控件填满 form-item 余下空间,不让 EP 默认 220px 卡死 */
  .query-form :deep(.el-date-editor--daterange),
  .query-form :deep(.el-date-editor--datetimerange) {
    width: 100% !important;
  }

  /* placeholder 比 input value 略小,容纳更长提示文字(如 requestId / jobCode / traceId) */
  .query-form :deep(.el-input__inner::placeholder),
  .query-form :deep(.el-textarea__inner::placeholder),
  .query-form :deep(.el-select__placeholder),
  .query-form :deep(.el-range-input::placeholder) {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  /* DateRangePresetPicker(preset + range 复合)给 range 控件留弹性收缩 */
  .query-form :deep(.dr-preset) {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .query-form :deep(.dr-preset__select) {
    flex: 0 0 110px;
  }

  .query-form :deep(.dr-preset .el-date-editor) {
    flex: 1;
    min-width: 0;
  }

  .query-form :deep(.el-form-item) {
    margin: 0;
    width: 100%;
  }

  .query-form :deep(.el-form-item__label) {
    color: var(--color-text-secondary);
    font-size: 13px;
    justify-content: flex-end;
    text-align: right;
    padding-right: 8px;
    flex: 0 0 auto;
    min-width: 64px;
  }

  .query-form :deep(.el-form-item__content) {
    flex: 1;
    min-width: 0;
  }

  /* 输入控件默认填满 form-item content 区,query-w-* 类可覆盖 */
  .query-form :deep(.el-form-item__content > .el-input),
  .query-form :deep(.el-form-item__content > .el-select),
  .query-form :deep(.el-form-item__content > .el-date-editor),
  .query-form :deep(.el-form-item__content > .el-cascader),
  .query-form :deep(.el-form-item__content > .el-input-number),
  .query-form :deep(.el-form-item__content > .el-autocomplete) {
    width: 100%;
  }

  /* 操作按钮组 = 最后一行最右,buttons 横向排列;不会被 grid 拉伸 */
  .query-actions {
    grid-column: -1 / -1;
    justify-self: end;
  }

  .query-actions :deep(.el-form-item__label) {
    display: none;
  }

  .query-actions :deep(.el-form-item__content) {
    gap: 8px;
    flex-wrap: nowrap;
  }
</style>
