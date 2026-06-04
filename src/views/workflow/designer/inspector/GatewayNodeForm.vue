<script setup lang="ts">
/**
 * GATEWAY 节点表单:strategy 单选 / 默认分支 / 条件表达式。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDesignerStore } from '../store/useDesignerStore'
import type { DesignerNode } from '../types'

const props = defineProps<{ node: DesignerNode; readonly: boolean }>()
const { t } = useI18n()
const store = useDesignerStore()

interface GatewayAttrs {
  gatewayStrategy?: 'AND' | 'OR' | 'XOR'
  defaultBranchNodeCode?: string
  conditionExpression?: string
}

function readAttrs(n: DesignerNode): GatewayAttrs {
  const a = (n.attrs ?? {}) as Record<string, unknown>
  const s = String(a.gatewayStrategy ?? '').toUpperCase()
  return {
    gatewayStrategy: ['AND', 'OR', 'XOR'].includes(s) ? (s as 'AND' | 'OR' | 'XOR') : undefined,
    defaultBranchNodeCode: typeof a.defaultBranchNodeCode === 'string' ? a.defaultBranchNodeCode : '',
    conditionExpression: typeof a.conditionExpression === 'string' ? a.conditionExpression : '',
  }
}

const local = ref<GatewayAttrs>(readAttrs(props.node))
const localName = ref(props.node.nodeName)

const downstreamCodes = computed(() => {
  const outs = store.edges.filter((e) => e.source === props.node.id).map((e) => e.target)
  return Array.from(new Set(outs))
})

const fieldErrors = computed(() => {
  const m = new Map<string, string>()
  for (const e of store.validationErrors) {
    if (e.nodeId === props.node.id && e.field) m.set(e.field, e.messageKey)
  }
  return m
})

watch(
  () => props.node.id,
  () => {
    local.value = readAttrs(props.node)
    localName.value = props.node.nodeName
  },
)

function writeAttr<K extends keyof GatewayAttrs>(field: K, v: GatewayAttrs[K]) {
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
      <el-input :model-value="t('workflowDesignerMvp.nodeGateway')" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeCode')">
      <el-input :model-value="props.node.nodeCode" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeName')">
      <el-input v-model="localName" :readonly="props.readonly" @blur="onBlurName" />
    </el-form-item>
    <el-form-item
      :label="t('workflowDesignerMvp.field.gatewayStrategy')"
      :error="
        fieldErrors.get('gatewayStrategy')
          ? t(fieldErrors.get('gatewayStrategy')!)
          : undefined
      "
      required
    >
      <el-radio-group
        v-model="local.gatewayStrategy"
        :disabled="props.readonly"
        @change="writeAttr('gatewayStrategy', $event as 'AND' | 'OR' | 'XOR')"
      >
        <el-radio-button label="AND">AND</el-radio-button>
        <el-radio-button label="OR">OR</el-radio-button>
        <el-radio-button label="XOR">XOR</el-radio-button>
      </el-radio-group>
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.defaultBranch')">
      <el-select
        v-model="local.defaultBranchNodeCode"
        clearable
        :disabled="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.defaultBranchPlaceholder')"
        @change="writeAttr('defaultBranchNodeCode', $event as string)"
      >
        <el-option v-for="c in downstreamCodes" :key="c" :label="c" :value="c" />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.conditionExpression')">
      <el-input
        v-model="local.conditionExpression"
        type="textarea"
        :rows="3"
        :readonly="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.conditionExpressionPlaceholder')"
        @blur="writeAttr('conditionExpression', local.conditionExpression)"
      />
    </el-form-item>
  </el-form>
</template>
