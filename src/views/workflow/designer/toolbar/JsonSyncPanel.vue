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
   * 应用成功清除撤销历史，但保留保存基线以正确提示未保存修改。
   *
   * 折叠态由父组件通过 v-model:collapsed 控制;面板渲染始终存在以保留 watch 链路。
   */
  import { computed, nextTick, ref, watch, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
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
  const scope = store.inspectorScope
  const isCurrent = () => store.inspectorScope === scope

  const jsonText = ref('')
  const parseError = ref<string | null>(null)
  // 防双向循环:store → JSON 推送时置 true;JSON 应用回 store 时置 true
  const syncingFromStore = ref(false)
  const applyingToStore = ref(false)
  // 标记 textarea 正在被用户手改(input 触发),抑制 store → JSON 覆盖
  const manualEdit = ref(false)
  const composing = ref(false)
  const inputRevision = ref(0)
  const draftBaseline = ref<string | null>(null)
  let compositionGeneration = 0
  const hasConflict = computed(() => {
    if (!manualEdit.value || draftBaseline.value === null) return false
    return (
      store.inspectorDrafts.length > 0 || JSON.stringify(store.snapshot) !== draftBaseline.value
    )
  })

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
        const definition = graphToDefinition(snap)
        jsonText.value = formatJson(definition)
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
    if (!isCurrent() || props.readonly || !store.editable) return false
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      parseError.value = (e as Error).message ?? 'parse error'
      return false
    }
    const parsedIsObject = Boolean(parsed) && typeof parsed === 'object'
    const parsedShape = parsed as { nodes?: unknown; edges?: unknown }
    const hasNodeArray = parsedIsObject && Array.isArray(parsedShape.nodes)
    const hasRequiredArrays = hasNodeArray && Array.isArray(parsedShape.edges)
    if (!hasRequiredArrays) {
      parseError.value = t('workflowDesignerJson.parseShapeError')
      return false
    }
    parseError.value = null
    if (JSON.stringify(parsed) === JSON.stringify(graphToDefinition(store.snapshot))) {
      manualEdit.value = false
      draftBaseline.value = null
      return true
    }
    applyingToStore.value = true
    try {
      const graph = definitionToGraph(parsed as WorkflowDefinitionJson)
      if (!store.replaceGraphFromJson(graph)) {
        parseError.value = t('workflowDesignerMvp.drafts.resolveBeforeJson')
        return false
      }
      manualEdit.value = false
      draftBaseline.value = null
      return true
    } catch (error) {
      parseError.value = (error as Error).message ?? 'unsupported workflow definition'
      return false
    } finally {
      queueMicrotask(() => {
        applyingToStore.value = false
      })
    }
  }

  function onTextInput(value: string) {
    if (!isCurrent() || syncingFromStore.value) return
    if (!manualEdit.value) draftBaseline.value = JSON.stringify(store.snapshot)
    manualEdit.value = true
    jsonText.value = value
    if (debounceTimer) clearTimeout(debounceTimer)
    if (composing.value) return
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      flushDraft()
    }, DEBOUNCE_MS)
  }

  function onBlur() {
    if (syncingFromStore.value || !manualEdit.value || composing.value) return
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    flushDraft()
  }

  function flushDraft(): boolean {
    if (!isCurrent() || composing.value) return false
    if (!manualEdit.value) return true
    if (hasConflict.value) return false
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = null
    return tryApplyToStore(jsonText.value)
  }

  function hasDraft(): boolean {
    return manualEdit.value || composing.value
  }

  function getDraftState(): string {
    return JSON.stringify([manualEdit.value, composing.value, jsonText.value, inputRevision.value])
  }

  function onNativeInput() {
    inputRevision.value += 1
  }

  function discardDraft() {
    compositionGeneration += 1
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = null
    manualEdit.value = false
    draftBaseline.value = null
    composing.value = false
    parseError.value = null
  }

  function onCompositionStart() {
    if (!isCurrent()) return
    compositionGeneration += 1
    composing.value = true
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = null
  }

  function onCompositionEnd() {
    const generation = compositionGeneration
    // Element Plus 在 compositionend 后的 nextTick 才将最终文字同步到 model。
    void nextTick()
      .then(() => nextTick())
      .then(() => {
        if (!isCurrent() || generation !== compositionGeneration) return
        composing.value = false
        if (manualEdit.value) {
          debounceTimer = setTimeout(() => {
            debounceTimer = null
            flushDraft()
          }, DEBOUNCE_MS)
        }
      })
  }

  function keepCanvas() {
    if (composing.value) return
    discardDraft()
    jsonText.value = formatJson(graphToDefinition(store.snapshot))
  }

  async function applyJsonDespiteConflict() {
    if (!isCurrent() || composing.value || props.readonly || !store.editable) return
    if (store.inspectorDrafts.length) {
      ElMessage.warning(t('workflowDesignerMvp.drafts.resolveBeforeJson'))
      return
    }
    const confirmedSnapshot = JSON.stringify(store.snapshot)
    try {
      await ElMessageBox.confirm(t('workflowDesignerJson.confirmOverwrite'), undefined, {
        type: 'warning',
      })
    } catch {
      return
    }
    if (!isCurrent() || composing.value || props.readonly || !store.editable || !manualEdit.value)
      return
    if (JSON.stringify(store.snapshot) !== confirmedSnapshot) {
      ElMessage.warning(t('workflowDesignerJson.conflictChanged'))
      return
    }
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = null
    tryApplyToStore(jsonText.value)
  }

  defineExpose({ flushDraft, hasDraft, discardDraft, getDraftState })

  function toggle() {
    emit('update:collapsed', !props.collapsed)
  }

  const expanded = computed(() => !props.collapsed)

  onBeforeUnmount(() => {
    compositionGeneration += 1
    if (debounceTimer) clearTimeout(debounceTimer)
  })
</script>

<template>
  <section class="json-sync-panel" :aria-expanded="expanded" @input.capture="onNativeInput">
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
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      />
      <p v-if="parseError" class="json-sync-panel__error" role="alert">
        {{ t('workflowDesignerJson.parseError', { msg: parseError }) }}
      </p>
      <div v-if="hasConflict" class="json-sync-panel__conflict" role="alert">
        <p>{{ t('workflowDesignerJson.conflict') }}</p>
        <el-button size="small" :disabled="composing" data-testid="keep-canvas" @click="keepCanvas">
          {{ t('workflowDesignerJson.keepCanvas') }}
        </el-button>
        <el-button
          size="small"
          :disabled="props.readonly || composing"
          data-testid="apply-json"
          @click="applyJsonDespiteConflict"
        >
          {{ t('workflowDesignerJson.applyJson') }}
        </el-button>
      </div>
      <p v-if="!parseError && !hasConflict" class="json-sync-panel__hint">
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
  .json-sync-panel__conflict {
    color: var(--color-danger, #f56c6c);
  }
  .json-sync-panel__hint {
    margin: 6px 0 0;
    color: var(--color-text-secondary, #909399);
    font-size: 12px;
  }
</style>
