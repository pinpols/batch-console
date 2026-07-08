<template>
  <el-form
    ref="formRef"
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
      <el-button v-if="collapsible" text class="query-collapse-toggle" @click="toggleCollapsed">
        {{ collapsed ? t('proTable.filterExpand') : t('proTable.filterCollapse') }}
        <el-icon class="query-collapse-toggle__chev" :class="{ 'is-collapsed': collapsed }">
          <ChevronUp />
        </el-icon>
      </el-button>
      <el-button
        v-if="showSearch && !(collapsible && collapsed)"
        type="primary"
        :icon="Search"
        :loading="filterBusy"
        :disabled="disabled"
        @click="emit('search')"
      >
        {{ t('common.search') }}
      </el-button>
      <el-button
        v-if="showReset && !(collapsible && collapsed)"
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
  import { computed, onMounted, onUpdated, ref, useAttrs } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import {
    RefreshCw as Refresh,
    RotateCcw as RefreshLeft,
    Search,
    ChevronUp,
  } from 'lucide-vue-next'
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
       * label 位置:'auto'(默认)= 字段 ≤3 时 label 放字段左侧同行(紧凑,用户反馈),
       * 字段多时 label 上置网格;也可显式 'top' / 'left' 锁定。
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

  // 'auto' 模式:数 DOM 里的字段格(不含操作格)决定 label 左置还是上置。
  // 收起态字段仅 display:none 仍在 DOM,计数不受影响;字段动态 v-if 时 onUpdated 重数。
  const formRef = ref<{ $el?: HTMLElement } | null>(null)
  const fieldCount = ref(99)
  function recountFields() {
    const el = formRef.value?.$el
    if (!el) return
    fieldCount.value = el.querySelectorAll('.el-form-item:not(.query-actions)').length
  }
  onMounted(recountFields)
  onUpdated(recountFields)

  const labelLeft = computed(() =>
    props.labelPosition === 'left'
      ? true
      : props.labelPosition === 'top'
        ? false
        : fieldCount.value <= 3,
  )

  const refreshLoading = computed(() =>
    props.refreshBusy === undefined ? props.filterBusy : props.refreshBusy,
  )

  const showTrailing = computed(() => props.showSearch || props.showReset || props.showRefresh)
</script>

<style scoped>
  /* 自管 margin-bottom:让裸用 ListPageQueryBar(不套 ProTable)的页面也跟下方表格
     有标准间距。ProTable 那边把 .pro-table__query 的 margin 清 0 避免叠加 */
  .query-form {
    margin-bottom: 12px;
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
    gap: 8px 12px;
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

  @media (max-width: 720px) {
    .query-form.el-form--inline {
      padding: 0;
    }
  }

  /* 日期范围要放下两个日期,给更宽的弹性基准(flex 折行下自然更宽)。 */
  .query-form :deep(.el-form-item.query-span-2),
  .query-form :deep(.el-form-item:has(.el-date-editor--daterange)),
  .query-form :deep(.el-form-item:has(.el-date-editor--datetimerange)) {
    flex: 1 1 340px;
    max-width: 460px;
  }

  .query-form :deep(.el-form-item.query-span-3) {
    flex: 1 1 480px;
    max-width: 640px;
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
    flex: 0 0 92px;
  }

  .query-form :deep(.dr-preset .el-date-editor) {
    flex: 1;
    min-width: 0;
  }

  /* 字段块 = label 上置 + 控件全宽。flex 弹性项:不长满整行(留右侧空位给操作按钮
     内嵌),窄了自动折行,提升信息密度。 */
  .query-form :deep(.el-form-item) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    margin: 0;
    flex: 1 1 180px;
    min-width: 150px;
    max-width: 240px;
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
    /* 复位 query-w-* 设的固定 --el-input-width,让筛选栏内控件统一填满栅格单元 */
    --el-input-width: 100%;
  }

  /* 统一:筛选栏内所有输入 / 下拉 / 时间选择 / 数字 / 级联控件一律填满栅格单元,
     用 !important 覆盖 query-w-140/160/... 固定宽度 → 单页内(及全站)长短一致、对齐成网格。
     直接子选择器保护 DateRangePresetPicker(.dr-preset)等复合控件的内部布局不被穿透。 */
  .query-form :deep(.el-form-item__content > .el-input),
  .query-form :deep(.el-form-item__content > .el-select),
  .query-form :deep(.el-form-item__content > .el-date-editor),
  .query-form :deep(.el-form-item__content > .el-cascader),
  .query-form :deep(.el-form-item__content > .el-input-number),
  .query-form :deep(.el-form-item__content > .el-autocomplete) {
    width: 100% !important;
    max-width: none !important;
  }

  /* ── label 左置紧凑模式(字段 ≤3 自动启用):label 与控件同行,整条筛选栏收成单行 ── */
  .query-form--label-left :deep(.el-form-item:not(.query-actions)) {
    flex-direction: row;
    align-items: center;
    flex: 0 0 auto;
    min-width: 0;
    max-width: none;
  }

  .query-form--label-left :deep(.el-form-item:not(.query-actions) .el-form-item__label) {
    margin-bottom: 0;
    margin-right: 8px;
  }

  /* 行内模式下控件不再吃满栅格,给固定宽度(query-w-* 固定宽类恢复生效) */
  .query-form--label-left :deep(.el-form-item__content > .el-input),
  .query-form--label-left :deep(.el-form-item__content > .el-select),
  .query-form--label-left :deep(.el-form-item__content > .el-date-editor),
  .query-form--label-left :deep(.el-form-item__content > .el-cascader),
  .query-form--label-left :deep(.el-form-item__content > .el-input-number),
  .query-form--label-left :deep(.el-form-item__content > .el-autocomplete) {
    width: var(--el-input-width, 200px) !important;
  }

  .query-form--label-left :deep(.el-form-item__content) {
    --el-input-width: 200px;
  }

  /* 操作按钮组:尺寸自适应内容 + margin-left:auto 塞进当前行右侧空位;有空同行、
     没空才折行(省行、修此前独占整行/溢出两种毛病)。覆盖字段的 flex 弹性。
     margin 需 !important:上方 :deep(.el-form-item) 的 margin:0 特异度更高,否则靠右失效。 */
  .query-actions {
    flex: 0 0 auto !important;
    min-width: 0 !important;
    max-width: none !important;
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
    flex-wrap: nowrap;
  }
</style>
