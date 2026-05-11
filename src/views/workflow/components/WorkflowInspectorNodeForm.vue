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
          <!-- JOB 节点：下拉选已注册 job-definitions（与后端 V8 校验一致）；其他类型保留 free-text -->
          <el-select
            v-if="nodeForm.nodeType === 'JOB'"
            v-model="nodeForm.relatedJobCode"
            filterable
            clearable
            :placeholder="t('workflowInspector.relatedJobPlaceholder')"
            size="small"
            :loading="jobOptionsLoading"
            class="workflow-fill-w"
          >
            <el-option
              v-for="item in jobOptions"
              :key="item.jobCode"
              :label="`${item.jobCode}${item.jobName ? ' · ' + item.jobName : ''}`"
              :value="item.jobCode"
            />
          </el-select>
          <el-input
            v-else
            v-model="nodeForm.relatedJobCode"
            :placeholder="t('workflowInspector.relatedJobPlaceholder')"
            size="small"
          />
        </el-form-item>
        <el-form-item :label="t('workflowInspector.fieldRelatedPipeline')">
          <!-- FILE_STEP 节点：下拉选已启用 pipeline-definitions；其他类型保留 free-text -->
          <el-select
            v-if="nodeForm.nodeType === 'FILE_STEP'"
            v-model="nodeForm.relatedPipelineCode"
            filterable
            clearable
            :placeholder="t('workflowInspector.relatedPipelinePlaceholder')"
            size="small"
            :loading="pipelineOptionsLoading"
            class="workflow-fill-w"
          >
            <el-option
              v-for="item in pipelineOptions"
              :key="item.code"
              :label="`${item.code}${item.name ? ' · ' + item.name : ''}`"
              :value="item.code"
            />
          </el-select>
          <el-input
            v-else
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
          @click="emit('add-downstream', 'GATEWAY')"
        >
          {{ t('workflowInspector.addDownstreamGateway') }}
        </el-button>
        <el-button
          class="workflow-quick-create__btn"
          size="small"
          @click="emit('add-downstream', 'JOB')"
        >
          {{ t('workflowInspector.addDownstreamJob') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    nodeKinds,
    type NodeFormState,
    type WorkflowNodeKind,
  } from '../composables/workflowConstants'
  import { jobApi } from '@/api/job'
  import { queryPipelineDefinitionsQuery } from '@/api/system'
  import { useTenantStore } from '@/stores/tenant'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  const props = defineProps<{ nodeForm: NodeFormState }>()
  const emit = defineEmits<{
    apply: []
    duplicate: []
    remove: []
    'add-downstream': [WorkflowNodeKind]
  }>()

  // ─── FILE_STEP / JOB 节点的下拉选项 ─────────────────────────────────────────

  interface JobOption {
    jobCode: string
    jobName?: string
  }
  interface PipelineOption {
    code: string
    name?: string
  }

  const jobOptions = ref<JobOption[]>([])
  const jobOptionsLoading = ref(false)
  const jobOptionsLoaded = ref(false)

  const pipelineOptions = ref<PipelineOption[]>([])
  const pipelineOptionsLoading = ref(false)
  const pipelineOptionsLoaded = ref(false)

  async function ensureJobOptions() {
    if (jobOptionsLoaded.value || jobOptionsLoading.value) return
    jobOptionsLoading.value = true
    try {
      const list = await jobApi.listDefinitions(tenant.tenantId)
      jobOptions.value = (list ?? [])
        .filter((j) => j.enabled !== false)
        .map((j) => ({ jobCode: j.jobCode, jobName: j.jobName ?? '' }))
      jobOptionsLoaded.value = true
    } finally {
      jobOptionsLoading.value = false
    }
  }

  async function ensurePipelineOptions() {
    if (pipelineOptionsLoaded.value || pipelineOptionsLoading.value) return
    pipelineOptionsLoading.value = true
    try {
      const list = await queryPipelineDefinitionsQuery(tenant.tenantId)
      pipelineOptions.value = (list ?? [])
        .filter((p) => (p.enabled ?? true) !== false)
        .map((p) => ({
          // 后端可能用 pipelineCode 或 code 任一字段；兼容兜底
          code: String(p.pipelineCode ?? p.code ?? ''),
          name: String(p.pipelineName ?? p.name ?? ''),
        }))
        .filter((p) => p.code !== '')
      pipelineOptionsLoaded.value = true
    } finally {
      pipelineOptionsLoading.value = false
    }
  }

  // 切到 JOB / FILE_STEP 类型时按需加载，避免初次打开 inspector 就发请求
  watch(
    () => props.nodeForm.nodeType,
    (kind) => {
      if (kind === 'JOB') void ensureJobOptions()
      else if (kind === 'FILE_STEP') void ensurePipelineOptions()
    },
    { immediate: true },
  )
</script>
