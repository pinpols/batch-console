<template>
  <SectionCard>
    <template #header
      ><span>{{ t('jobProgress.title') }}</span
      ><LiveStatusBadge :status="status" :last-refreshed-at="lastRefreshedAt"
    /></template>
    <el-alert
      v-if="error"
      :title="t('workflowProgress.unavailable')"
      type="warning"
      :closable="false"
    />
    <DataState
      :loading="loading"
      :has-data="Boolean(progress)"
      :empty-text="t('workflowProgress.empty')"
    >
      <template v-if="progress">
        <p>
          {{ t('jobProgress.status', { status: stateText(progress.instanceStatus) }) }}
          <span v-if="progress.currentStage">
            · {{ t('jobProgress.currentStage', { stage: progress.currentStage }) }}</span
          >
          <router-link
            v-if="progress.pipelineInstanceId"
            class="cell-link"
            :to="`/files/pipeline-obs?pipelineInstanceId=${progress.pipelineInstanceId}`"
          >
            · {{ t('jobProgress.pipelineLink', { id: progress.pipelineInstanceId }) }}</router-link
          >
        </p>
        <div v-for="item in counts" :key="item.scope" class="job-progress__counts">
          <span
            >{{ t(`jobProgress.${item.scope}`) }} ·
            {{
              t('jobProgress.counts', {
                closed: item.closed,
                total: item.total ?? t('dailyProgress.unknown'),
                success: item.succeeded,
                created: item.created,
              })
            }}</span
          >
          <el-progress
            v-if="item.percentage != null"
            :percentage="item.percentage"
            :aria-label="t(`jobProgress.${item.scope}`)"
          />
          <p v-if="item.states.length">
            <span v-for="state in item.states" :key="state.status" class="job-progress__state">{{
              t('jobProgress.stateCount', { status: stateText(state.status), count: state.count })
            }}</span>
          </p>
          <p v-else>{{ t('jobProgress.notCreated') }}</p>
        </div>
        <p class="job-progress__hint">{{ t('jobProgress.denominator') }}</p>
        <template v-if="progress.stageGraphAvailable">
          <p>
            {{
              t('jobProgress.pipelineVersion', {
                code: progress.systemPipelineCode,
                version: progress.systemPipelineVersion,
              })
            }}
          </p>
          <ExecutionAttentionLinks
            :items="attentionStages"
            :selected="selectedStage"
            @select="selectedStage = $event"
          />
          <WorkflowMiniDag
            :mermaid-text="graph"
            interactive
            auto-fit
            :node-options="stageOptions"
            :selected-node="selectedStage"
            @select-node="selectedStage = $event"
          />
          <p class="job-progress__hint">{{ t('workflowProgress.selectHint') }}</p>
          <div v-if="selectedStage" class="job-progress__selection">
            <span>{{ t('workflowProgress.selectedNode', { node: selectedStage }) }}</span>
            <el-button text @click="selectedStage = null">{{
              t('workflowProgress.clearSelection')
            }}</el-button>
          </div>
        </template>
        <el-alert v-else :title="t('jobProgress.noGraph')" type="info" :closable="false" />
        <el-table v-if="progress.stages.length" :data="visibleStages" size="small">
          <el-table-column prop="stageCode" :label="t('jobProgress.stage')" min-width="140" />
          <el-table-column :label="t('workflowProgress.statusLabel')" min-width="200"
            ><template #default="{ row }">{{
              stateText(row.stageStatus)
            }}</template></el-table-column
          >
          <el-table-column prop="runSeq" :label="t('jobProgress.attempt')" width="90" />
          <el-table-column :label="t('jobProgress.processed')" min-width="120"
            ><template #default="{ row }">{{ row.rowsProcessed ?? '—' }}</template></el-table-column
          >
          <el-table-column
            prop="errorCode"
            :label="t('workflowProgress.blocker')"
            min-width="160"
            show-overflow-tooltip
          />
        </el-table>
      </template>
    </DataState>
  </SectionCard>
  <WorkflowExecutionPanel v-if="progress?.workflowRunId" :run-id="progress.workflowRunId" />
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useTenantStore } from '@/stores/tenant'
  import { useJobExecutionProgress } from '@/composables/useJobExecutionProgress'
  import { jobExecutionCounts } from '@/utils/jobExecutionProgress'
  import { executionGraph } from '@/utils/workflowExecutionGraph'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DataState from '@/components/common/DataState.vue'
  import LiveStatusBadge from '@/components/common/LiveStatusBadge.vue'
  import WorkflowMiniDag from '@/components/workflow/WorkflowMiniDag.vue'
  import ExecutionAttentionLinks from '@/components/workflow/ExecutionAttentionLinks.vue'
  import WorkflowExecutionPanel from '@/components/workflow/WorkflowExecutionPanel.vue'
  import type { JobExecutionProgress } from '@/api/jobProgress'
  import type { DeepReadonly } from 'vue'
  const props = defineProps<{ jobId: number }>()
  const emit = defineEmits<{ snapshot: [data: DeepReadonly<JobExecutionProgress>] }>()
  const tenant = useTenantStore()
  const { t, te } = useI18n()
  const selectedStage = ref<string | null>(null)
  const { progress, status, error, loading, lastRefreshedAt } = useJobExecutionProgress(
    () => tenant.tenantId,
    () => props.jobId,
  )
  watch(progress, (data) => {
    if (data) emit('snapshot', data)
    if (
      selectedStage.value &&
      (!data?.stageGraphAvailable ||
        !data.stages.some((stage) => stage.stageCode === selectedStage.value))
    )
      selectedStage.value = null
  })
  watch([() => tenant.tenantId, () => props.jobId], () => {
    selectedStage.value = null
  })
  const stageOptions = computed(() =>
    (progress.value?.stages ?? []).map((stage) => ({
      code: stage.stageCode,
      label: t('workflowProgress.selectNode', { node: stage.stageCode }),
    })),
  )
  const attentionStages = computed(() =>
    (progress.value?.stages ?? []).map((stage) => ({
      code: stage.stageCode,
      name: stage.stageCode,
      state: stage.stageStatus,
      stateLabel: stateText(stage.stageStatus),
    })),
  )
  const visibleStages = computed(() =>
    (progress.value?.stages ?? []).filter(
      (stage) => !selectedStage.value || stage.stageCode === selectedStage.value,
    ),
  )
  const counts = computed(() => (progress.value ? jobExecutionCounts(progress.value) : []))
  function stateText(state: string) {
    return te(`workflowProgress.states.${state}`) ? t(`workflowProgress.states.${state}`) : state
  }
  const graph = computed(() => {
    const stages = progress.value?.stages ?? []
    return executionGraph(
      stages.map((s) => ({
        nodeCode: s.stageCode,
        nodeType: 'STAGE',
        nodeStatus: s.stageStatus,
        activeSteps: [],
      })),
      stages.slice(1).map((s, i) => ({
        fromNodeCode: stages[i].stageCode,
        toNodeCode: s.stageCode,
        edgeType: '',
      })),
      (node) => `${node.nodeCode} | ${stateText(node.nodeStatus)}`,
    )
  })
</script>
<style scoped>
  .job-progress__counts {
    margin-block: var(--space-4);
  }
  .job-progress__state {
    margin-inline-end: var(--space-3, 12px);
  }
  .job-progress__hint {
    color: var(--el-text-color-secondary);
    font-size: var(--text-sm);
  }
</style>
