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

        <section v-if="evidence" class="lineage-section">
          <div class="lineage-section__header">{{ t('lineageEvidence.resultVersionTitle') }}</div>
          <JsonPreview :data="evidence.resultVersion || {}" />
        </section>

        <section v-if="evidence" class="lineage-section">
          <div class="lineage-section__header">{{ t('lineageEvidence.jobInstanceTitle') }}</div>
          <JsonPreview :data="evidence.jobInstance || {}" />
        </section>

        <section v-if="evidence" class="lineage-section">
          <div class="lineage-section__header">{{ t('lineageEvidence.coverageTitle') }}</div>
          <JsonPreview :data="evidence.coverage || {}" />
        </section>

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
  import { computed, defineComponent, h, reactive, ref, type PropType } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElTable, ElTableColumn } from 'element-plus'
  import { RefreshCw as Refresh } from 'lucide-vue-next'
  import {
    getAssetPartitionReadiness,
    getLineageEvidenceByBusinessKey,
    getLineageEvidenceByResultVersion,
    type AssetPartitionReadiness,
    type LineageEvidence,
  } from '@/api/lineage'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const activeTab = ref<'evidence' | 'readiness'>('evidence')
  const relatedTab = ref<'pipelines' | 'files' | 'dispatches'>('pipelines')
  const evidenceMode = ref<'businessKey' | 'resultVersion'>('businessKey')
  const businessKey = ref('')
  const resultVersionId = ref<number | undefined>(undefined)
  const evidence = ref<LineageEvidence | null>(null)
  const loadingEvidence = ref(false)

  const readinessQuery = reactive({
    jobCode: '',
    bizDate: new Date().toISOString().slice(0, 10),
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
    loadingEvidence.value = true
    try {
      evidence.value =
        evidenceMode.value === 'businessKey'
          ? await getLineageEvidenceByBusinessKey(businessKey.value.trim(), tenant.tenantId)
          : await getLineageEvidenceByResultVersion(
              resultVersionId.value as number,
              tenant.tenantId,
            )
      ElMessage.success(t('lineageEvidence.loadOk'))
    } finally {
      loadingEvidence.value = false
    }
  }

  function resetEvidence() {
    businessKey.value = ''
    resultVersionId.value = undefined
    evidence.value = null
  }

  async function loadReadiness() {
    if (!readinessQuery.jobCode.trim() || !readinessQuery.bizDate) {
      ElMessage.warning(t('lineageEvidence.readinessRequired'))
      return
    }
    loadingReadiness.value = true
    try {
      readiness.value = await getAssetPartitionReadiness({
        tenantId: tenant.tenantId,
        jobCode: readinessQuery.jobCode.trim(),
        bizDate: readinessQuery.bizDate,
      })
      ElMessage.success(t('lineageEvidence.loadOk'))
    } finally {
      loadingReadiness.value = false
    }
  }

  function resetReadiness() {
    readinessQuery.jobCode = ''
    readinessQuery.bizDate = new Date().toISOString().slice(0, 10)
    readiness.value = null
  }

  function reload() {
    if (activeTab.value === 'readiness') void loadReadiness()
    else void loadEvidence()
  }

  useTenantReload(() => {
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
