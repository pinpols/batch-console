<template>
  <div>
    <el-form label-position="top" class="workflow-form workflow-form--inspector">
      <el-form-item :label="t('workflowInspector.fieldNodeCode')">
        <el-input
          v-model="nodeForm.nodeCode"
          disabled
          size="small"
          :placeholder="t('workflowInspector.readOnly')"
        />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldDisplayName')">
        <el-input
          v-model="nodeForm.nodeName"
          size="small"
          :placeholder="t('workflowInspector.displayNamePlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldNodeType')">
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
        <el-form-item :label="t('workflowInspector.fieldRelatedJob')">
          <el-input
            v-model="nodeForm.relatedJobCode"
            :placeholder="t('workflowInspector.relatedJobPlaceholder')"
            size="small"
          />
        </el-form-item>
        <el-form-item :label="t('workflowInspector.fieldRelatedPipeline')">
          <el-input
            v-model="nodeForm.relatedPipelineCode"
            :placeholder="t('workflowInspector.relatedPipelinePlaceholder')"
            size="small"
          />
        </el-form-item>
      </div>
      <div class="workflow-inspector-cols-2">
        <el-form-item :label="t('workflowInspector.fieldWorker')">
          <el-input
            v-model="nodeForm.workerGroup"
            size="small"
            :placeholder="t('workflowInspector.workerPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('workflowInspector.fieldWindow')">
          <el-input
            v-model="nodeForm.windowCode"
            size="small"
            :placeholder="t('workflowInspector.windowPlaceholder')"
          />
        </el-form-item>
      </div>
      <div class="workflow-inspector-cols-2">
        <el-form-item :label="t('workflowInspector.fieldOrder')">
          <el-input-number
            v-model="nodeForm.nodeOrder"
            class="workflow-fill-w"
            :min="0"
            :step="1"
            size="small"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item :label="t('workflowInspector.fieldRetryMax')">
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
      <el-form-item :label="t('workflowInspector.fieldRetryPolicy')">
        <el-input
          v-model="nodeForm.retryPolicy"
          size="small"
          :placeholder="t('workflowInspector.retryPolicyPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldTimeoutSeconds')">
        <el-input-number
          v-model="nodeForm.timeoutSeconds"
          class="workflow-fill-w"
          :min="0"
          :step="30"
          size="small"
          controls-position="right"
        />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldExtJson')">
        <el-input
          v-model="nodeForm.nodeParams"
          type="textarea"
          :rows="2"
          size="small"
          :placeholder="t('workflowInspector.extJsonPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldEnabled')">
        <el-switch v-model="nodeForm.enabled" size="small" />
      </el-form-item>
    </el-form>
    <div class="workflow-action-row workflow-action-row--inspector">
      <el-button type="primary" size="small" @click="emit('apply')">
        {{ t('workflowInspector.btnApply') }}
      </el-button>
      <el-button size="small" @click="emit('duplicate')">
        {{ t('workflowInspector.btnDuplicate') }}
      </el-button>
      <el-button type="danger" plain size="small" @click="emit('remove')">
        {{ t('workflowInspector.btnRemove') }}
      </el-button>
    </div>
    <div class="workflow-quick-create">
      <div class="workflow-quick-create__head">
        <span class="workflow-quick-create__title">
          {{ t('workflowInspector.quickCreateTitle') }}
        </span>
        <span class="workflow-quick-create__hint">
          {{ t('workflowInspector.quickCreateHint') }}
        </span>
      </div>
      <div class="workflow-quick-create__actions">
        <el-button
          class="workflow-quick-create__btn"
          size="small"
          @click="emit('add-downstream', 'TASK')"
        >
          {{ t('workflowInspector.addDownstreamTask') }}
        </el-button>
        <el-button
          class="workflow-quick-create__btn"
          size="small"
          @click="emit('add-downstream', 'DECISION')"
        >
          {{ t('workflowInspector.addDownstreamDecision') }}
        </el-button>
        <el-button
          class="workflow-quick-create__btn"
          size="small"
          @click="emit('add-downstream', 'JOIN')"
        >
          {{ t('workflowInspector.addDownstreamJoin') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import {
    nodeKinds,
    type NodeFormState,
    type WorkflowNodeKind,
  } from '../composables/workflowConstants'

  const { t } = useI18n({ useScope: 'global' })

  defineProps<{ nodeForm: NodeFormState }>()
  const emit = defineEmits<{
    apply: []
    duplicate: []
    remove: []
    'add-downstream': [WorkflowNodeKind]
  }>()
</script>
