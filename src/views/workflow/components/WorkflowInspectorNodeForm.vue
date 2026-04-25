<template>
  <div>
    <el-form label-position="top" class="workflow-form workflow-form--inspector">
      <el-form-item label="节点编码">
        <el-input v-model="nodeForm.nodeCode" disabled size="small" placeholder="只读" />
      </el-form-item>
      <el-form-item label="显示名称">
        <el-input v-model="nodeForm.nodeName" size="small" placeholder="画布上标题" />
      </el-form-item>
      <el-form-item label="节点类型">
        <el-radio-group
          v-model="nodeForm.nodeType"
          size="small"
          class="workflow-inspector-radio-group"
        >
          <el-radio-button v-for="kind in nodeKinds" :key="kind.kind" :label="kind.kind">
            {{ kind.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      <div class="workflow-inspector-cols-2">
        <el-form-item label="关联作业">
          <el-input v-model="nodeForm.relatedJobCode" placeholder="作业编码，可空" size="small" />
        </el-form-item>
        <el-form-item label="关联管道">
          <el-input
            v-model="nodeForm.relatedPipelineCode"
            placeholder="管道编码，可空"
            size="small"
          />
        </el-form-item>
      </div>
      <div class="workflow-inspector-cols-2">
        <el-form-item label="Worker">
          <el-input v-model="nodeForm.workerGroup" size="small" placeholder="分组，可空" />
        </el-form-item>
        <el-form-item label="窗口">
          <el-input v-model="nodeForm.windowCode" size="small" placeholder="窗口编码" />
        </el-form-item>
      </div>
      <div class="workflow-inspector-cols-2">
        <el-form-item label="排序">
          <el-input-number
            v-model="nodeForm.nodeOrder"
            class="workflow-fill-w"
            :min="0"
            :step="1"
            size="small"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="最大重试">
          <el-input-number
            v-model="nodeForm.retryMaxCount"
            class="workflow-fill-w"
            :min="0"
            :step="1"
            size="small"
            controls-position="right"
          />
        </el-form-item>
      </div>
      <el-form-item label="重试策略">
        <el-input v-model="nodeForm.retryPolicy" size="small" placeholder="如 NONE、FIXED 等" />
      </el-form-item>
      <el-form-item label="超时(s)">
        <el-input-number
          v-model="nodeForm.timeoutSeconds"
          class="workflow-fill-w"
          :min="0"
          :step="30"
          size="small"
          controls-position="right"
        />
      </el-form-item>
      <el-form-item label="扩展 JSON">
        <el-input
          v-model="nodeForm.nodeParams"
          type="textarea"
          :rows="2"
          size="small"
          placeholder="合法 JSON 对象，如 {}"
        />
      </el-form-item>
      <el-form-item label="启用">
        <el-switch v-model="nodeForm.enabled" size="small" />
      </el-form-item>
    </el-form>
    <div class="workflow-action-row workflow-action-row--inspector">
      <el-button type="primary" size="small" @click="emit('apply')">应用修改</el-button>
      <el-button size="small" @click="emit('duplicate')">复制</el-button>
      <el-button type="danger" plain size="small" @click="emit('remove')">删除</el-button>
    </div>
    <div class="workflow-quick-create">
      <div class="workflow-quick-create__head">
        <span class="workflow-quick-create__title">快速新增下游</span>
        <span class="workflow-quick-create__hint">快捷键：Shift + T / D / J</span>
      </div>
      <div class="workflow-quick-create__actions">
        <el-button
          class="workflow-quick-create__btn"
          size="small"
          @click="emit('add-downstream', 'TASK')"
        >
          下游任务
        </el-button>
        <el-button
          class="workflow-quick-create__btn"
          size="small"
          @click="emit('add-downstream', 'DECISION')"
        >
          下游分支
        </el-button>
        <el-button
          class="workflow-quick-create__btn"
          size="small"
          @click="emit('add-downstream', 'JOIN')"
        >
          下游汇聚
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {
    nodeKinds,
    type NodeFormState,
    type WorkflowNodeKind,
  } from '../composables/workflowConstants'

  defineProps<{ nodeForm: NodeFormState }>()
  const emit = defineEmits<{
    apply: []
    duplicate: []
    remove: []
    'add-downstream': [WorkflowNodeKind]
  }>()
</script>
