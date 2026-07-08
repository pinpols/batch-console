<template>
  <div class="pro-table">
    <div v-if="$slots.query" class="pro-table__query">
      <slot name="query" />
    </div>
    <div v-if="$slots.toolbar || showColumnSettingsControl" class="pro-table__toolbar">
      <slot name="toolbar" />
      <!-- 列设置:仅在传入 columnConfigId + columnDefs 时渲染,默认行为零变化 -->
      <div v-if="showColumnSettingsControl" class="pro-table__col-settings">
        <el-popover
          placement="bottom-end"
          trigger="click"
          :width="240"
          popper-class="pro-table__col-popover"
        >
          <template #reference>
            <el-button size="small" :icon="Operation" plain>
              {{ t('proTable.columnSettings.trigger') }}
            </el-button>
          </template>
          <div class="pro-table__col-panel">
            <div class="pro-table__col-panel-head">
              <span class="pro-table__col-panel-title">{{
                t('proTable.columnSettings.title')
              }}</span>
              <div class="pro-table__col-panel-ops">
                <el-button link size="small" @click="selectAllColumns">{{
                  t('proTable.columnSettings.selectAll')
                }}</el-button>
                <el-button link size="small" @click="invertColumns">{{
                  t('proTable.columnSettings.invert')
                }}</el-button>
                <el-button link size="small" @click="resetColumns">{{
                  t('proTable.columnSettings.reset')
                }}</el-button>
              </div>
            </div>
            <div class="pro-table__col-list">
              <el-checkbox
                v-for="def in columnDefs"
                :key="def.key"
                :model-value="isColVisible(def.key)"
                :disabled="def.hideable === false"
                :title="def.hideable === false ? t('proTable.columnSettings.required') : ''"
                @update:model-value="(v: boolean) => toggleColumn(def.key, v)"
              >
                {{ def.label }}
              </el-checkbox>
            </div>
          </div>
        </el-popover>
      </div>
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
        <!-- 默认插槽透出 isColVisible:接入列设置的页面用它给每列加 v-if;
             不读这两个 slot prop 的旧页面行为完全不变(向后兼容) -->
        <slot :is-col-visible="isColVisible" :visible-keys="visibleKeys" />
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
  import { computed, onMounted, ref, watch } from 'vue'
  import type { TableInstance } from 'element-plus'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh, SlidersHorizontal as Operation } from 'lucide-vue-next'

  /**
   * 列设置的列描述。key 与页面里 el-table-column 的标识一一对应。
   * - hideable:false → 必选列(状态/操作等),checkbox 灰显不可取消
   * - defaultHidden:true → 默认隐藏的工程字段(instanceNo/queue/trace 等)
   */
  interface ProTableColumnDef {
    key: string
    label: string
    hideable?: boolean
    defaultHidden?: boolean
  }

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
      /** 启用列显隐逻辑时是否展示列设置入口;设计还原页可关闭入口但保留默认列集 */
      showColumnSettings?: boolean
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
      /**
       * 列设置能力开关:传入唯一 id(如 'job-instances')即启用列显隐工具,
       * 选择持久化到 localStorage('protable-cols:<id>')。不传则该能力完全关闭,行为不变。
       */
      columnConfigId?: string
      /** 列描述(配合 columnConfigId);声明每列 key/label/可隐藏性/默认隐藏 */
      columnDefs?: ProTableColumnDef[]
    }>(),
    {
      loading: false,
      border: true,
      hasActiveFilters: false,
      showPager: true,
      hidePagerWhenSinglePage: true,
      pageSizes: () => [...DEFAULT_PAGE_SIZES],
      showColumnSettings: true,
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

  // ── 列显隐(column settings)──────────────────────────────────────────────
  // 仅当同时传入 columnConfigId + 非空 columnDefs 时启用;否则整套能力关闭。
  const hasColumnSettings = computed(
    () => !!props.columnConfigId && (props.columnDefs?.length ?? 0) > 0,
  )
  const showColumnSettingsControl = computed(
    () => props.showColumnSettings && hasColumnSettings.value,
  )
  const colStorageKey = computed(() => 'protable-cols:' + (props.columnConfigId ?? ''))

  // 用"隐藏 key 集合"建模:默认值 = 声明了 defaultHidden 的列。
  const hiddenKeys = ref<Set<string>>(new Set())

  function defaultHiddenSet(): Set<string> {
    return new Set((props.columnDefs ?? []).filter((d) => d.defaultHidden).map((d) => d.key))
  }

  function loadHiddenFromStorage() {
    if (!hasColumnSettings.value) return
    let next = defaultHiddenSet()
    try {
      const raw = localStorage.getItem(colStorageKey.value)
      if (raw) {
        const saved = JSON.parse(raw) as string[]
        if (Array.isArray(saved)) {
          const known = new Set((props.columnDefs ?? []).map((d) => d.key))
          // 必选列(hideable:false)永不隐藏,过滤掉脏数据
          const required = new Set(
            (props.columnDefs ?? []).filter((d) => d.hideable === false).map((d) => d.key),
          )
          next = new Set(saved.filter((k) => known.has(k) && !required.has(k)))
        }
      }
    } catch {
      /* localStorage 不可用 / JSON 坏 — 回退默认 */
    }
    hiddenKeys.value = next
  }

  function persistHidden() {
    if (!hasColumnSettings.value) return
    try {
      localStorage.setItem(colStorageKey.value, JSON.stringify([...hiddenKeys.value]))
    } catch {
      /* localStorage 不可用 — 忽略 */
    }
  }

  function isColVisible(key: string): boolean {
    // 没启用列设置时一律可见,保证不接入的页面零影响
    if (!hasColumnSettings.value) return true
    return !hiddenKeys.value.has(key)
  }

  const visibleKeys = computed(() =>
    (props.columnDefs ?? []).map((d) => d.key).filter((k) => isColVisible(k)),
  )

  function toggleColumn(key: string, visible: boolean) {
    const def = (props.columnDefs ?? []).find((d) => d.key === key)
    if (def?.hideable === false) return // 必选列不可隐藏
    const next = new Set(hiddenKeys.value)
    if (visible) next.delete(key)
    else next.add(key)
    hiddenKeys.value = next
    persistHidden()
  }

  function selectAllColumns() {
    hiddenKeys.value = new Set()
    persistHidden()
  }

  function invertColumns() {
    const next = new Set<string>()
    for (const def of props.columnDefs ?? []) {
      // 必选列保持可见;其余取反
      if (def.hideable === false) continue
      if (!hiddenKeys.value.has(def.key)) next.add(def.key)
    }
    hiddenKeys.value = next
    persistHidden()
  }

  function resetColumns() {
    hiddenKeys.value = defaultHiddenSet()
    persistHidden()
  }

  onMounted(loadHiddenFromStorage)
  // columnConfigId 切换(如同组件复用到不同页面)时重载持久化选择
  watch(() => props.columnConfigId, loadHiddenFromStorage)

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
    position: relative;
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

  /* 工具行:实时状态/批量条在左、列设置在右,正常文档流一行。
     此前 height:0 + 绝对定位把内容叠进表头(「●实时」压住「状态」列),已废弃该 hack。 */
  .pro-table__toolbar {
    min-height: 28px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pro-table__col-settings {
    margin-left: auto;
  }

  .pro-table__col-panel-head {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
  }

  .pro-table__col-panel-title {
    font-weight: 600;
    font-size: 13px;
  }

  .pro-table__col-panel-ops {
    display: flex;
    gap: 8px;
  }

  .pro-table__col-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 320px;
    overflow-y: auto;
  }

  .pro-table__pager {
    width: 100%;
    min-width: 0;
  }
</style>
