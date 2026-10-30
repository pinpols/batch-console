<script setup lang="ts">
  /**
   * JOB 节点表单。
   *  - jobCode 下拉(useJobCodeOptions,失败可手输)
   *  - maxRetries / timeoutSeconds 数字输入
   *  - skipExpression 文本(粗校验:非空字符串)
   * 表单不立即保存,失焦写回 store(走 updateNode → 入 undo 栈)。
   */
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'
  import { useJobCodeOptions } from '@/composables/useJobCodeOptions'
  import { useJobDefinitionDependencies } from '@/composables/useJobDefinitionDependencies'
  import { useMetaWindowsQuery } from '@/composables/queries/useConsoleMeta'
  import { edgeTypeOf } from '../canvas/edgePresentation'
  import type { DesignerNode } from '../types'

  const props = defineProps<{ node: DesignerNode; readonly: boolean }>()
  const { t } = useI18n()
  const store = useDesignerStore()
  const { loading, options, load } = useJobCodeOptions()
  const jobDependencies = useJobDefinitionDependencies()
  const { data: windowOptions } = useMetaWindowsQuery()

  interface JobAttrs {
    jobCode?: string
    windowCode?: string
    maxRetries?: number
    timeoutSeconds?: number
    skipExpression?: string
  }

  function readAttrs(n: DesignerNode): JobAttrs {
    const a = (n.attrs ?? {}) as Record<string, unknown>
    return {
      jobCode: typeof a.jobCode === 'string' ? a.jobCode : '',
      windowCode: typeof a.windowCode === 'string' ? a.windowCode : '',
      maxRetries: typeof a.maxRetries === 'number' ? a.maxRetries : undefined,
      timeoutSeconds: typeof a.timeoutSeconds === 'number' ? a.timeoutSeconds : undefined,
      skipExpression: typeof a.skipExpression === 'string' ? a.skipExpression : '',
    }
  }

  const local = ref<JobAttrs>(readAttrs(props.node))
  const localName = ref(props.node.nodeName)
  const linkedJobCode = computed(() => {
    const rawJobCode = String(props.node.attrs?.jobCode ?? '')
    return rawJobCode.trim()
  })
  const hasJobBinding = computed(() => linkedJobCode.value.length > 0)
  const currentFlowDependencies = computed(() => {
    const nodeById = new Map(store.nodes.map((node) => [node.id, node]))
    const connectedEdges = store.edges.filter(
      (edge) => edge.source === props.node.id || edge.target === props.node.id,
    )
    const dependencyCandidates = connectedEdges.map((edge) => {
      const incoming = edge.target === props.node.id
      const relatedNode = nodeById.get(incoming ? edge.source : edge.target)
      if (!relatedNode) return null
      return {
        id: relatedNode.id,
        direction: incoming ? 'incoming' : 'outgoing',
        label:
          relatedNode.nodeName === relatedNode.nodeCode
            ? relatedNode.nodeCode
            : `${relatedNode.nodeName} (${relatedNode.nodeCode})`,
        edgeType: edgeTypeOf(edge),
        enabled: edge.attrs?.enabled !== false,
      }
    })
    return dependencyCandidates.filter(
      (relation): relation is NonNullable<typeof relation> => relation !== null,
    )
  })
  const currentFlowIncoming = computed(() =>
    currentFlowDependencies.value.filter((relation) => relation.direction === 'incoming'),
  )
  const currentFlowOutgoing = computed(() =>
    currentFlowDependencies.value.filter((relation) => relation.direction === 'outgoing'),
  )
  const fieldErrors = computed(() => {
    const m = new Map<string, string>()
    for (const e of store.validationErrors) {
      if (e.nodeId === props.node.id && e.field) m.set(e.field, e.messageKey)
    }
    return m
  })

  function localizedFieldError(field: string): string | undefined {
    const messageKey = fieldErrors.value.get(field)
    return messageKey ? t(messageKey) : undefined
  }

  watch(
    () => [props.node.id, props.node.nodeName, JSON.stringify(props.node.attrs ?? {})],
    () => {
      local.value = readAttrs(props.node)
      localName.value = props.node.nodeName
    },
  )

  watch(
    () => store.meta.tenantId,
    (tenantId) => {
      if (tenantId) void load(tenantId)
    },
    { immediate: true },
  )

  watch(
    [() => store.meta.tenantId, linkedJobCode],
    ([tenantId, jobCode]) => {
      void jobDependencies.load(tenantId, jobCode)
    },
    { immediate: true },
  )

  function loadDependentPage(page: number) {
    void jobDependencies.loadDownstreamPage(store.meta.tenantId, linkedJobCode.value, page)
  }

  function retryDependencies() {
    void jobDependencies.load(
      store.meta.tenantId,
      linkedJobCode.value,
      jobDependencies.downstreamPage.value,
    )
  }

  function writeAttr(field: keyof JobAttrs, raw: unknown) {
    if (props.readonly) return
    // 数字字段空 → undefined(避免落 0 覆盖 default)
    let v: unknown = raw
    if (field === 'maxRetries' || field === 'timeoutSeconds') {
      v = raw === '' || raw == null ? undefined : Number(raw)
    }
    const prevAttrs = (props.node.attrs ?? {}) as Record<string, unknown>
    if (prevAttrs[field] === v) return
    store.updateNode(props.node.id, { attrs: { [field]: v } })
  }

  function onBlurName() {
    if (props.readonly) return
    if (localName.value === props.node.nodeName) return
    store.updateNode(props.node.id, { nodeName: localName.value })
  }
</script>

<template>
  <el-form label-position="top" size="small">
    <el-form-item :label="t('workflowDesignerMvp.field.nodeType')">
      <el-input :model-value="t('workflowDesignerSpike.nodeJob')" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeCode')">
      <el-input :model-value="props.node.nodeCode" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeName')">
      <el-input v-model="localName" :readonly="props.readonly" @blur="onBlurName" />
    </el-form-item>
    <el-form-item
      :label="t('workflowDesignerMvp.field.jobCode')"
      :error="localizedFieldError('jobCode')"
      required
    >
      <el-select
        v-model="local.jobCode"
        filterable
        allow-create
        default-first-option
        :loading="loading"
        :disabled="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.jobCodePlaceholder')"
        @change="writeAttr('jobCode', $event)"
      >
        <el-option v-for="c in options" :key="c" :label="c" :value="c" />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.windowCode')">
      <el-select
        v-model="local.windowCode"
        clearable
        filterable
        :disabled="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.windowCodePlaceholder')"
        @change="writeAttr('windowCode', $event)"
      >
        <el-option
          v-for="window in windowOptions ?? []"
          :key="window.value"
          :label="window.label ?? window.value"
          :value="window.value"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.maxRetries')">
      <el-input-number
        v-model="local.maxRetries"
        :min="0"
        :max="10"
        :disabled="props.readonly"
        controls-position="right"
        @change="writeAttr('maxRetries', $event)"
      />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.timeoutSeconds')">
      <el-input-number
        v-model="local.timeoutSeconds"
        :min="0"
        :disabled="props.readonly"
        controls-position="right"
        @change="writeAttr('timeoutSeconds', $event)"
      />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.skipExpression')">
      <el-input
        v-model="local.skipExpression"
        :readonly="props.readonly"
        :placeholder="t('workflowDesignerMvp.field.skipExpressionPlaceholder')"
        @blur="writeAttr('skipExpression', local.skipExpression)"
      />
    </el-form-item>

    <section class="job-dependencies" :aria-label="t('workflowDesignerMvp.jobDependencies.title')">
      <h4>{{ t('workflowDesignerMvp.jobDependencies.title') }}</h4>
      <div class="job-dependencies__group">
        <div class="job-dependencies__heading">
          {{ t('workflowDesignerMvp.jobDependencies.workflowTitle') }}
        </div>
        <div class="job-dependencies__columns">
          <div>
            <span class="job-dependencies__label">
              {{ t('workflowDesignerMvp.jobDependencies.workflowUpstream') }}
            </span>
            <div v-if="currentFlowIncoming.length" class="job-dependencies__items">
              <div
                v-for="relation in currentFlowIncoming"
                :key="relation.id"
                class="job-dependencies__item"
              >
                <span>{{ relation.label }}</span>
                <el-tag size="small" :type="relation.enabled ? 'success' : 'info'">
                  {{ t(`enum.edgeType.${relation.edgeType}`) }}
                </el-tag>
              </div>
            </div>
            <span v-else class="job-dependencies__empty">
              {{ t('workflowDesignerMvp.jobDependencies.noWorkflowUpstream') }}
            </span>
          </div>
          <div>
            <span class="job-dependencies__label">
              {{ t('workflowDesignerMvp.jobDependencies.workflowDownstream') }}
            </span>
            <div v-if="currentFlowOutgoing.length" class="job-dependencies__items">
              <div
                v-for="relation in currentFlowOutgoing"
                :key="relation.id"
                class="job-dependencies__item"
              >
                <span>{{ relation.label }}</span>
                <el-tag size="small" :type="relation.enabled ? 'success' : 'info'">
                  {{ t(`enum.edgeType.${relation.edgeType}`) }}
                </el-tag>
              </div>
            </div>
            <span v-else class="job-dependencies__empty">
              {{ t('workflowDesignerMvp.jobDependencies.noWorkflowDownstream') }}
            </span>
          </div>
        </div>
      </div>

      <div class="job-dependencies__group">
        <div class="job-dependencies__heading">
          {{ t('workflowDesignerMvp.jobDependencies.definitionTitle') }}
          <el-tag size="small" type="info">{{ t('workflowDesignerMvp.readonlyTag') }}</el-tag>
        </div>
        <el-skeleton v-if="jobDependencies.loading.value" :rows="2" animated />
        <span v-else-if="!hasJobBinding" class="job-dependencies__empty">
          {{ t('workflowDesignerMvp.jobDependencies.selectJob') }}
        </span>
        <template v-else-if="!jobDependencies.loading.value">
          <div v-if="jobDependencies.hasError.value" class="job-dependencies__error">
            <el-alert
              :title="t('workflowDesignerMvp.jobDependencies.loadError')"
              type="warning"
              :closable="false"
              show-icon
            />
            <el-button text type="primary" @click="retryDependencies">
              {{ t('common.retry') }}
            </el-button>
          </div>
          <el-alert
            v-if="!jobDependencies.definition.value && !jobDependencies.hasError.value"
            :title="t('workflowDesignerMvp.jobDependencies.definitionMissing')"
            type="info"
            :closable="false"
            show-icon
          />
          <div class="job-dependencies__label">
            {{ t('workflowDesignerMvp.jobDependencies.definitionUpstream') }}
          </div>
          <div class="job-dependencies__definition-row">
            <template v-if="jobDependencies.definition.value?.dependsOnJobCode">
              <span class="job-dependencies__code">
                {{
                  jobDependencies.upstream.value?.jobName ||
                  jobDependencies.definition.value.dependsOnJobCode
                }}
              </span>
              <span class="job-dependencies__code-detail">
                {{ jobDependencies.definition.value.dependsOnJobCode }}
              </span>
            </template>
            <span v-else-if="jobDependencies.definition.value" class="job-dependencies__empty">
              {{ t('workflowDesignerMvp.jobDependencies.noDefinitionUpstream') }}
            </span>
            <span v-else class="job-dependencies__empty">{{ linkedJobCode }}</span>
          </div>
          <div class="job-dependencies__label">
            {{
              t('workflowDesignerMvp.jobDependencies.definitionDownstream', {
                count: jobDependencies.downstreamTotal.value,
              })
            }}
          </div>
          <div
            v-if="jobDependencies.downstream.value.length"
            v-loading="jobDependencies.downstreamLoading.value"
            class="job-dependencies__items"
          >
            <div
              v-for="dependent in jobDependencies.downstream.value"
              :key="dependent.id"
              class="job-dependencies__item"
            >
              <span>{{ dependent.jobName || dependent.jobCode }}</span>
              <span class="job-dependencies__code-detail">{{ dependent.jobCode }}</span>
              <el-tag size="small" :type="dependent.enabled ? 'success' : 'info'">
                {{ dependent.enabled ? t('common.enabled') : t('common.disabled') }}
              </el-tag>
            </div>
            <el-pagination
              v-if="jobDependencies.downstreamTotal.value > jobDependencies.pageSize"
              small
              layout="prev, pager, next"
              :current-page="jobDependencies.downstreamPage.value"
              :page-size="jobDependencies.pageSize"
              :total="jobDependencies.downstreamTotal.value"
              :disabled="jobDependencies.downstreamLoading.value"
              @current-change="loadDependentPage"
            />
          </div>
          <span v-else-if="!jobDependencies.hasError.value" class="job-dependencies__empty">
            {{ t('workflowDesignerMvp.jobDependencies.noDefinitionDownstream') }}
          </span>
        </template>
      </div>
    </section>
  </el-form>
</template>

<style scoped>
  .job-dependencies {
    display: grid;
    gap: 10px;
    border-top: 1px solid var(--color-border-light);
    padding-top: 12px;
  }
  .job-dependencies h4 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 13px;
  }
  .job-dependencies__group {
    display: grid;
    gap: 9px;
    padding: 10px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-control);
    background: var(--color-bg-subtle, var(--color-bg-page));
  }
  .job-dependencies__error {
    display: grid;
    justify-items: start;
    gap: 4px;
  }
  .job-dependencies__heading,
  .job-dependencies__item,
  .job-dependencies__definition-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }
  .job-dependencies__heading {
    color: var(--color-text-primary);
    font-size: 12px;
    font-weight: 600;
  }
  .job-dependencies__columns {
    display: grid;
    gap: 10px;
  }
  .job-dependencies__label {
    display: block;
    margin-bottom: 5px;
    color: var(--color-text-secondary);
    font-size: 11px;
  }
  .job-dependencies__items {
    display: grid;
    gap: 6px;
  }
  .job-dependencies__item {
    color: var(--color-text-primary);
    font-size: 12px;
  }
  .job-dependencies__item > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .job-dependencies__empty,
  .job-dependencies__code-detail {
    color: var(--color-text-tertiary);
    font-size: 11px;
  }
  .job-dependencies__definition-row {
    justify-content: flex-start;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .job-dependencies__code {
    color: var(--color-text-primary);
    font-size: 12px;
    font-weight: 600;
  }
  .job-dependencies :deep(.el-pagination) {
    justify-content: flex-end;
    margin-top: 4px;
  }
</style>
