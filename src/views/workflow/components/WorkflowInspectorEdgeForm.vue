<template>
  <div>
    <el-form label-position="top" class="workflow-form workflow-form--inspector">
      <div class="workflow-inspector-cols-2">
        <el-form-item label="来源">
          <el-input v-model="edgeForm.fromNodeCode" disabled size="small" placeholder="只读" />
        </el-form-item>
        <el-form-item label="目标">
          <el-input v-model="edgeForm.toNodeCode" disabled size="small" placeholder="只读" />
        </el-form-item>
      </div>
      <el-form-item label="边类型">
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
      <el-form-item label="条件表达式">
        <el-input
          v-model="edgeForm.conditionExpr"
          type="textarea"
          :rows="2"
          size="small"
          placeholder="留空则边上显示类型名称"
        />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="edgeForm.enabled" size="small" />
      </el-form-item>
    </el-form>
    <div class="workflow-action-row workflow-action-row--inspector">
      <el-button type="primary" size="small" @click="emit('apply')">应用修改</el-button>
      <el-button type="danger" plain size="small" @click="emit('remove')">删除边</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { edgeKinds, type EdgeFormState } from '../composables/workflowConstants'

  defineProps<{ edgeForm: EdgeFormState }>()
  const emit = defineEmits<{
    apply: []
    remove: []
  }>()
</script>
