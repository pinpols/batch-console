<template>
  <div ref="hostRef" class="dsl-editor" :class="{ 'is-readonly': readonly }" />
</template>

<script setup lang="ts">
  /**
   * Workflow node_params DSL 编辑器（ADR-009）。
   *
   * 基于 CodeMirror 6：JSON 语法高亮 + 受限 JSONPath 子集 autocomplete。
   * 在用户输入 `$` 后弹出补全菜单：
   *   - `$.nodes.<上游 nodeCode>.output.<key>` — 上游节点产出
   *   - `$.workflowRun.bizDate / traceId` — workflow_run 级共享字段
   *
   * 上游 output key 字典见 CLAUDE.md §Workflow 节点参数 DSL：
   *   IMPORT/EXPORT/PROCESS/DISPATCH 四个领域各有 5-6 个 key，这里聚合后展示。
   *
   * 不支持 `*` 通配 / `[?]` 过滤 / `length()` / 表达式（后端 WorkflowParamResolver 也不支持）。
   */
  import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
  import { EditorState, Compartment } from '@codemirror/state'
  import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
  import { json, jsonParseLinter } from '@codemirror/lang-json'
  import { linter, lintGutter } from '@codemirror/lint'
  import {
    autocompletion,
    completionKeymap,
    type CompletionContext,
    type CompletionResult,
  } from '@codemirror/autocomplete'
  import {
    bracketMatching,
    indentOnInput,
    syntaxHighlighting,
    defaultHighlightStyle,
  } from '@codemirror/language'

  /** 上游节点产出的所有可能 key（聚合 IMPORT/EXPORT/PROCESS/DISPATCH 四个领域，去重）。 */
  const OUTPUT_KEYS = [
    // IMPORT
    'fileId',
    'recordCount',
    'parsedCount',
    'validatedCount',
    'skippedCount',
    'bizDate',
    // EXPORT
    'objectName',
    'fileSizeBytes',
    'checksumValue',
    // PROCESS
    'processedCount',
    'stagedCount',
    'publishedCount',
    'batchKey',
    'highWaterMarkOut',
    // DISPATCH
    'receiptCode',
    'receiptStatus',
    'externalRequestId',
    'channelCode',
  ]

  /** workflowRun 级别可引用字段。 */
  const WORKFLOW_RUN_KEYS = ['bizDate', 'traceId']

  const props = withDefaults(
    defineProps<{
      modelValue: string
      /** 上游 nodeCode 列表，用于 `$.nodes.<X>.output.*` 第二段补全 */
      upstreamNodeCodes?: string[]
      readonly?: boolean
      placeholder?: string
    }>(),
    {
      upstreamNodeCodes: () => [],
      readonly: false,
      placeholder: '',
    },
  )
  const emit = defineEmits<{ 'update:modelValue': [string] }>()

  const hostRef = ref<HTMLDivElement | null>(null)
  const view = shallowRef<EditorView | null>(null)
  const readonlyCompartment = new Compartment()

  function buildDslCompletions(ctx: CompletionContext): CompletionResult | null {
    // 命中触发：用户键入到任一 `$xxx` token 结尾时弹出
    const word = ctx.matchBefore(/\$[\w.]*/)
    if (!word) return null
    if (word.from === word.to && !ctx.explicit) return null
    const text = word.text
    // 决定阶段：`$` / `$.` / `$.nodes` / `$.nodes.X` / `$.nodes.X.output` / `$.nodes.X.output.k`
    const dotCount = (text.match(/\./g) ?? []).length
    const tokens = text.split('.')
    const options: { label: string; type?: string; info?: string; apply?: string }[] = []

    if (dotCount === 0) {
      // 刚敲完 `$` 或 `$x` —— 列两个根
      options.push({
        label: '$.nodes',
        type: 'namespace',
        info: '引用某节点产出',
        apply: '$.nodes.',
      })
      options.push({
        label: '$.workflowRun',
        type: 'namespace',
        info: 'workflow_run 级共享字段',
        apply: '$.workflowRun.',
      })
    } else if (dotCount === 1) {
      // `$.X` —— 第一段
      const head = tokens[1] ?? ''
      const root = head.toLowerCase()
      if ('nodes'.startsWith(root)) {
        options.push({ label: '$.nodes', type: 'namespace', apply: '$.nodes.' })
      }
      if ('workflowrun'.startsWith(root)) {
        options.push({
          label: '$.workflowRun',
          type: 'namespace',
          apply: '$.workflowRun.',
        })
      }
    } else if (tokens[1] === 'nodes') {
      if (dotCount === 2) {
        // `$.nodes.X` —— 列上游 nodeCode
        for (const code of props.upstreamNodeCodes) {
          options.push({
            label: `$.nodes.${code}`,
            type: 'class',
            info: '上游节点',
            apply: `$.nodes.${code}.output.`,
          })
        }
      } else if (dotCount === 3) {
        // `$.nodes.X.output` —— 固定后缀
        const nodeCode = tokens[2] ?? ''
        options.push({
          label: `$.nodes.${nodeCode}.output`,
          type: 'property',
          apply: `$.nodes.${nodeCode}.output.`,
        })
      } else if (dotCount >= 4 && tokens[3] === 'output') {
        // `$.nodes.X.output.k` —— 列 output key
        const nodeCode = tokens[2] ?? ''
        for (const key of OUTPUT_KEYS) {
          options.push({
            label: `$.nodes.${nodeCode}.output.${key}`,
            type: 'variable',
            info: '节点产出字段',
            apply: `$.nodes.${nodeCode}.output.${key}`,
          })
        }
      }
    } else if (tokens[1] === 'workflowRun') {
      if (dotCount === 2) {
        for (const key of WORKFLOW_RUN_KEYS) {
          options.push({
            label: `$.workflowRun.${key}`,
            type: 'variable',
            info: 'workflow_run 字段',
            apply: `$.workflowRun.${key}`,
          })
        }
      }
    }

    if (options.length === 0) return null
    return { from: word.from, to: word.to, options, validFor: /^\$[\w.]*$/ }
  }

  function createState(doc: string) {
    return EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        indentOnInput(),
        highlightActiveLine(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        json(),
        lintGutter(),
        linter(jsonParseLinter()),
        autocompletion({ override: [buildDslCompletions], activateOnTyping: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
        readonlyCompartment.of(EditorState.readOnly.of(props.readonly)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const next = u.state.doc.toString()
            if (next !== props.modelValue) emit('update:modelValue', next)
          }
        }),
        EditorView.theme({
          '&': { fontSize: '12px', minHeight: '120px' },
          '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
          '.cm-scroller': { lineHeight: '1.55' },
        }),
      ],
    })
  }

  onMounted(() => {
    if (!hostRef.value) return
    view.value = new EditorView({
      state: createState(props.modelValue ?? ''),
      parent: hostRef.value,
    })
  })

  onBeforeUnmount(() => {
    view.value?.destroy()
    view.value = null
  })

  // 外部 modelValue 变更（如切换选中节点）时同步进编辑器；编辑器自己 emit 的变更不会触发循环
  watch(
    () => props.modelValue,
    (val) => {
      const v = view.value
      if (!v) return
      const cur = v.state.doc.toString()
      if (cur === val) return
      v.dispatch({ changes: { from: 0, to: cur.length, insert: val ?? '' } })
    },
  )

  watch(
    () => props.readonly,
    (ro) => {
      const v = view.value
      if (!v) return
      v.dispatch({ effects: readonlyCompartment.reconfigure(EditorState.readOnly.of(ro)) })
    },
  )
</script>

<style scoped>
  .dsl-editor {
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    overflow: hidden;
    background: var(--el-bg-color);
  }
  .dsl-editor.is-readonly {
    opacity: 0.85;
  }
  .dsl-editor :deep(.cm-editor) {
    height: 100%;
  }
  .dsl-editor :deep(.cm-editor.cm-focused) {
    outline: none;
  }
  .dsl-editor :deep(.cm-gutters) {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-secondary);
    border-right: 1px solid var(--el-border-color-lighter);
  }
</style>
