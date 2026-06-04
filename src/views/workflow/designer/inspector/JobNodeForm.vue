<script setup lang="ts">
/**
 * JOB 节点表单。
 *  - jobCode 下拉(useJobCodeOptions,失败可手输)
 *  - maxRetries / timeoutSeconds 数字输入
 *  - skipExpression 文本(粗校验:非空字符串)
 * 表单不立即保存,失焦写回 store(走 updateNode → 入 undo 栈)。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDesignerStore } from '../store/useDesignerStore'
import { useJobCodeOptions } from '@/composables/useJobCodeOptions'
import type { DesignerNode } from '../types'

const props = defineProps<{ node: DesignerNode; readonly: boolean }>()
const { t } = useI18n()
const store = useDesignerStore()
const { loading, options, load } = useJobCodeOptions()

interface JobAttrs {
  jobCode?: string
  maxRetries?: number
  timeoutSeconds?: number
  skipExpression?: string
}

function readAttrs(n: DesignerNode): JobAttrs {
  const a = (n.attrs ?? {}) as Record<string, unknown>
  return {
    jobCode: typeof a.jobCode === 'string' ? a.jobCode : '',
    maxRetries: typeof a.maxRetries === 'number' ? a.maxRetries : undefined,
    timeoutSeconds: typeof a.timeoutSeconds === 'number' ? a.timeoutSeconds : undefined,
    skipExpression: typeof a.skipExpression === 'string' ? a.skipExpression : '',
  }
}

const local = ref<JobAttrs>(readAttrs(props.node))
const localName = ref(props.node.nodeName)
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

onMounted(() => {
  if (store.meta.tenantId) void load(store.meta.tenantId)
})

function writeAttr(field: keyof JobAttrs, raw: unknown) {
  if (props.readonly) return
  // 数字字段空 → undefined(避免落 0 覆盖 default)
  let v: unknown = raw
  if (field === 'maxRetries' || field === 'timeoutSeconds') {
    v = raw === '' || raw == null ? undefined : Number(raw)
  }
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
      <el-input :model-value="t('workflowDesignerSpike.nodeJob')" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeCode')">
      <el-input :model-value="props.node.nodeCode" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeName')">
      <el-input v-model="localName" :readonly="props.readonly" @blur="onBlurName" />
    </el-form-item>
    <el-form-item
      :label="t('workflowDesignerMvp.field.jobCode')"
      :error="fieldErrors.get('jobCode') ? t(fieldErrors.get('jobCode')!) : undefined"
      required
    >
      <el-select
        v-model="local.jobCode"
        filterable
        allow-create
        default-first-option
        :loading="loading"
        :disabled="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.jobCodePlaceholder')"
        @change="writeAttr('jobCode', $event)"
      >
        <el-option v-for="c in options" :key="c" :label="c" :value="c" />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.maxRetries')">
      <el-input-number
        v-model="local.maxRetries"
        :min="0"
        :max="10"
        :disabled="props.readonly"
        controls-position="right"
        @change="writeAttr('maxRetries', $event)"
      />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.timeoutSeconds')">
      <el-input-number
        v-model="local.timeoutSeconds"
        :min="0"
        :disabled="props.readonly"
        controls-position="right"
        @change="writeAttr('timeoutSeconds', $event)"
      />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.skipExpression')">
      <el-input
        v-model="local.skipExpression"
        :readonly="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.skipExpressionPlaceholder')"
        @blur="writeAttr('skipExpression', local.skipExpression)"
      />
    </el-form-item>
  </el-form>
</template>
