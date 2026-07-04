<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <div class="header-actions">
          <el-tag type="info" effect="plain">
            {{ t('reportExportHub.tenantTagPrefix', { id: tenant.tenantId }) }}
          </el-tag>
          <el-button size="small" plain @click="copyTenant">
            {{ t('reportExportHub.btnCopy') }}
          </el-button>
        </div>
      </template>
    </PageHeader>

    <SectionCard class="export-hub-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">{{ t('reportExportHub.cardTitle') }}</div>
            <div class="card-subtitle">{{ t('reportExportHub.cardSubtitle') }}</div>
          </div>
          <el-input
            v-model="keyword"
            :placeholder="t('reportExportHub.searchPlaceholder')"
            clearable
            class="search"
          />
        </div>
      </template>

      <div class="grid">
        <article v-for="r in filteredReports" :key="r.key" class="report-card">
          <div class="report-card__main">
            <div class="report-card__title">
              {{ r.label }}
              <el-tag v-if="r.badge" size="small" effect="plain" :type="r.badgeType ?? 'info'">
                {{ r.badge }}
              </el-tag>
            </div>
            <div class="report-card__meta">{{ r.desc }}</div>
          </div>
          <div class="report-card__aside">
            <el-button
              type="primary"
              plain
              size="small"
              :icon="Download"
              :loading="loadingKey === r.key"
              :disabled="loadingKey !== ''"
              @click="downloadOne(r)"
            >
              {{ t('reportExportHub.btnDownload') }}
            </el-button>
            <div class="report-card__file">{{ r.file }}</div>
          </div>
        </article>
      </div>

      <el-empty
        v-if="filteredReports.length === 0"
        :description="t('reportExportHub.emptyDesc')"
        :image-size="72"
        class="empty"
      />

      <p class="hint">{{ t('reportExportHub.hintText') }}</p>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Download } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })
  import { downloadReportExcel, type ReportExcelKey } from '@/api/reports'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
  const loadingKey = ref<ReportExcelKey | ''>('')

  const keyword = ref('')

  type ReportCard = {
    key: ReportExcelKey
    label: string
    desc: string
    file: string
    badge?: string
    badgeType?: 'success' | 'warning' | 'danger' | 'info'
  }

  const reports = computed<ReportCard[]>(() => [
    {
      key: 'config-releases',
      label: t('reportExportHub.labelConfigReleases'),
      desc: t('reportExportHub.descConfigReleases'),
      file: 'config-releases.xlsx',
      badge: t('reportExportHub.badgeConfig'),
    },
    {
      key: 'secrets',
      label: t('reportExportHub.labelSecrets'),
      desc: t('reportExportHub.descSecrets'),
      file: 'secrets.xlsx',
      badge: t('reportExportHub.badgeConfig'),
    },
    {
      key: 'change-logs',
      label: t('reportExportHub.labelChangeLogs'),
      desc: t('reportExportHub.descChangeLogs'),
      file: 'change-logs.xlsx',
    },
    {
      key: 'audits',
      label: t('reportExportHub.labelAudits'),
      desc: t('reportExportHub.descAudits'),
      file: 'audits.xlsx',
      badge: t('reportExportHub.badgeAudit'),
    },
    {
      key: 'scheduler-snapshot',
      label: t('reportExportHub.labelSchedulerSnapshot'),
      desc: t('reportExportHub.descSchedulerSnapshot'),
      file: 'scheduler-snapshot.xlsx',
      badge: t('reportExportHub.badgeSchedule'),
    },
    {
      key: 'scheduler-history',
      label: t('reportExportHub.labelSchedulerHistory'),
      desc: t('reportExportHub.descSchedulerHistory'),
      file: 'scheduler-history.xlsx',
      badge: t('reportExportHub.badgeSchedule'),
    },
    {
      key: 'workers',
      label: t('reportExportHub.labelWorkers'),
      desc: t('reportExportHub.descWorkers'),
      file: 'workers.xlsx',
      badge: t('reportExportHub.badgeRuntime'),
    },
    {
      key: 'outbox-retries',
      label: t('reportExportHub.labelOutboxRetries'),
      desc: t('reportExportHub.descOutboxRetries'),
      file: 'outbox-retries.xlsx',
      badge: t('reportExportHub.badgeObservability'),
    },
    {
      key: 'outbox-deliveries',
      label: t('reportExportHub.labelOutboxDeliveries'),
      desc: t('reportExportHub.descOutboxDeliveries'),
      file: 'outbox-deliveries.xlsx',
      badge: t('reportExportHub.badgeObservability'),
    },
  ])

  const filteredReports = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return reports.value
    return reports.value.filter((r) => {
      const hay = `${r.label} ${r.desc} ${r.file} ${r.badge ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  async function downloadOne(r: { key: ReportExcelKey; file: string }) {
    loadingKey.value = r.key
    try {
      await downloadReportExcel(r.key, { tenantId: tenant.tenantId }, r.file)
      ElMessage.success(t('reportExportHub.downloadStartedToast'))
    } catch {
      ElMessage.error(t('reportExportHub.downloadFailedToast'))
    } finally {
      loadingKey.value = ''
    }
  }

  async function copyTenant() {
    try {
      await navigator.clipboard.writeText(tenant.tenantId)
      ElMessage.success(t('reportExportHub.tenantCopiedToast'))
    } catch {
      ElMessage.error(t('reportExportHub.copyFailedToast'))
    }
  }
</script>

<style scoped>
  .export-hub-card :deep(.el-card__header) {
    padding-bottom: 14px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
    width: 100%;
    min-width: 0;
  }

  .card-header > div:first-child {
    flex: 1 1 200px;
    min-width: 0;
  }

  .card-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--color-text-primary);
  }

  .card-subtitle {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-tertiary);
  }

  .search {
    flex: 0 1 360px;
    width: min(360px, 100%);
    min-width: 200px;
    margin-left: auto;
  }

  .grid {
    margin-top: 2px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--page-block-gap);
    align-items: stretch;
  }

  .report-card {
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    border-radius: var(--radius-card-lg);
    padding: var(--card-inner-padding);
    min-height: 108px;
    box-shadow:
      0 1px 0 rgb(0 0 0 / 2%),
      0 8px 18px rgb(15 23 42 / 4%);
    text-align: left;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    transition:
      transform 140ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease,
      background 120ms ease;
    will-change: transform;
  }

  .report-card:hover,
  .report-card:focus-within {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--color-border) 74%, var(--color-primary) 26%);
    background: var(--color-bg-card);
    box-shadow:
      0 1px 0 rgb(0 0 0 / 2%),
      0 14px 28px rgb(15 23 42 / 11%),
      var(--surface-hover-edge-inset);
  }

  .report-card__main {
    flex: 1;
    min-width: 0;
  }

  .report-card__title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 15px;
    font-weight: 650;
    color: var(--color-text-primary);
    line-height: 1.4;
  }

  .report-card__meta {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .report-card__aside {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    flex-shrink: 0;
  }

  .report-card__file {
    font-size: 11px;
    color: var(--color-text-tertiary);
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: 12px 0 4px;
  }

  .hint {
    margin-top: var(--page-section-gap);
    padding-top: 14px;
    border-top: 1px solid var(--color-border-light);
    font-size: 12px;
    line-height: 1.55;
    color: var(--color-text-tertiary);
  }

  @media (max-width: 1100px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .grid {
      grid-template-columns: 1fr;
    }
    .report-card__file {
      max-width: 140px;
    }
  }
</style>
