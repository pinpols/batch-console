<script setup lang="ts">
/**
 * END 节点表单 —— 只读节点类型 + 可编辑节点名。
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDesignerStore } from '../store/useDesignerStore'
import type { DesignerNode } from '../types'

const props = defineProps<{ node: DesignerNode; readonly: boolean }>()
const { t } = useI18n()
const store = useDesignerStore()
const localName = ref(props.node.nodeName)

watch(
  () => props.node.id,
  () => {
    localName.value = props.node.nodeName
  },
)

function onBlurName() {
  if (props.readonly) return
  if (localName.value === props.node.nodeName) return
  store.updateNode(props.node.id, { nodeName: localName.value })
}
</script>

<template>
  <el-form label-position="top" size="small">
    <el-form-item :label="t('workflowDesignerMvp.field.nodeType')">
      <el-input :model-value="t('workflowDesignerSpike.nodeEnd')" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeCode')">
      <el-input :model-value="props.node.nodeCode" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeName')">
      <el-input v-model="localName" :readonly="props.readonly" @blur="onBlurName" />
    </el-form-item>
  </el-form>
</template>
