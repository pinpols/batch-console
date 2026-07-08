<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-switch
          v-model="autoRefreshOn"
          :active-text="t('workerFingerprintBoard.autoRefreshOn')"
          :inactive-text="t('workerFingerprintBoard.autoRefreshOff')"
          inline-prompt
        />
        <el-button :icon="Refresh" :loading="loading" @click="load">
          {{ t('common.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <template #header>
        <div class="wfb__header">
          <HelpLabel :tip="t('workerFingerprintBoard.fingerprintTermTip')">
            {{ t('workerFingerprintBoard.summaryTitle') }}
          </HelpLabel>
          <el-tag size="small" type="info" effect="plain">
            {{ t('workerFingerprintBoard.summaryTotalOnline', { n: totalOnline }) }}
          </el-tag>
        </div>
      </template>

      <!-- 去掉常驻大说明条(密度):同样信息已在标题 HelpLabel 的悬浮提示里 -->
      <el-alert
        v-if="summaryError"
        type="error"
        :closable="false"
        show-icon
        class="wfb__intro"
        :title="t('workerFingerprintBoard.summaryLoadError')"
      />

      <EmptyState
        v-else-if="!loading && summary.length === 0"
        :description="t('workerFingerprintBoard.summaryEmpty')"
        :image-size="60"
      />

      <div v-else class="wfb__cards">
        <div v-for="item in summary" :key="`${item.buildId}__${item.sdkVersion}`" class="wfb__card">
          <div class="wfb__card-head">
            <el-tag size="small" effect="plain" type="primary">{{ item.buildId }}</el-tag>
            <el-tag size="small" effect="plain">SDK {{ item.sdkVersion }}</el-tag>
          </div>
          <div class="wfb__card-count">{{ item.count }}</div>
          <div class="wfb__card-meta">
            <span>{{ t('workerFingerprintBoard.cardWorkers') }}</span>
            <span class="wfb__card-pct">{{ percentOf(item.count) }}</span>
          </div>
          <el-progress
            :percentage="rawPercentOf(item.count)"
            :show-text="false"
            :stroke-width="6"
          />
        </div>
      </div>
    </SectionCard>

    <SectionCard>
      <template #header>
        <div class="wfb__header">
          <span>{{ t('workerFingerprintBoard.listTitle') }}</span>
          <el-tag size="small" type="info" effect="plain">
            {{ t('workerFingerprintBoard.listTotal', { n: rows.length }) }}
          </el-tag>
        </div>
      </template>

      <ProTable
        :data="rows"
        :loading="loading"
        :total="rows.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :error="loadError"
        :on-retry="load"
      >
        <template #empty>
          <EmptyState :description="t('workerFingerprintBoard.listEmpty')" :image-size="80" />
        </template>

        <el-table-column
          prop="workerCode"
          :label="t('workerFingerprintBoard.colWorkerCode')"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column :label="t('workerFingerprintBoard.colStatus')" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)" effect="plain">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="buildId" min-width="160" show-overflow-tooltip>
          <template #header>
            <HelpLabel :tip="t('workerFingerprintBoard.colBuildIdTip')">
              {{ t('workerFingerprintBoard.colBuildId') }}
            </HelpLabel>
          </template>
          <template #default="{ row }">
            <span v-if="row.buildId">{{ row.buildId }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="sdkVersion"
          :label="t('workerFingerprintBoard.colSdkVersion')"
          width="140"
        >
          <template #default="{ row }">
            <span v-if="row.sdkVersion">{{ row.sdkVersion }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="processId" :label="t('workerFingerprintBoard.colPid')" width="120">
          <template #default="{ row }">
            <span v-if="row.processId">{{ row.processId }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('workerFingerprintBoard.colHeartbeatAt')" width="180">
          <template #default="{ row }">{{ fmtDatetime(row.heartbeatAt) }}</template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RefreshCw as Refresh } from 'lucide-vue-next'
  import { ElMessage } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantStore } from '@/stores/tenant'
  import { useAutoRefresh } from '@/composables/useAutoRefresh'
  import {
    listWorkerFingerprints,
    getWorkerFingerprintSummary,
    type WorkerFingerprint,
    type WorkerFingerprintSummary,
  } from '@/api/workerFingerprint'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  const rows = ref<WorkerFingerprint[]>([])
  const summary = ref<WorkerFingerprintSummary[]>([])
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const summaryError = ref<unknown>(null)
  const page = ref(1)
  const pageSize = ref(15)
  const autoRefreshOn = ref(false)

  const totalOnline = computed(() =>
    summary.value.reduce((sum, item) => sum + (item.count ?? 0), 0),
  )

  function rawPercentOf(count: number): number {
    const total = totalOnline.value
    if (total <= 0) return 0
    const v = Math.round((count / total) * 100)
    return Math.max(0, Math.min(100, v))
  }

  function percentOf(count: number): string {
    return `${rawPercentOf(count)}%`
  }

  function statusTagType(status: string): 'success' | 'warning' | 'info' | 'danger' {
    switch (status) {
      case 'ONLINE':
        return 'success'
      case 'DRAINING':
        return 'warning'
      case 'OFFLINE':
        return 'info'
      case 'DECOMMISSIONED':
        return 'danger'
      default:
        return 'info'
    }
  }

  async function load() {
    loading.value = true
    loadError.value = null
    summaryError.value = null
    // 这两个端点 tenantId 是 @RequestParam(query 必填),必须显式带,否则 BE 400「租户参数缺失」
    const [listRes, summaryRes] = await Promise.allSettled([
      listWorkerFingerprints(tenant.tenantId),
      getWorkerFingerprintSummary(tenant.tenantId),
    ])
    if (listRes.status === 'fulfilled') {
      rows.value = listRes.value ?? []
    } else {
      loadError.value = listRes.reason
      rows.value = []
      ElMessage.error(t('workerFingerprintBoard.loadError'))
    }
    if (summaryRes.status === 'fulfilled') {
      summary.value = summaryRes.value ?? []
    } else {
      summaryError.value = summaryRes.reason
      summary.value = []
    }
    loading.value = false
  }

  useTenantReload(load)

  // 10s 周期性刷新,通过 autoRefreshOn 开关本地 gating;
  // useAutoRefresh 自带页面隐藏自动暂停,无需手动管理 visibility。
  useAutoRefresh(() => {
    if (!autoRefreshOn.value) return
    // 与 useTenantReload 同样的空租户守卫:admin 尚未选租户时 tenant.tenantId 为空,
    // 直接 load() 会向 BE 发不带 tenantId 的请求被拒为 400「租户参数缺失」。
    // useAutoRefresh 不经 useTenantReload,需在此自行 gating。
    if (!tenant.tenantId) return
    void load()
  }, 10_000)
</script>

<style scoped>
  .wfb__header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .wfb__intro {
    margin-bottom: var(--space-md, 16px);
  }

  .wfb__cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-md, 16px);
  }

  .wfb__card {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs, 8px);
    padding: var(--space-md, 16px);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content, 8px);
    background: var(--color-bg-subtle, var(--el-fill-color-light));
  }

  .wfb__card-head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs, 6px);
  }

  .wfb__card-count {
    font-size: var(--font-size-xxl, 24px);
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .wfb__card-meta {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-sm, 12px);
    color: var(--color-text-secondary);
  }

  .wfb__card-pct {
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .muted {
    color: var(--color-text-tertiary);
  }
</style>
