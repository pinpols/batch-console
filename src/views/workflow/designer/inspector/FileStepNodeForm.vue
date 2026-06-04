<script setup lang="ts">
/**
 * FILE_STEP 节点表单:pipelineCode 下拉 + paramMappings(KV 数组)。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Delete } from '@element-plus/icons-vue'
import { useDesignerStore } from '../store/useDesignerStore'
import { usePipelineCodeOptions } from '@/composables/usePipelineCodeOptions'
import type { DesignerNode } from '../types'

const props = defineProps<{ node: DesignerNode; readonly: boolean }>()
const { t } = useI18n()
const store = useDesignerStore()
const { loading, options, load } = usePipelineCodeOptions()

interface KV {
  key: string
  value: string
}
interface FileAttrs {
  pipelineCode?: string
  paramMappings?: KV[]
}

function readAttrs(n: DesignerNode): FileAttrs {
  const a = (n.attrs ?? {}) as Record<string, unknown>
  const mappings = Array.isArray(a.paramMappings)
    ? (a.paramMappings as KV[]).map((m) => ({
        key: String(m?.key ?? ''),
        value: String(m?.value ?? ''),
      }))
    : []
  return {
    pipelineCode: typeof a.pipelineCode === 'string' ? a.pipelineCode : '',
    paramMappings: mappings,
  }
}

const local = ref<FileAttrs>(readAttrs(props.node))
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

function writePipelineCode(v: string) {
  if (props.readonly) return
  store.updateNode(props.node.id, { attrs: { pipelineCode: v } })
}

function commitMappings() {
  if (props.readonly) return
  // 去掉空 key 行
  const cleaned = (local.value.paramMappings ?? []).filter((m) => m.key.trim() !== '')
  store.updateNode(props.node.id, { attrs: { paramMappings: cleaned } })
}

function addRow() {
  if (props.readonly) return
  local.value.paramMappings = [...(local.value.paramMappings ?? []), { key: '', value: '' }]
}

function removeRow(idx: number) {
  if (props.readonly) return
  const next = [...(local.value.paramMappings ?? [])]
  next.splice(idx, 1)
  local.value.paramMappings = next
  commitMappings()
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
      <el-input :model-value="t('workflowDesignerMvp.nodeFileStep')" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeCode')">
      <el-input :model-value="props.node.nodeCode" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeName')">
      <el-input v-model="localName" :readonly="props.readonly" @blur="onBlurName" />
    </el-form-item>
    <el-form-item
      :label="t('workflowDesignerMvp.field.pipelineCode')"
      :error="fieldErrors.get('pipelineCode') ? t(fieldErrors.get('pipelineCode')!) : undefined"
      required
    >
      <el-select
        v-model="local.pipelineCode"
        filterable
        allow-create
        default-first-option
        :loading="loading"
        :disabled="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.pipelineCodePlaceholder')"
        @change="writePipelineCode($event as string)"
      >
        <el-option v-for="c in options" :key="c" :label="c" :value="c" />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.paramMappings')">
      <div class="kv-list">
        <div v-for="(row, idx) in local.paramMappings" :key="idx" class="kv-list__row">
          <el-input
            v-model="row.key"
            size="small"
            :placeholder="t('workflowDesignerMvp.field.paramKey')"
            :readonly="props.readonly"
            @blur="commitMappings"
          />
          <el-input
            v-model="row.value"
            size="small"
            :placeholder="t('workflowDesignerMvp.field.paramValue')"
            :readonly="props.readonly"
            @blur="commitMappings"
          />
          <el-button
            size="small"
            :disabled="props.readonly"
            :icon="Delete"
            link
            type="danger"
            :aria-label="t('workflowDesignerMvp.field.paramRemove')"
            @click="removeRow(idx)"
          />
        </div>
        <el-button
          size="small"
          :icon="Plus"
          :disabled="props.readonly"
          @click="addRow"
        >
          {{ t('workflowDesignerMvp.field.paramAdd') }}
        </el-button>
      </div>
    </el-form-item>
  </el-form>
</template>

<style scoped>
.kv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.kv-list__row {
  display: flex;
  gap: 4px;
  align-items: center;
}
</style>
