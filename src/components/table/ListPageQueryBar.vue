<template>
  <el-form
    inline
    class="query-form"
    :class="[
      `query-form--cols-${cols}`,
      { 'is-collapsed': collapsible && collapsed, 'query-form--label-left': labelLeft },
    ]"
    v-bind="attrs"
    @submit.prevent="emit('search')"
  >
    <slot />
    <el-form-item v-if="showTrailing || collapsible" class="query-actions">
      <!-- prepend(已保存筛选等辅助控件)与操作按钮同行,不再占字段格(label 上置布局下孤格突兀) -->
      <slot name="prepend" />
      <!-- 收起/展开筛选:放操作组最左(用户反馈),笔记本首屏省 ~113px 竖向空间,状态按路由持久化 -->
      <el-button
        v-if="collapsible"
        text
        native-type="button"
        class="query-collapse-toggle"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >
        {{ collapsed ? t('proTable.filterExpand') : t('proTable.filterCollapse') }}
        <el-icon class="query-collapse-toggle__chev" :class="{ 'is-collapsed': collapsed }">
          <ChevronUp />
        </el-icon>
      </el-button>
      <span v-if="collapsible && collapsed" class="query-collapsed-hint" role="status">
        {{ t('proTable.filtersHidden') }}
      </span>
      <el-button
        v-if="showSearch && !(collapsible && collapsed)"
        type="primary"
        native-type="submit"
        :icon="Search"
        :loading="filterBusy"
        :disabled="disabled"
      >
        {{ t('common.search') }}
      </el-button>
      <el-button
        v-if="showReset"
        native-type="button"
        :icon="RefreshLeft"
        :loading="filterBusy"
        :disabled="disabled"
        @click="emit('reset')"
      >
        {{ t('common.reset') }}
      </el-button>
      <el-button
        v-if="showRefresh"
        native-type="button"
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
  import { computed, ref, useAttrs } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh, RotateCcw as RefreshLeft, Search, ChevronUp } from '@lucide/vue'
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
      /** 是否提供「收起/展开筛选」开关(笔记本首屏省竖向空间),默认开 */
      collapsible?: boolean
      /**
       * label 默认上置；需要紧凑布局时显式使用 'left'。'auto' 兼容为上置。
       */
      labelPosition?: 'auto' | 'top' | 'left'
    }>(),
    {
      filterBusy: false,
      refreshBusy: undefined,
      disabled: false,
      showSearch: true,
      showReset: true,
      showRefresh: true,
      cols: 3,
      collapsible: true,
      labelPosition: 'auto',
    },
  )

  // 收起状态按路由持久化:同一页记住用户的收起/展开偏好。
  const route = useRoute()
  const collapseKey = computed(() => `bc:filter-collapsed:${route.path}`)
  const collapsed = ref(readCollapsed())
  function readCollapsed(): boolean {
    try {
      return localStorage.getItem(`bc:filter-collapsed:${route.path}`) === '1'
    } catch {
      return false
    }
  }
  function toggleCollapsed() {
    collapsed.value = !collapsed.value
    try {
      localStorage.setItem(collapseKey.value, collapsed.value ? '1' : '0')
    } catch {
      /* ignore quota / private-mode */
    }
  }

  const emit = defineEmits<{
    search: []
    reset: []
    refresh: []
  }>()

  const attrs = useAttrs()

  const labelLeft = computed(() => props.labelPosition === 'left')

  const refreshLoading = computed(() =>
    props.refreshBusy === undefined ? props.filterBusy : props.refreshBusy,
  )

  const showTrailing = computed(() => props.showSearch || props.showReset || props.showRefresh)
</script>

<style scoped>
  /* 自管 margin-bottom:让裸用 ListPageQueryBar(不套 ProTable)的页面也跟下方表格
     有标准间距。ProTable 那边把 .pro-table__query 的 margin 清 0 避免叠加 */
  .query-form {
    margin-bottom: 8px;
  }

  /* ──────────────────────────────────────────────
   * Redesign filter bar:去冗余卡片壳(无边框/阴影/大内边距),拍扁贴页背景,
   * 提升信息密度、缩短到表格的距离(用户要求主数据默认一页不下滑)。
   * 字段仍是自适应网格,窄屏自动折行。
   * ────────────────────────────────────────────── */
  .query-form.el-form--inline {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 6px 8px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
    width: 100%;
  }

  .query-form--cols-2.el-form--inline,
  .query-form--cols-3.el-form--inline,
  .query-form--cols-4.el-form--inline {
    width: 100%;
  }

  /* 收起态:隐藏所有字段格,只留操作行(收起/展开 + 刷新);筛选栏 ~113px → ~40px */
  .query-form.is-collapsed :deep(.el-form-item):not(.query-actions) {
    display: none;
  }
  .query-collapse-toggle__chev {
    margin-left: 2px;
    transition: transform 0.15s ease;
  }
  .query-collapse-toggle__chev.is-collapsed {
    transform: rotate(180deg);
  }
  .query-collapsed-hint {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    white-space: nowrap;
  }

  @media (max-width: 720px) {
    .query-form.el-form--inline {
      padding: 0;
    }
  }

  /* 日期范围以及预设、时区组成的组合控件按整组宽度换行。 */
  .query-form :deep(.el-form-item.query-span-2),
  .query-form :deep(.el-form-item:has(.el-date-editor--daterange)),
  .query-form :deep(.el-form-item:has(.el-date-editor--datetimerange)),
  .query-form :deep(.el-form-item:has(.el-date-editor--monthrange)) {
    --query-field-width: 360px;
  }

  .query-form :deep(.el-form-item.query-span-3),
  .query-form :deep(.el-form-item:has(.dr-preset)) {
    --query-field-width: 440px;
  }

  .query-form :deep(.el-form-item:has(.dr-preset .el-date-editor--datetimerange)) {
    --query-field-width: 560px;
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
    flex: 0 0 130px;
  }

  .query-form :deep(.dr-preset__viewport) {
    flex: 1 1 260px;
    min-width: min(100%, 260px);
  }

  .query-form :deep(.dr-preset__viewport:has(.el-date-editor--datetimerange)) {
    flex-basis: 380px;
    min-width: min(100%, 380px);
  }

  .query-form :deep(.dr-preset .el-date-editor) {
    flex: 1 0 100%;
  }

  @media (max-width: 720px) {
    .query-form :deep(.dr-preset__select),
    .query-form :deep(.dr-preset__viewport) {
      flex: 1 1 100%;
    }
  }

  /* 目标宽度决定字段的折行，而不是按字段数量压缩到统一上限。 */
  .query-form :deep(.el-form-item) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    margin: 0;
    flex: 0 1 var(--query-field-width, 220px);
    min-width: min(100%, var(--query-field-width, 220px));
    max-width: 100%;
  }

  .query-form :deep(.el-form-item.query-size-short) {
    --query-field-width: 136px;
  }
  .query-form :deep(.el-form-item.query-size-medium) {
    --query-field-width: 240px;
  }
  .query-form :deep(.el-form-item.query-size-long) {
    --query-field-width: 360px;
  }
  .query-form :deep(.el-form-item.query-size-range) {
    --query-field-width: 440px;
  }

  /* 显式语义尺寸优先；旧 query-w-* 作为兼容档位。 */
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-120))) {
    --query-field-width: 120px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-140))) {
    --query-field-width: 140px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-160))) {
    --query-field-width: 160px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-168))) {
    --query-field-width: 168px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-180))) {
    --query-field-width: 180px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-190))) {
    --query-field-width: 190px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-200))) {
    --query-field-width: 200px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-220))) {
    --query-field-width: 220px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-240))) {
    --query-field-width: 240px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-260))) {
    --query-field-width: 260px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-280))) {
    --query-field-width: 280px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-300))) {
    --query-field-width: 300px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-320))) {
    --query-field-width: 320px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-340))) {
    --query-field-width: 340px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-360))) {
    --query-field-width: 360px;
  }
  .query-form :deep(.el-form-item:has(> :where(.el-form-item__content) > :where(.query-w-full))) {
    --query-field-width: 100%;
  }

  .query-form :deep(.el-form-item__label) {
    height: auto;
    margin-bottom: 6px;
    padding: 0;
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.2;
    justify-content: flex-start;
    text-align: left;
    width: auto;
    max-width: none;
    white-space: nowrap;
  }

  .query-form :deep(.el-form-item__content) {
    display: flex;
    flex: 1;
    width: 100%;
    min-width: 0;
  }

  /* 控件填满字段，复合控件内部宽度由其自身维护。 */
  .query-form :deep(.el-form-item__content > .el-input),
  .query-form :deep(.el-form-item__content > .el-select),
  .query-form :deep(.el-form-item__content > .el-date-editor),
  .query-form :deep(.el-form-item__content > .el-cascader),
  .query-form :deep(.el-form-item__content > .el-input-number),
  .query-form :deep(.el-form-item__content > .el-autocomplete) {
    width: 100% !important;
    max-width: none !important;
  }

  /* 显式左置模式保留字段宽度，并在空间不足时允许收缩换行。 */
  .query-form--label-left :deep(.el-form-item:not(.query-actions)) {
    flex-direction: row;
    align-items: center;
    flex: 0 1 auto;
    min-width: 0;
  }

  .query-form--label-left :deep(.el-form-item:not(.query-actions) .el-form-item__label) {
    margin-bottom: 0;
    margin-right: 8px;
  }

  .query-form--label-left :deep(.el-form-item:not(.query-actions) .el-form-item__content) {
    flex: 0 1 auto;
    width: min(100%, var(--query-field-width, 220px));
  }

  /* 操作按钮组:尺寸自适应内容 + margin-left:auto 塞进当前行右侧空位;有空同行、
     没空才折行(省行、修此前独占整行/溢出两种毛病)。覆盖字段的 flex 弹性。
     margin 需 !important:上方 :deep(.el-form-item) 的 margin:0 特异度更高,否则靠右失效。 */
  .query-actions {
    flex: 0 0 auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    margin: 0 0 0 auto !important;
    align-self: end;
  }

  .query-actions :deep(.el-form-item__label) {
    display: none;
  }

  .query-actions :deep(.el-form-item__content) {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .query-actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }
</style>
