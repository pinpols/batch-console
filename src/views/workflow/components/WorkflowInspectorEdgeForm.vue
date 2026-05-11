<template>
  <div>
    <el-form label-position="top" class="workflow-form workflow-form--inspector">
      <div class="workflow-inspector-cols-2">
        <el-form-item :label="t('workflowInspector.fieldFrom')">
          <el-input
            v-model="edgeForm.fromNodeCode"
            disabled
            size="small"
            :placeholder="t('workflowInspector.readOnly')"
          />
        </el-form-item>
        <el-form-item :label="t('workflowInspector.fieldTo')">
          <el-input
            v-model="edgeForm.toNodeCode"
            disabled
            size="small"
            :placeholder="t('workflowInspector.readOnly')"
          />
        </el-form-item>
      </div>
      <el-form-item :label="t('workflowInspector.fieldEdgeType')">
        <el-radio-group
          v-model="edgeForm.edgeType"
          size="small"
          class="workflow-inspector-radio-group"
        >
          <el-radio-button v-for="item in edgeKinds" :key="item.kind" :label="item.kind">
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldCondition')">
        <el-input
          v-model="edgeForm.conditionExpr"
          type="textarea"
          :rows="2"
          size="small"
          :placeholder="t('workflowInspector.conditionPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldEnabled')">
        <el-switch v-model="edgeForm.enabled" size="small" />
      </el-form-item>
    </el-form>
    <div class="workflow-action-row workflow-action-row--inspector">
      <el-button type="primary" size="small" @click="emit('apply')">
        {{ t('workflowInspector.btnApply') }}
      </el-button>
      <el-button type="danger" plain size="small" @click="emit('remove')">
        {{ t('workflowInspector.btnRemoveEdge') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { edgeKinds, type EdgeFormState } from '../composables/workflowConstants'

  const { t } = useI18n({ useScope: 'global' })

  defineProps<{ edgeForm: EdgeFormState }>()
  const emit = defineEmits<{
    apply: []
    remove: []
  }>()
</script>
