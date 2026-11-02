<script setup lang="ts">
  /**
   * END 节点表单 —— 只读节点类型 + 可编辑节点名。
   */
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'
  import type { DesignerNode } from '../types'
  import { useInspectorTextDraft } from './useInspectorTextDraft'

  const props = defineProps<{ node: DesignerNode; readonly: boolean }>()
  const { t } = useI18n()
  const store = useDesignerStore()
  const {
    value: localName,
    update: updateName,
    captureInput: captureName,
    isCurrent,
  } = useInspectorTextDraft(
    'nodeName',
    () => props.node.id,
    () => props.node.nodeName,
    () => props.readonly,
  )

  function hasDraft() {
    return !!store.getInspectorDraft('nodeName', props.node.id)
  }

  function flushDraft() {
    if (!isCurrent() || props.readonly || !hasDraft()) return
    store.applyInspectorDrafts(props.node.id)
  }
  defineExpose({ hasDraft, flushDraft })
</script>

<template>
  <el-form label-position="top" size="small">
    <el-form-item :label="t('workflowDesignerMvp.field.nodeType')">
      <el-input :model-value="t('workflowDesignerSpike.nodeEnd')" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeCode')">
      <el-input :model-value="props.node.nodeCode" readonly />
    </el-form-item>
    <el-form-item
      :label="t('workflowDesignerMvp.field.nodeName')"
      :error="
        Array.from(localName).length > 256
          ? t('workflowDesignerMvp.validation.nodeNameTooLong')
          : undefined
      "
      @input.capture="captureName"
    >
      <el-input
        :model-value="localName"
        :readonly="props.readonly"
        @update:model-value="updateName"
        @blur="flushDraft"
      />
    </el-form-item>
  </el-form>
</template>
