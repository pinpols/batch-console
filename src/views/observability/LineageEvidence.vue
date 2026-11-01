<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button :icon="Refresh" :loading="loadingEvidence || loadingReadiness" @click="reload">
          {{ t('lineageEvidence.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="pill-tabs">
      <el-tab-pane :label="t('lineageEvidence.tabEvidence')" name="evidence">
        <ListPageQueryBar
          :filter-busy="loadingEvidence"
          :refresh-busy="loadingEvidence"
          :disabled="loadingEvidence"
          @search="loadEvidence"
          @reset="resetEvidence"
          @refresh="loadEvidence"
        >
          <el-form-item :label="t('lineageEvidence.queryMode')">
            <el-segmented v-model="evidenceMode" :options="evidenceModeOptions" />
          </el-form-item>
          <el-form-item
            v-if="evidenceMode === 'businessKey'"
            :label="t('lineageEvidence.businessKeyLabel')"
          >
            <el-input
              v-model="businessKey"
              class="query-w-320"
              clearable
              :placeholder="t('lineageEvidence.businessKeyPlaceholder')"
              @keyup.enter="loadEvidence"
            />
          </el-form-item>
          <el-form-item v-else :label="t('lineageEvidence.resultVersionIdLabel')">
            <el-input-number v-model="resultVersionId" :min="1" controls-position="right" />
          </el-form-item>
        </ListPageQueryBar>

        <div v-if="evidence" class="evidence-grid">
          <MetricCard
            :label="t('lineageEvidence.metricScope')"
            :value="evidence.coverage?.scope || '—'"
            :description="t('lineageEvidence.metricScopeDesc')"
          />
          <MetricCard
            :label="t('lineageEvidence.metricPipelines')"
            :value="String(evidence.coverage?.pipelineInstanceCount ?? 0)"
            :description="t('lineageEvidence.metricPipelinesDesc')"
          />
          <MetricCard
            :label="t('lineageEvidence.metricFiles')"
            :value="String(evidence.coverage?.fileRecordCount ?? 0)"
            :description="t('lineageEvidence.metricFilesDesc')"
          />
          <MetricCard
            :label="t('lineageEvidence.metricDispatches')"
            :value="String(evidence.coverage?.dispatchRecordCount ?? 0)"
            :description="t('lineageEvidence.metricDispatchesDesc')"
          />
        </div>

        <section v-if="evidence" class="lineage-section" aria-labelledby="lineage-summary-title">
          <h2 id="lineage-summary-title" class="lineage-section__header">
            {{ t('lineageEvidence.summaryTitle') }}
          </h2>
          <p class="lineage-summary__hint">{{ t('lineageEvidence.summaryHint') }}</p>
          <div class="lineage-summary">
            <article class="lineage-summary__card">
              <h3>{{ t('lineageEvidence.resultVersionTitle') }}</h3>
              <p>{{ t('lineageEvidence.recordId') }}: {{ evidence.resultVersion.id ?? '—' }}</p>
              <p>
                {{ t('lineageEvidence.businessKeyLabel') }}:
                {{ evidence.resultVersion.businessKey || '—' }}
              </p>
              <p>
                {{ t('lineageEvidence.versionNo') }}: {{ evidence.resultVersion.versionNo ?? '—' }}
              </p>
              <p>
                {{ t('lineageEvidence.jobInstanceId') }}:
                {{ evidence.resultVersion.jobInstanceId ?? '—' }}
              </p>
            </article>
            <article class="lineage-summary__card">
              <h3>{{ t('lineageEvidence.jobInstanceTitle') }}</h3>
              <template v-if="evidence.jobInstance">
                <p>{{ t('lineageEvidence.recordId') }}: {{ evidence.jobInstance.id ?? '—' }}</p>
                <p>
                  {{ t('lineageEvidence.jobCodeLabel') }}:
                  {{ evidence.jobInstance.job_code || '—' }}
                </p>
                <p>
                  {{ t('lineageEvidence.recordStatus') }}:
                  {{ evidence.jobInstance.instance_status || '—' }}
                </p>
                <p>
                  {{ t('lineageEvidence.relatedFileId') }}:
                  {{ evidence.jobInstance.related_file_id ?? '—' }}
                </p>
              </template>
              <p v-else>{{ t('lineageEvidence.recordUnavailable') }}</p>
            </article>
          </div>
          <div class="lineage-summary__groups">
            <section>
              <h3>{{ t('lineageEvidence.pipelineInstances') }}</h3>
              <p v-if="!evidence.pipelineInstances?.length">{{ t('common.noData') }}</p>
              <ul v-else>
                <li
                  v-for="(item, index) in evidence.pipelineInstances.slice(0, 3)"
                  :key="item.id ?? index"
                >
                  <strong>#{{ item.id ?? '—' }}</strong>
                  <span>{{ t('lineageEvidence.recordStatus') }}: {{ item.run_status || '—' }}</span>
                  <span
                    >{{ t('lineageEvidence.jobInstanceId') }}:
                    {{ item.related_job_instance_id ?? '—' }}</span
                  >
                  <span>{{ t('lineageEvidence.relatedFileId') }}: {{ item.file_id ?? '—' }}</span>
                </li>
              </ul>
              <p v-if="(evidence.pipelineInstances?.length ?? 0) > 3">
                {{
                  t('lineageEvidence.moreRecords', {
                    count: (evidence.pipelineInstances?.length ?? 0) - 3,
                  })
                }}
              </p>
            </section>
            <section>
              <h3>{{ t('lineageEvidence.fileRecords') }}</h3>
              <p v-if="!evidence.fileRecords?.length">{{ t('common.noData') }}</p>
              <ul v-else>
                <li
                  v-for="(item, index) in evidence.fileRecords.slice(0, 3)"
                  :key="item.id ?? index"
                >
                  <strong>#{{ item.id ?? '—' }}</strong>
                  <span>{{ t('lineageEvidence.fileName') }}: {{ item.file_name || '—' }}</span>
                  <span
                    >{{ t('lineageEvidence.recordStatus') }}: {{ item.file_status || '—' }}</span
                  >
                </li>
              </ul>
              <p v-if="(evidence.fileRecords?.length ?? 0) > 3">
                {{
                  t('lineageEvidence.moreRecords', {
                    count: (evidence.fileRecords?.length ?? 0) - 3,
                  })
                }}
              </p>
            </section>
            <section>
              <h3>{{ t('lineageEvidence.dispatchRecords') }}</h3>
              <p v-if="!evidence.dispatchRecords?.length">{{ t('common.noData') }}</p>
              <ul v-else>
                <li
                  v-for="(item, index) in evidence.dispatchRecords.slice(0, 3)"
                  :key="item.id ?? index"
                >
                  <strong>#{{ item.id ?? '—' }}</strong>
                  <span
                    >{{ t('lineageEvidence.recordStatus') }}:
                    {{ item.dispatch_status || '—' }}</span
                  >
                  <span>{{ t('lineageEvidence.relatedFileId') }}: {{ item.file_id ?? '—' }}</span>
                  <span
                    >{{ t('lineageEvidence.pipelineId') }}:
                    {{ item.pipeline_instance_id ?? '—' }}</span
                  >
                </li>
              </ul>
              <p v-if="(evidence.dispatchRecords?.length ?? 0) > 3">
                {{
                  t('lineageEvidence.moreRecords', {
                    count: (evidence.dispatchRecords?.length ?? 0) - 3,
                  })
                }}
              </p>
            </section>
          </div>
          <el-alert
            v-if="evidence.coverage?.knownGaps?.length"
            type="warning"
            :closable="false"
            show-icon
          >
            <template #title>{{ t('lineageEvidence.coverageGaps') }}</template>
            <ul>
              <li v-for="gap in evidence.coverage.knownGaps" :key="gap">{{ gap }}</li>
            </ul>
          </el-alert>
        </section>

        <LineageRelationExplorer v-if="evidence" :evidence="evidence" />

        <el-collapse v-if="evidence" class="lineage-section">
          <el-collapse-item :title="t('lineageEvidence.originalEvidence')" name="original">
            <h3 class="lineage-section__header">{{ t('lineageEvidence.resultVersionTitle') }}</h3>
            <JsonPreview :data="evidence.resultVersion || {}" />
            <h3 class="lineage-section__header">{{ t('lineageEvidence.jobInstanceTitle') }}</h3>
            <JsonPreview :data="evidence.jobInstance || {}" />
            <h3 class="lineage-section__header">{{ t('lineageEvidence.coverageTitle') }}</h3>
            <JsonPreview :data="evidence.coverage || {}" />
          </el-collapse-item>
        </el-collapse>

        <section v-if="evidence" class="lineage-section">
          <div class="lineage-section__header">{{ t('lineageEvidence.relatedRowsTitle') }}</div>
          <el-tabs v-model="relatedTab">
            <el-tab-pane :label="t('lineageEvidence.pipelineInstances')" name="pipelines">
              <GenericRowsTable :rows="evidence.pipelineInstances || []" />
            </el-tab-pane>
            <el-tab-pane :label="t('lineageEvidence.fileRecords')" name="files">
              <GenericRowsTable :rows="evidence.fileRecords || []" />
            </el-tab-pane>
            <el-tab-pane :label="t('lineageEvidence.dispatchRecords')" name="dispatches">
              <GenericRowsTable :rows="evidence.dispatchRecords || []" />
            </el-tab-pane>
          </el-tabs>
        </section>
      </el-tab-pane>

      <el-tab-pane :label="t('lineageEvidence.tabReadiness')" name="readiness">
        <ListPageQueryBar
          :filter-busy="loadingReadiness"
          :refresh-busy="loadingReadiness"
          :disabled="loadingReadiness"
          @search="loadReadiness"
          @reset="resetReadiness"
          @refresh="loadReadiness"
        >
          <el-form-item :label="t('lineageEvidence.jobCodeLabel')">
            <el-input
              v-model="readinessQuery.jobCode"
              class="query-w-260"
              clearable
              :placeholder="t('lineageEvidence.jobCodePlaceholder')"
              @keyup.enter="loadReadiness"
            />
          </el-form-item>
          <el-form-item :label="t('lineageEvidence.bizDateLabel')">
            <el-date-picker
              v-model="readinessQuery.bizDate"
              type="date"
              value-format="YYYY-MM-DD"
              :placeholder="t('lineageEvidence.bizDatePlaceholder')"
            />
          </el-form-item>
        </ListPageQueryBar>

        <section v-if="readiness" class="lineage-section">
          <div class="lineage-section__header readiness-header">
            <span>{{ t('lineageEvidence.readinessTitle') }}</span>
            <el-tag :type="readiness.ready ? 'success' : 'warning'" effect="plain">
              {{ readiness.ready ? t('common.yes') : t('common.no') }}
            </el-tag>
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item :label="t('lineageEvidence.reason')">
              {{ readiness.reason || '—' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('lineageEvidence.assetCode')">
              {{ readiness.assetCode || '—' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('lineageEvidence.partitionKey')">
              {{ readiness.partitionKey || '—' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('lineageEvidence.businessKeyLabel')">
              {{ readiness.businessKey || '—' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('lineageEvidence.freshnessStatus')">
              {{ readiness.freshnessStatus || '—' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('lineageEvidence.versionNo')">
              {{ readiness.versionNo ?? '—' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('lineageEvidence.jobInstanceId')">
              <router-link
                v-if="readiness.jobInstanceId"
                class="cell-link"
                :to="`/monitor/job-instances/${readiness.jobInstanceId}`"
              >
                #{{ readiness.jobInstanceId }}
              </router-link>
              <span v-else>—</span>
            </el-descriptions-item>
            <el-descriptions-item :label="t('lineageEvidence.payloadRef')">
              {{ readiness.payloadRef || '—' }}
            </el-descriptions-item>
          </el-descriptions>
        </section>
      </el-tab-pane>
    </el-tabs>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, defineComponent, h, reactive, ref, watch, type PropType } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElTable, ElTableColumn } from 'element-plus'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import {
    getAssetPartitionReadiness,
    getLineageEvidenceByBusinessKey,
    getLineageEvidenceByResultVersion,
    type AssetPartitionReadiness,
    type LineageEvidence,
  } from '@/api/lineage'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import LineageRelationExplorer from './LineageRelationExplorer.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { todayBusinessDate } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const evidenceScope = useTenantRequestScope()
  const readinessScope = useTenantRequestScope()
  const activeTab = ref<'evidence' | 'readiness'>('evidence')
  const relatedTab = ref<'pipelines' | 'files' | 'dispatches'>('pipelines')
  const evidenceMode = ref<'businessKey' | 'resultVersion'>('businessKey')
  const businessKey = ref('')
  const resultVersionId = ref<number | undefined>(undefined)
  const evidence = ref<LineageEvidence | null>(null)
  const loadingEvidence = ref(false)

  const readinessQuery = reactive({
    jobCode: '',
    bizDate: todayBusinessDate(),
  })
  const readiness = ref<AssetPartitionReadiness | null>(null)
  const loadingReadiness = ref(false)

  const evidenceModeOptions = computed(() => [
    { label: t('lineageEvidence.modeBusinessKey'), value: 'businessKey' },
    { label: t('lineageEvidence.modeResultVersion'), value: 'resultVersion' },
  ])

  async function loadEvidence() {
    if (evidenceMode.value === 'businessKey' && !businessKey.value.trim()) {
      ElMessage.warning(t('lineageEvidence.businessKeyRequired'))
      return
    }
    if (evidenceMode.value === 'resultVersion' && !resultVersionId.value) {
      ElMessage.warning(t('lineageEvidence.resultVersionRequired'))
      return
    }
    const scope = evidenceScope.begin()
    if (!scope.tenantId) return
    loadingEvidence.value = true
    try {
      const response =
        evidenceMode.value === 'businessKey'
          ? await getLineageEvidenceByBusinessKey(businessKey.value.trim(), scope.tenantId)
          : await getLineageEvidenceByResultVersion(resultVersionId.value as number, scope.tenantId)
      if (!evidenceScope.isCurrent(scope)) return
      evidence.value = response
      ElMessage.success(t('lineageEvidence.loadOk'))
    } catch (error) {
      if (!evidenceScope.isCurrent(scope)) return
      throw error
    } finally {
      if (evidenceScope.isCurrent(scope)) loadingEvidence.value = false
    }
  }

  function resetEvidence() {
    evidenceScope.begin()
    loadingEvidence.value = false
    businessKey.value = ''
    resultVersionId.value = undefined
    evidence.value = null
  }

  async function loadReadiness() {
    if (!readinessQuery.jobCode.trim() || !readinessQuery.bizDate) {
      ElMessage.warning(t('lineageEvidence.readinessRequired'))
      return
    }
    const scope = readinessScope.begin()
    if (!scope.tenantId) return
    loadingReadiness.value = true
    try {
      const response = await getAssetPartitionReadiness({
        tenantId: scope.tenantId,
        jobCode: readinessQuery.jobCode.trim(),
        bizDate: readinessQuery.bizDate,
      })
      if (!readinessScope.isCurrent(scope)) return
      readiness.value = response
      ElMessage.success(t('lineageEvidence.loadOk'))
    } catch (error) {
      if (!readinessScope.isCurrent(scope)) return
      throw error
    } finally {
      if (readinessScope.isCurrent(scope)) loadingReadiness.value = false
    }
  }

  function resetReadiness() {
    readinessScope.begin()
    loadingReadiness.value = false
    readinessQuery.jobCode = ''
    readinessQuery.bizDate = todayBusinessDate()
    readiness.value = null
  }

  function reload() {
    if (activeTab.value === 'readiness') void loadReadiness()
    else void loadEvidence()
  }

  watch(
    [evidenceMode, businessKey, resultVersionId],
    () => {
      evidenceScope.begin()
      loadingEvidence.value = false
      evidence.value = null
    },
    { flush: 'sync' },
  )
  watch(
    [() => readinessQuery.jobCode, () => readinessQuery.bizDate],
    () => {
      readinessScope.begin()
      loadingReadiness.value = false
      readiness.value = null
    },
    { flush: 'sync' },
  )
  useTenantReload(() => {
    evidenceScope.begin()
    readinessScope.begin()
    loadingEvidence.value = false
    loadingReadiness.value = false
    evidence.value = null
    readiness.value = null
  })

  function formatGenericCell(value: unknown): string {
    if (value == null || value === '') return '—'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const GenericRowsTable = defineComponent({
    name: 'GenericRowsTable',
    props: {
      rows: {
        type: Array as PropType<Record<string, unknown>[]>,
        required: true,
      },
    },
    setup(props) {
      const columns = computed(() => {
        const keys = new Set<string>()
        for (const row of props.rows.slice(0, 10)) {
          for (const key of Object.keys(row)) keys.add(key)
        }
        return [...keys].slice(0, 8)
      })
      return () =>
        h(
          ElTable,
          {
            data: props.rows,
            border: true,
            stripe: true,
            size: 'small',
            class: 'console-table generic-el-table',
            emptyText: t('common.noData'),
          },
          () =>
            columns.value.map((key) =>
              h(
                ElTableColumn,
                {
                  key,
                  label: key,
                  minWidth: 160,
                  showOverflowTooltip: true,
                },
                {
                  default: ({ row }: { row: Record<string, unknown> }) =>
                    formatGenericCell(row[key]),
                },
              ),
            ),
        )
    },
  })
</script>

<style scoped>
  .evidence-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-md);
    margin-top: var(--page-block-gap);
  }

  .lineage-section {
    margin-top: var(--page-block-gap);
  }

  .lineage-section__header {
    margin-bottom: var(--space-sm);
    color: var(--color-text-primary);
    font-size: 13px;
    font-weight: 650;
  }

  .lineage-summary__hint {
    color: var(--color-text-secondary);
  }
  .lineage-summary,
  .lineage-summary__groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: var(--space-md);
    margin: var(--space-md) 0;
  }
  .lineage-summary__card,
  .lineage-summary__groups section {
    padding: var(--space-md);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    overflow-wrap: anywhere;
  }
  .lineage-summary h3,
  .lineage-summary__groups h3 {
    margin: 0 0 var(--space-sm);
    font-size: 14px;
  }
  .lineage-summary p,
  .lineage-summary__groups p {
    margin: var(--space-xs) 0;
  }
  .lineage-summary__groups ul {
    padding: 0;
    margin: 0;
    list-style: none;
  }
  .lineage-summary__groups li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--color-border-light);
  }
  .lineage-summary__groups li:last-child {
    border-bottom: 0;
  }

  .readiness-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .generic-el-table {
    width: 100%;
  }

  @media (max-width: 1080px) {
    .evidence-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
