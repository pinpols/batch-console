<template>
  <SectionCard>
    <template #header>
      <span>{{ t('workflowProgress.title') }}</span>
      <div class="execution-progress__actions">
        <LiveStatusBadge :status="status" :last-refreshed-at="lastRefreshedAt" />
        <el-button text :loading="loading" @click="refresh">{{ t('common.refresh') }}</el-button>
      </div>
    </template>
    <el-alert
      v-if="error"
      :title="t('workflowProgress.unavailable')"
      type="warning"
      :closable="false"
      show-icon
    />
    <DataState
      :loading="loading"
      :has-data="Boolean(progress)"
      :empty-text="t('workflowProgress.empty')"
    >
      <template v-if="progress">
        <el-alert
          v-if="!progress.snapshotAvailable"
          :title="t('workflowProgress.noSnapshot')"
          type="warning"
          :closable="false"
        />
        <template v-else>
          <div class="execution-progress__summary" role="status">
            <span>{{
              t('workflowProgress.rootStatus', { status: statusText(progress.runStatus) })
            }}</span>
            <span>{{
              t('workflowProgress.completed', { done: totals.terminal, total: totals.total })
            }}</span>
            <span>{{ t('workflowProgress.succeeded', { count: totals.succeeded }) }}</span>
            <span>{{ t('workflowProgress.notExecuted', { count: totals.notExecuted }) }}</span>
            <span>{{ t('workflowProgress.active', { count: totals.active }) }}</span>
            <span>{{
              t('workflowProgress.version', { version: progress.workflowVersion ?? '—' })
            }}</span>
          </div>
          <el-progress
            :percentage="totals.percentage"
            :aria-label="t('workflowProgress.completionLabel')"
          />
          <WorkflowMiniDag interactive auto-fit :mermaid-text="graph" :max-height="520" />
          <p class="execution-progress__hint">{{ t('workflowProgress.denominatorHint') }}</p>
          <el-table :data="tableNodes" row-key="nodeCode" size="small">
            <el-table-column :label="t('workflowProgress.node')" min-width="160">
              <template #default="{ row }"
                >{{ row.nodeName || row.nodeCode }}<br /><span class="execution-progress__hint">{{
                  row.nodeCode
                }}</span></template
              >
            </el-table-column>
            <el-table-column :label="t('workflowProgress.statusLabel')" min-width="100">
              <template #default="{ row }">
                <span>{{ statusText(executionNodeDisplayStatus(row as Node)) }}</span>
                <span
                  v-if="executionNodeDisplayStatus(row as Node) !== row.nodeStatus"
                  class="execution-progress__hint"
                >
                  {{
                    t('workflowProgress.workflowNodeState', { status: statusText(row.nodeStatus) })
                  }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="t('workflowProgress.steps')" min-width="160">
              <template #default="{ row }">{{ row.activeSteps.join(', ') || '—' }}</template>
            </el-table-column>
            <el-table-column :label="t('workflowProgress.partitions')" min-width="140">
              <template #default="{ row }">{{ partitionText(row as Node) }}</template>
            </el-table-column>
            <el-table-column :label="t('workflowProgress.createdTasks')" min-width="140">
              <template #default="{ row }">{{
                row.jobInstanceId ? `${row.finishedTasks ?? 0} / ${row.createdTasks ?? 0}` : '—'
              }}</template>
            </el-table-column>
            <el-table-column :label="t('workflowProgress.blocker')" min-width="140">
              <template #default="{ row }">{{
                row.errorCode || row.skipReasonCode || '—'
              }}</template>
            </el-table-column>
            <el-table-column :label="t('workflowProgress.job')" min-width="120">
              <template #default="{ row }"
                ><router-link
                  v-if="row.jobInstanceId"
                  class="cell-link"
                  :to="`/monitor/job-instances/${row.jobInstanceId}`"
                  >{{ row.jobInstanceId }}</router-link
                ><span v-else>—</span></template
              >
            </el-table-column>
          </el-table>
        </template>
      </template>
    </DataState>
  </SectionCard>
</template>

<script setup lang="ts">
  import { computed, watch, type DeepReadonly } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useTenantStore } from '@/stores/tenant'
  import SectionCard from '@/components/common/SectionCard.vue'
  import LiveStatusBadge from '@/components/common/LiveStatusBadge.vue'
  import DataState from '@/components/common/DataState.vue'
  import WorkflowMiniDag from './WorkflowMiniDag.vue'
  import { useWorkflowExecutionProgress } from '@/composables/useWorkflowExecutionProgress'
  import {
    executionGraph,
    executionNodeDisplayStatus,
    executionTotals,
  } from '@/utils/workflowExecutionGraph'
  import type { components } from '@/types/api.generated'
  type Node = components['schemas']['WorkflowExecutionNodeProgress']
  const props = defineProps<{ runId: number }>()
  const emit = defineEmits<{
    snapshot: [value: DeepReadonly<components['schemas']['WorkflowExecutionProgress']>]
  }>()
  const tenant = useTenantStore()
  const { t, te } = useI18n()
  const { progress, status, error, loading, lastRefreshedAt, refresh } =
    useWorkflowExecutionProgress(
      () => tenant.tenantId,
      () => props.runId,
    )
  watch(progress, (value) => {
    if (value) emit('snapshot', value)
  })
  const totals = computed(() => executionTotals(progress.value?.nodes ?? []))
  const tableNodes = computed(() =>
    (progress.value?.nodes ?? []).map((n) => ({ ...n, activeSteps: [...n.activeSteps] })),
  )
  function statusText(value: string) {
    return te(`workflowProgress.states.${value}`) ? t(`workflowProgress.states.${value}`) : value
  }
  function partitionText(node: DeepReadonly<Node>) {
    return node.expectedPartitions != null && node.expectedPartitions > 0
      ? `${node.completedPartitions ?? 0} / ${node.expectedPartitions}`
      : t('workflowProgress.unknownTotal')
  }
  const graph = computed(() =>
    executionGraph(
      progress.value?.nodes ?? [],
      progress.value?.edges ?? [],
      (node) => {
        const details = [
          node.nodeName || node.nodeCode,
          statusText(executionNodeDisplayStatus(node)),
        ]
        if (node.expectedPartitions != null && node.expectedPartitions > 0)
          details.push(
            t('workflowProgress.partitionInline', {
              done: node.completedPartitions ?? 0,
              total: node.expectedPartitions,
            }),
          )
        if (node.activeSteps.length)
          details.push(t('workflowProgress.stepInline', { steps: node.activeSteps.join(', ') }))
        return details.join(' | ')
      },
      (edge) =>
        edge.edgeType
          ? te(`workflowProgress.edges.${edge.edgeType}`)
            ? t(`workflowProgress.edges.${edge.edgeType}`)
            : edge.edgeType
          : '',
    ),
  )
</script>

<style scoped>
  .execution-progress__actions,
  .execution-progress__summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-md);
  }
  .execution-progress__summary {
    margin-block: var(--space-md);
  }
  .execution-progress__hint {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
</style>
