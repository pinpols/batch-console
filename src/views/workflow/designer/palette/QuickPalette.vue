<script setup lang="ts">
/**
 * Ctrl+K 快速节点 palette(Polish 阶段)。
 *
 * 触发:Ctrl+K(Mac Cmd+K)+ toolbar 按钮(父组件控制 visible)。
 * 行为:
 * - 模态浮窗 + 输入框 → 模糊匹配节点类型 + (JOB 类型)jobCode 下拉 + (FILE_STEP 类型)pipelineCode 下拉
 * - ↑↓ 切换高亮、Enter 触发"在画布中心点新建该节点"、Esc 关闭
 *
 * 不直接操作 X6,只调 store.addNode + emit('created');父组件决定落点(画布中心)。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTenantStore } from '@/stores/tenant'
import { useDesignerStore } from '../store/useDesignerStore'
import { useJobCodeOptions } from '@/composables/useJobCodeOptions'
import { usePipelineCodeOptions } from '@/composables/usePipelineCodeOptions'
import type { DesignerNodeType } from '../types'

const props = defineProps<{
  visible: boolean
  centerX: number
  centerY: number
}>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'created', nodeCode: string): void
}>()

const { t } = useI18n()
const store = useDesignerStore()
const tenant = useTenantStore()
const jobCodeOpts = useJobCodeOptions()
const pipelineCodeOpts = usePipelineCodeOptions()

interface PaletteRow {
  key: string
  nodeType: DesignerNodeType
  display: string
  related?: string
}

const NODE_TYPE_ROWS: PaletteRow[] = [
  { key: 'START', nodeType: 'START', display: 'START' },
  { key: 'END', nodeType: 'END', display: 'END' },
  { key: 'JOB', nodeType: 'JOB', display: 'JOB' },
  { key: 'GATEWAY', nodeType: 'GATEWAY', display: 'GATEWAY' },
  { key: 'FILE_STEP', nodeType: 'FILE_STEP', display: 'FILE_STEP' },
  { key: 'APPROVAL', nodeType: 'APPROVAL', display: 'APPROVAL' },
]

const query = ref('')
const highlight = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const filteredRows = computed<PaletteRow[]>(() => {
  const q = query.value.trim().toLowerCase()
  const rows: PaletteRow[] = []
  for (const r of NODE_TYPE_ROWS) {
    if (!q || r.display.toLowerCase().includes(q)) rows.push(r)
  }
  for (const code of jobCodeOpts.options.value) {
    if (!q || code.toLowerCase().includes(q)) {
      rows.push({ key: `JOB:${code}`, nodeType: 'JOB', display: `JOB · ${code}`, related: code })
    }
  }
  for (const code of pipelineCodeOpts.options.value) {
    if (!q || code.toLowerCase().includes(q)) {
      rows.push({
        key: `FILE_STEP:${code}`,
        nodeType: 'FILE_STEP',
        display: `FILE_STEP · ${code}`,
        related: code,
      })
    }
  }
  return rows
})

watch(
  () => props.visible,
  async (v) => {
    if (!v) return
    query.value = ''
    highlight.value = 0
    if (tenant.tenantId) {
      void jobCodeOpts.load(tenant.tenantId)
      void pipelineCodeOpts.load(tenant.tenantId)
    }
    await nextTick()
    inputRef.value?.focus()
  },
)

watch(filteredRows, () => {
  highlight.value = 0
})

function close() {
  emit('update:visible', false)
}

function genNodeCode(nodeType: DesignerNodeType, related?: string): string {
  if (related) return `${nodeType.toLowerCase()}_${related}_${String(Date.now()).slice(-4)}`
  return `${nodeType.toLowerCase()}_${String(Date.now()).slice(-4)}`
}

function commit(row: PaletteRow) {
  if (store.lock !== null && !store.editable) {
    close()
    return
  }
  const code = genNodeCode(row.nodeType, row.related)
  const attrs: Record<string, unknown> = {}
  if (row.nodeType === 'JOB' && row.related) attrs.jobCode = row.related
  if (row.nodeType === 'FILE_STEP' && row.related) attrs.pipelineCode = row.related
  store.addNode({
    nodeCode: code,
    nodeName: row.display,
    nodeType: row.nodeType,
    x: props.centerX,
    y: props.centerY,
    attrs,
  })
  emit('created', code)
  close()
}

function onKeyDown(ev: KeyboardEvent) {
  if (ev.key === 'Escape') {
    ev.preventDefault()
    close()
    return
  }
  if (ev.key === 'ArrowDown') {
    ev.preventDefault()
    if (filteredRows.value.length === 0) return
    highlight.value = (highlight.value + 1) % filteredRows.value.length
    return
  }
  if (ev.key === 'ArrowUp') {
    ev.preventDefault()
    if (filteredRows.value.length === 0) return
    highlight.value =
      (highlight.value - 1 + filteredRows.value.length) % filteredRows.value.length
    return
  }
  if (ev.key === 'Enter') {
    ev.preventDefault()
    const row = filteredRows.value[highlight.value]
    if (row) commit(row)
  }
}

defineExpose({
  __commitForTest: commit,
})
</script>

<template>
  <div
    v-if="visible"
    class="quick-palette__mask"
    role="dialog"
    aria-modal="true"
    :aria-label="t('workflowDesignerPolish.quickPaletteTitle')"
    @click.self="close"
  >
    <div class="quick-palette__panel" @keydown="onKeyDown">
      <div class="quick-palette__title">{{ t('workflowDesignerPolish.quickPaletteTitle') }}</div>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        class="quick-palette__input"
        :placeholder="t('workflowDesignerPolish.searchPlaceholder')"
        :aria-label="t('workflowDesignerPolish.searchPlaceholder')"
        @keydown="onKeyDown"
      />
      <div v-if="filteredRows.length === 0" class="quick-palette__empty">
        {{ t('workflowDesignerPolish.noResults') }}
      </div>
      <ul v-else class="quick-palette__list" role="listbox">
        <li
          v-for="(row, idx) in filteredRows"
          :key="row.key"
          class="quick-palette__item"
          :class="{ 'is-active': idx === highlight }"
          role="option"
          :aria-selected="idx === highlight"
          @mouseenter="highlight = idx"
          @click="commit(row)"
        >
          <span class="quick-palette__item-type">{{ row.nodeType }}</span>
          <span class="quick-palette__item-display">{{ row.display }}</span>
        </li>
      </ul>
      <div class="quick-palette__hint">{{ t('workflowDesignerPolish.quickPaletteHint') }}</div>
    </div>
  </div>
</template>

<style scoped>
.quick-palette__mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.32);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  z-index: 2000;
}
.quick-palette__panel {
  width: 480px;
  max-width: 90vw;
  background: var(--color-bg-overlay, #fff);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.quick-palette__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #303133);
}
.quick-palette__input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border-base, #dcdfe6);
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}
.quick-palette__input:focus {
  border-color: var(--color-primary, #409eff);
}
.quick-palette__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--color-border-light, #ebeef5);
  border-radius: 4px;
}
.quick-palette__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-light, #ebeef5);
}
.quick-palette__item:last-child {
  border-bottom: none;
}
.quick-palette__item.is-active {
  background: var(--color-info-light, #ecf5ff);
  color: var(--color-primary, #409eff);
}
.quick-palette__item-type {
  font-family: monospace;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--color-bg-base, #fafafa);
  color: var(--color-text-secondary, #606266);
  min-width: 72px;
  text-align: center;
}
.quick-palette__empty {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-secondary, #909399);
}
.quick-palette__hint {
  font-size: 11px;
  color: var(--color-text-secondary, #909399);
  text-align: right;
}
</style>
