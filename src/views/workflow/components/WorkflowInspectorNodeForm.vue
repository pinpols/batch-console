<template>
  <div>
    <!-- el-form :disabled 会级联到所有 el-* 表单子组件（input/select/switch/radio/input-number 等），
         省去逐个挂 :disabled。DslEditor 走 :readonly 单独控制（非 el-* 组件不会自动级联） -->
    <el-form
      label-position="top"
      class="workflow-form workflow-form--inspector"
      :disabled="readonly"
    >
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
        <!-- 与后端 RetryPolicyType 字典对齐：NONE / FIXED / EXPONENTIAL -->
        <el-select
          v-model="nodeForm.retryPolicy"
          size="small"
          :placeholder="t('workflowInspector.retryPolicyPlaceholder')"
          class="workflow-fill-w"
        >
          <el-option label="NONE" value="NONE" />
          <el-option label="FIXED" value="FIXED" />
          <el-option label="EXPONENTIAL" value="EXPONENTIAL" />
        </el-select>
      </el-form-item>
      <!-- GATEWAY join_mode（后端 V9/V10 校验）：ALL_OF 要求 ≥2 入边，N_OF_M 要求 n ≤ m 且 m 等于入边数 -->
      <template v-if="nodeForm.nodeType === 'GATEWAY'">
        <div class="workflow-inspector-cols-2">
          <el-form-item :label="t('workflowInspector.fieldJoinMode')">
            <el-select
              v-model="joinMode"
              size="small"
              :placeholder="t('workflowInspector.joinModePlaceholder')"
              clearable
              class="workflow-fill-w"
            >
              <el-option label="ALL_OF" value="ALL_OF" />
              <el-option label="N_OF_M" value="N_OF_M" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="joinMode === 'N_OF_M'" :label="t('workflowInspector.fieldJoinN')">
            <el-input-number
              v-model="joinN"
              class="workflow-fill-w"
              :min="1"
              :step="1"
              size="small"
              controls-position="right"
            />
          </el-form-item>
        </div>
      </template>
      <!-- ADR-018 跨日依赖（V6/V7 后端校验）：仅暴露超时秒数 + JSON 数组编辑入口；复杂结构靠 DSL 编辑器 -->
      <div class="workflow-inspector-cols-2">
        <el-form-item :label="t('workflowInspector.fieldCrossDayDeps')">
          <el-input
            v-model="nodeForm.crossDayDependencies"
            size="small"
            :placeholder="t('workflowInspector.crossDayDepsPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('workflowInspector.fieldCrossDayTimeout')">
          <el-input-number
            v-model="nodeForm.crossDayDependencyTimeoutSeconds"
            class="workflow-fill-w"
            :min="0"
            :step="60"
            size="small"
            controls-position="right"
          />
        </el-form-item>
      </div>
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
        <DslEditor
          v-model="nodeForm.nodeParams"
          :upstream-node-codes="upstreamNodeCodes"
          :placeholder="t('workflowInspector.extJsonPlaceholder')"
          :readonly="readonly"
        />
        <div class="workflow-dsl-hint">
          <span>{{ t('workflowInspector.dslHint') }}</span>
        </div>
      </el-form-item>
      <el-form-item :label="t('workflowInspector.fieldEnabled')">
        <el-switch v-model="nodeForm.enabled" size="small" />
      </el-form-item>
    </el-form>
    <div class="workflow-action-row workflow-action-row--inspector">
      <el-button type="primary" size="small" :disabled="readonly" @click="emit('apply')">
        {{ t('workflowInspector.btnApply') }}
      </el-button>
      <el-button size="small" :disabled="readonly" @click="emit('duplicate')">
        {{ t('workflowInspector.btnDuplicate') }}
      </el-button>
      <el-button type="danger" plain size="small" :disabled="readonly" @click="emit('remove')">
        {{ t('workflowInspector.btnRemove') }}
      </el-button>
    </div>
    <div v-if="!readonly" class="workflow-quick-create">
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
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    nodeKinds,
    type NodeFormState,
    type WorkflowNodeKind,
  } from '../composables/workflowConstants'
  import { jobApi } from '@/api/job'
  import { queryPipelineDefinitionsQuery } from '@/api/system'
  import { useTenantStore } from '@/stores/tenant'
  import DslEditor from './DslEditor.vue'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  const props = withDefaults(
    defineProps<{
      nodeForm: NodeFormState
      upstreamNodeCodes?: string[]
      readonly?: boolean
    }>(),
    { upstreamNodeCodes: () => [], readonly: false },
  )
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

  // ─── GATEWAY join_mode 读写 ─────────────────────────────────────────────────
  // 后端从 node_params JSONB 读 join_mode：保 form 写入透过 nodeParams 字符串内嵌
  // 字段同步，避免给 NodeFormState 加 1 个只有 GATEWAY 用到的字段（也避免落库时漏写）。

  interface ParsedNodeParams extends Record<string, unknown> {
    join_mode?: string
    join_n?: number
  }

  function parseParams(): ParsedNodeParams {
    if (!props.nodeForm.nodeParams || !props.nodeForm.nodeParams.trim()) return {}
    try {
      const obj = JSON.parse(props.nodeForm.nodeParams) as unknown
      return obj && typeof obj === 'object' ? (obj as ParsedNodeParams) : {}
    } catch {
      return {}
    }
  }
  function writeParams(next: ParsedNodeParams) {
    // 序列化时把 undefined 字段剔掉，避免 JSON 里出现冗余 null
    const clean: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(next)) {
      if (v !== undefined && v !== null && v !== '') clean[k] = v
    }
    props.nodeForm.nodeParams = JSON.stringify(clean, null, 2)
  }

  const joinMode = computed<string>({
    get: () => (parseParams().join_mode as string) ?? '',
    set: (val) => {
      const cur = parseParams()
      if (!val) {
        delete cur.join_mode
        delete cur.join_n
      } else {
        cur.join_mode = val
        if (val !== 'N_OF_M') delete cur.join_n
        else if (cur.join_n == null) cur.join_n = 1
      }
      writeParams(cur)
    },
  })
  const joinN = computed<number>({
    get: () => Number(parseParams().join_n ?? 1),
    set: (val) => {
      const cur = parseParams()
      cur.join_n = Math.max(1, Math.floor(val))
      writeParams(cur)
    },
  })
</script>
