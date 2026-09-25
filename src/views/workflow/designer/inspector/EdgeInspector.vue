<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'
  import type { DesignerEdge } from '../types'
  import { usesConditionTemplateWrapper } from '../validators/dagValidators'

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

  function endpointLabel(nodeId: string): string {
    const node = store.nodes.find((item) => item.id === nodeId)
    if (!node) return nodeId
    return node.nodeName === node.nodeCode ? node.nodeCode : `${node.nodeName} (${node.nodeCode})`
  }

  const sourceLabel = computed(() => endpointLabel(props.edge.source))
  const targetLabel = computed(() => endpointLabel(props.edge.target))
  const conditionError = computed(() => {
    if (local.value.edgeType !== 'CONDITION') return ''
    if (!local.value.conditionExpr.trim()) {
      return t('workflowDesignerMvp.validation.conditionExprRequired', {
        source: props.edge.source,
        target: props.edge.target,
      })
    }
    if (usesConditionTemplateWrapper(local.value.conditionExpr)) {
      return t('workflowDesignerMvp.validation.conditionExprTemplateWrapper')
    }
    return ''
  })
  const edgeTypeDescription = computed(() =>
    t(`workflowDesignerMvp.edgeTypeDescription.${local.value.edgeType}`),
  )

  watch(
    () => [props.edge.id, props.edge.label, JSON.stringify(props.edge.attrs ?? {})],
    () => {
      local.value = readAttrs(props.edge)
    },
  )

  function commit() {
    if (props.readonly) return
    const current = readAttrs(props.edge)
    if (
      current.edgeType === local.value.edgeType &&
      current.conditionExpr === local.value.conditionExpr &&
      current.enabled === local.value.enabled
    ) {
      return
    }
    store.updateEdge(props.edge.id, {
      label: local.value.conditionExpr.trim() || undefined,
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
  <el-form class="edge-inspector" label-position="top" size="small">
    <el-form-item :label="t('workflowDesignerMvp.field.edgeSource')">
      <el-input :model-value="sourceLabel" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.edgeTarget')">
      <el-input :model-value="targetLabel" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.edgeType')">
      <el-select
        v-model="local.edgeType"
        :disabled="props.readonly"
        @change="onEdgeTypeChange($event as EdgeType)"
      >
        <el-option :label="`${t('enum.edgeType.SUCCESS')} (SUCCESS)`" value="SUCCESS" />
        <el-option :label="`${t('enum.edgeType.FAILURE')} (FAILURE)`" value="FAILURE" />
        <el-option :label="`${t('enum.edgeType.CONDITION')} (CONDITION)`" value="CONDITION" />
        <el-option :label="`${t('enum.edgeType.ALWAYS')} (ALWAYS)`" value="ALWAYS" />
      </el-select>
      <div class="edge-inspector__hint">{{ edgeTypeDescription }}</div>
    </el-form-item>
    <el-form-item
      v-if="local.edgeType === 'CONDITION'"
      :label="t('workflowDesignerMvp.field.conditionExpr')"
      :error="conditionError"
      required
    >
      <el-input
        v-model="local.conditionExpr"
        type="textarea"
        :rows="3"
        :readonly="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.conditionExprPlaceholder')"
        @blur="commit"
      />
      <div class="edge-inspector__hint">
        {{ t('workflowDesignerMvp.conditionExprHelp') }}
      </div>
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.edgeEnabled')">
      <el-switch v-model="local.enabled" :disabled="props.readonly" @change="commit" />
      <span v-if="!local.enabled" class="edge-inspector__disabled-hint">
        {{ t('workflowDesignerMvp.disabledEdgeHint') }}
      </span>
    </el-form-item>
  </el-form>
</template>

<style scoped>
  .edge-inspector__hint {
    width: 100%;
    margin-top: 6px;
    color: var(--color-text-secondary, #606266);
    font-size: 11px;
    line-height: 1.5;
  }

  .edge-inspector__disabled-hint {
    margin-left: 8px;
    color: var(--color-warning, #d97706);
    font-size: 11px;
  }
</style>
