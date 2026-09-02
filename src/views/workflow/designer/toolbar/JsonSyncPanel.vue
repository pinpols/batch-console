<script setup lang="ts">
  /**
   * JSON 同步面板 — designer 底部可折叠 textarea(workflowDesignerJson namespace)。
   *
   * 双向绑定:
   * - 画布 → JSON:watch store.snapshot deep,经 graphToDefinition + JSON.stringify 注入 textarea
   *   用 `syncingFromStore` flag 防触发"JSON → 画布"路径
   * - JSON → 画布:textarea blur 或 input 防抖 500ms → JSON.parse + definitionToGraph
   *   用 `manualEdit` flag 标识"用户手改中",此期间忽略 store 推回避免双循环
   *
   * parse 失败:错误信息红色显示,不破坏画布(不调 store.reset)。
   * 应用成功走 store.reset(...) — undoStack 重置,但与 Polish 模板库一致(reset 本身覆盖)。
   *
   * 折叠态由父组件通过 v-model:collapsed 控制;面板渲染始终存在以保留 watch 链路。
   */
  import { computed, ref, watch, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'
  import { graphToDefinition } from '../codec/graphToDefinition'
  import { definitionToGraph } from '../codec/definitionToGraph'
  import type { WorkflowDefinitionJson } from '../types'

  const props = withDefaults(
    defineProps<{
      collapsed?: boolean
      readonly?: boolean
    }>(),
    { collapsed: true, readonly: false },
  )
  const emit = defineEmits<{
    (e: 'update:collapsed', v: boolean): void
  }>()

  const { t } = useI18n()
  const store = useDesignerStore()

  const jsonText = ref('')
  const parseError = ref<string | null>(null)
  // 防双向循环:store → JSON 推送时置 true;JSON 应用回 store 时置 true
  const syncingFromStore = ref(false)
  const applyingToStore = ref(false)
  // 标记 textarea 正在被用户手改(input 触发),抑制 store → JSON 覆盖
  const manualEdit = ref(false)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const DEBOUNCE_MS = 500

  function formatJson(def: WorkflowDefinitionJson): string {
    return JSON.stringify(def, null, 2)
  }

  // 初始化 + 画布变更 → JSON
  watch(
    () => store.snapshot,
    (snap) => {
      if (applyingToStore.value) return
      if (manualEdit.value) return
      syncingFromStore.value = true
      try {
        jsonText.value = formatJson(graphToDefinition(snap))
        parseError.value = null
      } finally {
        // 微任务后清 flag,避免本轮 textarea v-model 反向触发
        queueMicrotask(() => {
          syncingFromStore.value = false
        })
      }
    },
    { deep: true, immediate: true },
  )

  function tryApplyToStore(raw: string) {
    if (props.readonly) return
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      parseError.value = (e as Error).message ?? 'parse error'
      return
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as { nodes?: unknown }).nodes) ||
      !Array.isArray((parsed as { edges?: unknown }).edges)
    ) {
      parseError.value = t('workflowDesignerJson.parseShapeError')
      return
    }
    parseError.value = null
    applyingToStore.value = true
    try {
      store.reset(definitionToGraph(parsed as WorkflowDefinitionJson))
    } finally {
      queueMicrotask(() => {
        applyingToStore.value = false
        manualEdit.value = false
      })
    }
  }

  function onTextInput(value: string) {
    if (syncingFromStore.value) return
    manualEdit.value = true
    jsonText.value = value
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      tryApplyToStore(jsonText.value)
    }, DEBOUNCE_MS)
  }

  function onBlur() {
    if (syncingFromStore.value) return
    if (!manualEdit.value) return
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    tryApplyToStore(jsonText.value)
  }

  function toggle() {
    emit('update:collapsed', !props.collapsed)
  }

  const expanded = computed(() => !props.collapsed)

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })
</script>

<template>
  <section class="json-sync-panel" :aria-expanded="expanded">
    <header
      class="json-sync-panel__header"
      role="button"
      tabindex="0"
      :aria-label="t('workflowDesignerJson.panelTitle')"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="json-sync-panel__caret">{{ expanded ? '▼' : '▶' }}</span>
      <span class="json-sync-panel__title">{{ t('workflowDesignerJson.panelTitle') }}</span>
      <span v-if="parseError" class="json-sync-panel__error-badge">!</span>
    </header>
    <div v-show="expanded" class="json-sync-panel__body">
      <el-input
        :model-value="jsonText"
        type="textarea"
        :rows="12"
        :placeholder="t('workflowDesignerJson.placeholder')"
        spellcheck="false"
        class="json-sync-panel__textarea"
        :readonly="props.readonly"
        :aria-label="t('workflowDesignerJson.panelTitle')"
        @update:model-value="onTextInput"
        @blur="onBlur"
      />
      <p v-if="parseError" class="json-sync-panel__error" role="alert">
        {{ t('workflowDesignerJson.parseError', { msg: parseError }) }}
      </p>
      <p v-else class="json-sync-panel__hint">
        {{ t('workflowDesignerJson.applyTooltip') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
  .json-sync-panel {
    border-top: 1px solid var(--color-border);
    background: var(--color-bg-overlay, #fff);
    font-size: 12px;
  }
  .json-sync-panel__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    cursor: pointer;
    user-select: none;
    background: var(--color-fill-light, #fafafa);
  }
  .json-sync-panel__caret {
    font-size: 10px;
    width: 12px;
    color: var(--color-text-secondary, #909399);
  }
  .json-sync-panel__title {
    font-weight: 600;
    color: var(--color-text-primary, #303133);
  }
  .json-sync-panel__error-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-danger, #f56c6c);
    color: #fff;
    font-size: 10px;
    font-weight: bold;
  }
  .json-sync-panel__body {
    padding: 8px 16px 12px;
  }
  .json-sync-panel__textarea :deep(.el-textarea__inner) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }
  .json-sync-panel__error {
    margin: 6px 0 0;
    color: var(--color-danger, #f56c6c);
    font-size: 12px;
  }
  .json-sync-panel__hint {
    margin: 6px 0 0;
    color: var(--color-text-secondary, #909399);
    font-size: 12px;
  }
</style>
