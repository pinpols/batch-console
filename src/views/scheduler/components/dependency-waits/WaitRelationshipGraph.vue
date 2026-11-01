<template>
  <div class="wait-graph" data-testid="wait-relationship-graph">
    <el-form inline @submit.prevent="load">
      <el-form-item :label="t('dependencyWaits.waitType')">
        <el-select v-model="waitType" class="wait-graph__filter">
          <el-option :label="t('dependencyWaits.graph.allTypes')" value="" />
          <el-option
            v-for="kind in kinds"
            :key="kind"
            :value="kind"
            :label="t(`dependencyWaits.graph.types.${kind}`)"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('dependencyWaits.status')">
        <el-select v-model="waitStatus" class="wait-graph__filter">
          <el-option :label="t('dependencyWaits.all')" value="" />
          <el-option
            v-for="status in statuses"
            :key="status"
            :value="status"
            :label="t(`dependencyWaits.states.${status}`)"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('dependencyWaits.fromDate')">
        <el-date-picker v-model="bizDateFrom" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item :label="t('dependencyWaits.toDate')">
        <el-date-picker v-model="bizDateTo" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-button type="primary" :loading="loading" @click="load">{{
        t('common.search')
      }}</el-button>
    </el-form>
    <el-alert
      :title="t('dependencyWaits.graph.liveHint')"
      type="info"
      :closable="false"
      show-icon
    />
    <el-alert
      v-if="error"
      :title="t('dependencyWaits.graph.incomplete')"
      type="error"
      :closable="false"
      show-icon
    />
    <p role="status" class="wait-graph__summary">
      {{
        loading
          ? t('dependencyWaits.graph.loading', { count: records.length })
          : t('dependencyWaits.graph.count', { count: records.length })
      }}
    </p>
    <section v-if="!loading && !error && records.length" class="wait-graph__topology">
      <h3>{{ t('dependencyWaits.graph.topologyTitle') }}</h3>
      <p class="wait-graph__summary">{{ t('dependencyWaits.graph.topologyHint') }}</p>
      <el-alert
        v-if="topology.tooLarge"
        :title="t('dependencyWaits.graph.topologyTooLarge')"
        type="warning"
        :closable="false"
        show-icon
      />
      <template v-else>
        <el-alert
          v-if="topology.unresolved"
          :title="t('dependencyWaits.graph.topologyUnresolved', { count: topology.unresolved })"
          type="warning"
          :closable="false"
          show-icon
        />
        <WorkflowMiniDag
          v-if="topology.nodes.length"
          interactive
          auto-fit
          :mermaid-text="mermaidText"
          :max-height="520"
        />
        <p v-else class="wait-graph__summary">
          {{ t('dependencyWaits.graph.topologyUnavailable') }}
        </p>
      </template>
    </section>
    <h3 v-if="records.length">{{ t('dependencyWaits.graph.detailsTitle') }}</h3>
    <el-empty
      v-if="!loading && !error && records.length === 0"
      :description="t('dependencyWaits.graph.empty')"
    />
    <ol v-else class="wait-graph__list" :aria-label="t('dependencyWaits.graph.title')">
      <li
        v-for="row in visibleRows"
        :key="`${row.item.waitType}:${row.item.id}`"
        class="wait-graph__record"
      >
        <div class="wait-graph__meta">
          <el-tag size="small">{{ t(`dependencyWaits.graph.types.${row.item.waitType}`) }}</el-tag>
          <span>{{ row.item.bizDate }}</span>
          <el-tag size="small" type="info">{{ stateLabel(row.item.waitStatus) }}</el-tag>
          <span>{{
            t('dependencyWaits.updatedAt', { time: fmtDatetime(row.item.updatedAt) })
          }}</span>
        </div>
        <div class="wait-graph__relation">
          <div class="wait-graph__upstreams">
            <span
              v-for="(code, index) in row.dependencies.codes"
              :key="`${index}:${code}`"
              class="wait-graph__node"
              >{{ code }}</span
            >
            <span v-if="!row.dependencies.codes.length" class="wait-graph__empty-node">{{
              row.item.waitType === 'CAPACITY_ADMISSION'
                ? t('dependencyWaits.graph.capacity')
                : t('dependencyWaits.graph.noDependency')
            }}</span>
          </div>
          <span
            v-if="row.dependencies.codes.length"
            class="wait-graph__arrow"
            :aria-label="t('dependencyWaits.graph.arrow')"
            >→</span
          >
          <strong class="wait-graph__subject">{{ row.item.subjectCode }}</strong>
        </div>
        <p
          v-if="!row.item.dependencySnapshotValid || row.dependencies.unknown"
          class="wait-graph__unknown"
        >
          {{ t('dependencyWaits.graph.unknown') }}
        </p>
        <p v-if="row.item.reason" class="wait-graph__reason">
          {{ t('dependencyWaits.blockedReason') }}: {{ row.item.reason }}
        </p>
      </li>
    </ol>
    <el-pagination
      v-if="records.length > pageSize"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="records.length"
      layout="total, prev, pager, next"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { listWaitRelationships, type WaitRelationship } from '@/api/dependencyWaits'
  import { fmtDatetime } from '@/utils/datetime'
  import WorkflowMiniDag from '@/components/workflow/WorkflowMiniDag.vue'
  import {
    buildWaitTopology,
    relationshipDependencies,
    waitTopologyMermaid,
  } from '../../waitRelationshipGraph'

  const props = defineProps<{ tenantId: string }>()
  const { t, te } = useI18n({ useScope: 'global' })
  const kinds: WaitRelationship['waitType'][] = [
    'CALENDAR',
    'JOB',
    'READINESS',
    'CAPACITY_ADMISSION',
  ]
  const waitType = ref<WaitRelationship['waitType'] | ''>('')
  const statuses = [
    'WAITING',
    'PENDING',
    'OPENED',
    'SKIPPED',
    'RELEASED',
    'CANCELLED',
    'TIMED_OUT',
    'RESUMED',
    'REJECTED',
  ] as const
  const waitStatus = ref('')
  const bizDateFrom = ref('')
  const bizDateTo = ref('')
  const records = ref<WaitRelationship[]>([])
  const page = ref(1)
  const pageSize = 15
  const loading = ref(false)
  const error = ref(false)
  let controller: AbortController | undefined
  let sequence = 0
  const visibleRows = computed(() =>
    records.value.slice((page.value - 1) * pageSize, page.value * pageSize).map((item) => ({
      item,
      dependencies: item.dependencySnapshotValid
        ? relationshipDependencies(item.waitType, item.dependencySnapshot)
        : { codes: [], unknown: true },
    })),
  )
  const topology = computed(() => buildWaitTopology(loading.value ? [] : records.value))
  const mermaidText = computed(() =>
    waitTopologyMermaid(topology.value, (node) => {
      const kind = t(`dependencyWaits.graph.types.${node.kind}`)
      const waits = node.waitCount
        ? ` · ${t('dependencyWaits.graph.nodeWaitCount', { count: node.waitCount })}`
        : ''
      const statuses = node.statuses.map(stateLabel)
      if (!node.waitCount || node.missingStatus)
        statuses.push(t('dependencyWaits.graph.statusUnavailable'))
      const state = t('dependencyWaits.graph.nodeStatuses', { statuses: statuses.join(', ') })
      return `${kind} · ${node.code} · ${node.date}${waits} · ${state}`
    }),
  )
  function stateLabel(status: string) {
    const key = `dependencyWaits.states.${status}`
    return te(key) ? t(key) : status
  }
  async function load() {
    controller?.abort()
    controller = new AbortController()
    const current = ++sequence
    const tenantId = props.tenantId
    const kind = waitType.value
    const status = waitStatus.value
    const from = bizDateFrom.value
    const to = bizDateTo.value
    records.value = []
    page.value = 1
    error.value = false
    loading.value = true
    let cursorType: WaitRelationship['waitType'] | undefined
    let cursorId: string | undefined
    const seenCursors = new Set<string>()
    try {
      for (;;) {
        const result = await listWaitRelationships(
          {
            tenantId,
            waitType: kind || undefined,
            waitStatus: status || undefined,
            bizDateFrom: from || undefined,
            bizDateTo: to || undefined,
            cursorType,
            cursorId,
            pageSize: 100,
          },
          controller.signal,
        )
        if (current !== sequence) return
        records.value.push(...result.items)
        if (!result.hasMore) break
        if (
          !result.items.length ||
          !result.nextCursorType ||
          !result.nextCursorId ||
          (result.nextCursorType === cursorType && result.nextCursorId === cursorId)
        )
          throw new Error('Invalid wait relationship cursor')
        const nextCursor = JSON.stringify([result.nextCursorType, result.nextCursorId])
        if (seenCursors.has(nextCursor)) throw new Error('Repeated wait relationship cursor')
        seenCursors.add(nextCursor)
        cursorType = result.nextCursorType
        cursorId = result.nextCursorId
      }
    } catch {
      if (current === sequence) error.value = true
    } finally {
      if (current === sequence) loading.value = false
    }
  }
  watch(
    () => props.tenantId,
    () => void load(),
    { immediate: true },
  )
  onBeforeUnmount(() => {
    ++sequence
    controller?.abort()
  })
  defineExpose({ load })
</script>

<style scoped>
  .wait-graph {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .wait-graph__filter {
    min-width: 180px;
  }
  .wait-graph__summary,
  .wait-graph__reason,
  .wait-graph__unknown {
    color: var(--color-text-secondary);
    margin: 0;
    overflow-wrap: anywhere;
  }
  .wait-graph__topology {
    display: grid;
    gap: var(--space-sm);
  }
  .wait-graph h3 {
    margin: var(--space-sm) 0 0;
  }
  .wait-graph__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-sm);
  }
  .wait-graph__record {
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
    padding: var(--space-md);
    display: grid;
    gap: var(--space-sm);
  }
  .wait-graph__meta,
  .wait-graph__relation,
  .wait-graph__upstreams {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .wait-graph__meta {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .wait-graph__node,
  .wait-graph__subject {
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
    padding: var(--space-xs) var(--space-sm);
    overflow-wrap: anywhere;
    max-width: 100%;
  }
  .wait-graph__subject {
    border-color: var(--color-primary);
    background: var(--el-color-primary-light-9);
  }
  .wait-graph__empty-node {
    color: var(--color-text-secondary);
  }
  .wait-graph__arrow {
    font-size: 1.25em;
  }
</style>
