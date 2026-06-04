<script setup lang="ts">
/**
 * APPROVAL 节点表单:approvalTemplateCode + 超时降级行为。
 * 模板下拉 BE 暂无端点,Spike 兜底:用户手输文本(allow-create select),后续端点上线再切。
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDesignerStore } from '../store/useDesignerStore'
import type { DesignerNode } from '../types'

const props = defineProps<{ node: DesignerNode; readonly: boolean }>()
const { t } = useI18n()
const store = useDesignerStore()

type TimeoutFallback = 'APPROVE' | 'REJECT' | 'ESCALATE'

interface ApprovalAttrs {
  approvalTemplateCode?: string
  timeoutFallback?: TimeoutFallback
}

function readAttrs(n: DesignerNode): ApprovalAttrs {
  const a = (n.attrs ?? {}) as Record<string, unknown>
  const tf = String(a.timeoutFallback ?? '').toUpperCase()
  return {
    approvalTemplateCode:
      typeof a.approvalTemplateCode === 'string' ? a.approvalTemplateCode : '',
    timeoutFallback: ['APPROVE', 'REJECT', 'ESCALATE'].includes(tf)
      ? (tf as TimeoutFallback)
      : undefined,
  }
}

const local = ref<ApprovalAttrs>(readAttrs(props.node))
const localName = ref(props.node.nodeName)

watch(
  () => props.node.id,
  () => {
    local.value = readAttrs(props.node)
    localName.value = props.node.nodeName
  },
)

function writeAttr<K extends keyof ApprovalAttrs>(field: K, v: ApprovalAttrs[K]) {
  if (props.readonly) return
  const prevAttrs = (props.node.attrs ?? {}) as Record<string, unknown>
  if (prevAttrs[field] === v) return
  store.updateNode(props.node.id, { attrs: { [field]: v } })
}

function onBlurName() {
  if (props.readonly) return
  if (localName.value === props.node.nodeName) return
  store.updateNode(props.node.id, { nodeName: localName.value })
}
</script>

<template>
  <el-form label-position="top" size="small">
    <el-form-item :label="t('workflowDesignerMvp.field.nodeType')">
      <el-input :model-value="t('workflowDesignerMvp.nodeApproval')" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeCode')">
      <el-input :model-value="props.node.nodeCode" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeName')">
      <el-input v-model="localName" :readonly="props.readonly" @blur="onBlurName" />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.approvalTemplateCode')">
      <el-input
        v-model="local.approvalTemplateCode"
        :readonly="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.approvalTemplateCodePlaceholder')"
        @blur="writeAttr('approvalTemplateCode', local.approvalTemplateCode)"
      />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.timeoutFallback')">
      <el-select
        v-model="local.timeoutFallback"
        clearable
        :disabled="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.timeoutFallbackPlaceholder')"
        @change="writeAttr('timeoutFallback', $event as TimeoutFallback)"
      >
        <el-option label="APPROVE" value="APPROVE" />
        <el-option label="REJECT" value="REJECT" />
        <el-option label="ESCALATE" value="ESCALATE" />
      </el-select>
    </el-form-item>
  </el-form>
</template>
