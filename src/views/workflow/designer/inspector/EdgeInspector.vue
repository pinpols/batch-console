<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'
  import type { DesignerEdge } from '../types'

  const props = defineProps<{ edge: DesignerEdge; readonly: boolean }>()
  const { t } = useI18n()
  const store = useDesignerStore()

  type EdgeType = 'SUCCESS' | 'FAILURE' | 'CONDITION' | 'ALWAYS'

  interface EdgeAttrs {
    edgeType: EdgeType
    conditionExpr: string
    enabled: boolean
  }

  function readAttrs(edge: DesignerEdge): EdgeAttrs {
    const attrs = edge.attrs ?? {}
    const edgeType = attrs.edgeType
    return {
      edgeType:
        edgeType === 'FAILURE' || edgeType === 'CONDITION' || edgeType === 'ALWAYS'
          ? edgeType
          : 'SUCCESS',
      conditionExpr: edge.label ?? '',
      enabled: attrs.enabled !== false,
    }
  }

  const local = ref<EdgeAttrs>(readAttrs(props.edge))

  watch(
    () => props.edge.id,
    () => {
      local.value = readAttrs(props.edge)
    },
  )

  function commit() {
    if (props.readonly) return
    store.updateEdge(props.edge.id, {
      label: local.value.conditionExpr || undefined,
      attrs: {
        edgeType: local.value.edgeType,
        enabled: local.value.enabled,
      },
    })
  }

  function onEdgeTypeChange(value: EdgeType) {
    local.value.edgeType = value
    if (value !== 'CONDITION') {
      local.value.conditionExpr = ''
    }
    commit()
  }
</script>

<template>
  <el-form label-position="top" size="small">
    <el-form-item :label="t('workflowDesignerMvp.field.edgeType')">
      <el-select
        v-model="local.edgeType"
        :disabled="props.readonly"
        @change="onEdgeTypeChange($event as EdgeType)"
      >
        <el-option label="SUCCESS" value="SUCCESS" />
        <el-option label="FAILURE" value="FAILURE" />
        <el-option label="CONDITION" value="CONDITION" />
        <el-option label="ALWAYS" value="ALWAYS" />
      </el-select>
    </el-form-item>
    <el-form-item
      v-if="local.edgeType === 'CONDITION'"
      :label="t('workflowDesignerMvp.field.conditionExpr')"
    >
      <el-input
        v-model="local.conditionExpr"
        type="textarea"
        :rows="3"
        :readonly="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.conditionExprPlaceholder')"
        @blur="commit"
      />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.edgeEnabled')">
      <el-switch v-model="local.enabled" :disabled="props.readonly" @change="commit" />
    </el-form-item>
  </el-form>
</template>
