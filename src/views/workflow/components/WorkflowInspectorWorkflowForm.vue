<template>
  <SectionCard class="workflow-card">
    <template #title>
      <span class="workflow-card-title">
        <el-icon class="workflow-card-title__icon"><Setting /></el-icon>
        {{ t('workflowInspector.sectionWorkflowTitle') }}
      </span>
    </template>
    <el-form label-position="top" class="workflow-form workflow-form--inspector">
      <el-form-item :label="t('workflowInspector.fieldWorkflowCode')">
        <el-input
          v-model="workflowForm.workflowCode"
          disabled
          size="small"
          :placeholder="t('workflowInspector.readOnly')"
        />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldWorkflowName')">
        <el-input
          v-model="workflowForm.workflowName"
          size="small"
          :placeholder="t('workflowInspector.workflowNamePlaceholder')"
          :disabled="readonly"
        />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldWorkflowType')">
        <!-- 与后端 WorkflowType 字典对齐：DAG / PIPELINE / MIXED -->
        <el-select
          v-model="workflowForm.workflowType"
          size="small"
          :placeholder="t('workflowInspector.workflowTypePlaceholder')"
          class="workflow-fill-w"
          :disabled="readonly"
        >
          <el-option label="DAG" value="DAG" />
          <el-option label="PIPELINE" value="PIPELINE" />
          <el-option label="MIXED" value="MIXED" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldEnabled')">
        <el-switch v-model="workflowForm.enabled" size="small" :disabled="readonly" />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldDescription')">
        <el-input
          v-model="workflowForm.description"
          type="textarea"
          :rows="2"
          size="small"
          :placeholder="t('workflowInspector.descriptionPlaceholder')"
          :disabled="readonly"
        />
      </el-form-item>
    </el-form>
  </SectionCard>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Setting } from '@element-plus/icons-vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import type { WorkflowFormState } from '../composables/workflowConstants'

  const { t } = useI18n({ useScope: 'global' })

  withDefaults(
    defineProps<{
      workflowForm: WorkflowFormState
      readonly?: boolean
    }>(),
    { readonly: false },
  )
</script>
