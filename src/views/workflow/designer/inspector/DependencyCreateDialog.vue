<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'

  type EdgeType = 'SUCCESS' | 'FAILURE' | 'CONDITION' | 'ALWAYS'

  const props = defineProps<{ modelValue: boolean; preferredNodeId?: string }>()
  const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'created'): void
  }>()
  const { t } = useI18n()
  const store = useDesignerStore()

  const sourceId = ref('')
  const targetId = ref('')
  const edgeType = ref<EdgeType>('SUCCESS')
  const conditionExpr = ref('')

  const sourceOptions = computed(() => store.nodes.filter((node) => node.nodeType !== 'END'))
  const targetOptions = computed(() => store.nodes.filter((node) => node.nodeType !== 'START'))
  const canSubmit = computed(
    () =>
      sourceId.value !== '' &&
      targetId.value !== '' &&
      sourceId.value !== targetId.value &&
      (edgeType.value !== 'CONDITION' || conditionExpr.value.trim() !== ''),
  )

  watch(
    () => props.modelValue,
    (visible) => {
      if (!visible) return
      const preferred = store.nodes.find((node) => node.id === props.preferredNodeId)
      sourceId.value = preferred?.nodeType !== 'END' ? (preferred?.id ?? '') : ''
      targetId.value = preferred?.nodeType === 'END' ? preferred.id : ''
      edgeType.value = 'SUCCESS'
      conditionExpr.value = ''
    },
  )

  function nodeLabel(node: (typeof store.nodes)[number]): string {
    return node.nodeName === node.nodeCode ? node.nodeCode : `${node.nodeName} (${node.nodeCode})`
  }

  function close() {
    emit('update:modelValue', false)
  }

  function submit() {
    if (!canSubmit.value) return
    const result = store.addDependency({
      source: sourceId.value,
      target: targetId.value,
      label: conditionExpr.value.trim() || undefined,
      attrs: { edgeType: edgeType.value, enabled: true },
    })
    if (!result.ok) {
      ElMessage.warning(t(`workflowDesignerMvp.dependency.${result.reason}`))
      return
    }
    const created = store.edges.find(
      (edge) => edge.source === sourceId.value && edge.target === targetId.value,
    )
    if (created) store.setSelection([created.id])
    ElMessage.success(t('workflowDesignerMvp.dependency.created'))
    emit('created')
    close()
  }
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="t('workflowDesignerMvp.dependency.createTitle')"
    width="480px"
    append-to-body
    @close="close"
  >
    <el-form label-position="top">
      <div class="dependency-create__endpoints">
        <el-form-item :label="t('workflowDesignerMvp.field.edgeSource')" required>
          <el-select v-model="sourceId" filterable>
            <el-option
              v-for="node in sourceOptions"
              :key="node.id"
              :label="nodeLabel(node)"
              :value="node.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('workflowDesignerMvp.field.edgeTarget')" required>
          <el-select v-model="targetId" filterable>
            <el-option
              v-for="node in targetOptions"
              :key="node.id"
              :label="nodeLabel(node)"
              :value="node.id"
            />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item :label="t('workflowDesignerMvp.field.edgeType')" required>
        <el-select v-model="edgeType">
          <el-option :label="`${t('enum.edgeType.SUCCESS')} (SUCCESS)`" value="SUCCESS" />
          <el-option :label="`${t('enum.edgeType.FAILURE')} (FAILURE)`" value="FAILURE" />
          <el-option :label="`${t('enum.edgeType.CONDITION')} (CONDITION)`" value="CONDITION" />
          <el-option :label="`${t('enum.edgeType.ALWAYS')} (ALWAYS)`" value="ALWAYS" />
        </el-select>
      </el-form-item>
      <el-form-item
        v-if="edgeType === 'CONDITION'"
        :label="t('workflowDesignerMvp.field.conditionExpr')"
        required
      >
        <el-input
          v-model="conditionExpr"
          type="textarea"
          :rows="3"
          :placeholder="t('workflowDesignerMvp.field.conditionExprPlaceholder')"
        />
      </el-form-item>
      <el-alert
        type="info"
        :closable="false"
        :title="t('workflowDesignerMvp.dependency.createHint')"
      />
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="close">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :disabled="!canSubmit" @click="submit">
          {{ t('workflowDesignerMvp.dependency.createAction') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
  .dependency-create__endpoints {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .dependency-create__endpoints :deep(.el-select) {
    width: 100%;
  }

  @media (max-width: 560px) {
    .dependency-create__endpoints {
      grid-template-columns: 1fr;
    }
  }
</style>
