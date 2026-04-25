<template>
  <SectionCard class="workflow-card">
    <template #title>
      <span class="workflow-card-title">
        <el-icon class="workflow-card-title__icon"><Setting /></el-icon>
        流程属性
      </span>
    </template>
    <el-form label-position="top" class="workflow-form workflow-form--inspector">
      <el-form-item label="流程编码">
        <el-input v-model="workflowForm.workflowCode" disabled size="small" placeholder="只读" />
      </el-form-item>
      <el-form-item label="流程名称">
        <el-input v-model="workflowForm.workflowName" size="small" placeholder="列表与画布展示名" />
      </el-form-item>
      <el-form-item label="流程类型">
        <el-input
          v-model="workflowForm.workflowType"
          size="small"
          placeholder="如 PIPELINE / BATCH"
        />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="workflowForm.enabled" size="small" />
      </el-form-item>
      <el-form-item label="说明">
        <el-input
          v-model="workflowForm.description"
          type="textarea"
          :rows="2"
          size="small"
          placeholder="可选，简述用途"
        />
      </el-form-item>
    </el-form>
  </SectionCard>
</template>

<script setup lang="ts">
  import { Setting } from '@element-plus/icons-vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import type { WorkflowFormState } from '../composables/workflowConstants'

  defineProps<{ workflowForm: WorkflowFormState }>()
</script>
