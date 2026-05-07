<template>
  <PageContainer>
    <PageHeader title="报表中心" description="一键导出常用报表（Excel），请求将携带 tenantId">
      <template #actions>
        <div class="header-actions">
          <el-tag type="info" effect="plain">tenant: {{ tenant.tenantId }}</el-tag>
          <el-button size="small" plain @click="copyTenant">复制</el-button>
        </div>
      </template>
    </PageHeader>

    <SectionCard class="export-hub-card">
      <template #header>
        <div class="card-header">
          <div>
            <div class="card-title">可导出的报表</div>
            <div class="card-subtitle">支持搜索，点击卡片即可开始下载</div>
          </div>
          <el-input v-model="keyword" placeholder="搜索报表名称…" clearable class="search" />
        </div>
      </template>

      <div class="grid">
        <button
          v-for="r in filteredReports"
          :key="r.key"
          class="report-card"
          type="button"
          :disabled="loadingKey !== ''"
          @click="downloadOne(r)"
        >
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
              :loading="loadingKey === r.key"
              @click.stop="downloadOne(r)"
            >
              下载
            </el-button>
            <div class="report-card__file">{{ r.file }}</div>
          </div>
        </button>
      </div>

      <el-empty
        v-if="filteredReports.length === 0"
        description="没有匹配的报表"
        :image-size="72"
        class="empty"
      />

      <p class="hint">
        提示：若后端返回 JSON 错误而非 xlsx，浏览器可能无法打开文件；以 Network 与 traceId 为准。
      </p>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { ElMessage } from 'element-plus'
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

  const reports: ReportCard[] = [
    {
      key: 'config-releases',
      label: '配置发布',
      desc: '配置发布记录与生效区间',
      file: 'config-releases.xlsx',
      badge: '配置',
    },
    {
      key: 'secrets',
      label: 'Secrets',
      desc: '密钥版本与轮转窗口',
      file: 'secrets.xlsx',
      badge: '配置',
    },
    {
      key: 'change-logs',
      label: '变更记录',
      desc: '关键配置与治理项变更流水',
      file: 'change-logs.xlsx',
    },
    {
      key: 'audits',
      label: '审计',
      desc: '重要操作与权限相关审计',
      file: 'audits.xlsx',
      badge: '审计',
    },
    {
      key: 'scheduler-snapshot',
      label: '调度快照',
      desc: '当前调度策略、队列与窗口快照',
      file: 'scheduler-snapshot.xlsx',
      badge: '调度',
    },
    {
      key: 'scheduler-history',
      label: '调度历史',
      desc: '调度快照历史，用于回溯对比',
      file: 'scheduler-history.xlsx',
      badge: '调度',
    },
    {
      key: 'workers',
      label: 'Workers',
      desc: 'Worker 注册与运行状态',
      file: 'workers.xlsx',
      badge: '运行',
    },
    {
      key: 'outbox-retries',
      label: 'Outbox 重试',
      desc: '投递失败重试记录',
      file: 'outbox-retries.xlsx',
      badge: '观测',
    },
    {
      key: 'outbox-deliveries',
      label: 'Outbox 投递',
      desc: '投递日志与下游响应',
      file: 'outbox-deliveries.xlsx',
      badge: '观测',
    },
  ]

  const filteredReports = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return reports
    return reports.filter((r) => {
      const hay = `${r.label} ${r.desc} ${r.file} ${r.badge ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  async function downloadOne(r: { key: ReportExcelKey; file: string }) {
    loadingKey.value = r.key
    try {
      await downloadReportExcel(r.key, { tenantId: tenant.tenantId }, r.file)
      ElMessage.success('已开始下载')
    } catch {
      ElMessage.error('下载失败（参见控制台与 traceId）')
    } finally {
      loadingKey.value = ''
    }
  }

  async function copyTenant() {
    try {
      await navigator.clipboard.writeText(tenant.tenantId)
      ElMessage.success('已复制 tenantId')
    } catch {
      ElMessage.error('复制失败')
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
    appearance: none;
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    border-radius: var(--radius-card-lg);
    padding: var(--card-inner-padding);
    min-height: 108px;
    box-shadow: 0 1px 0 rgb(0 0 0 / 2%);
    text-align: left;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    cursor: pointer;
    transition:
      transform 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease,
      background 120ms ease;
  }

  .report-card:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-border) 70%, var(--color-primary) 30%);
    box-shadow:
      0 8px 18px rgb(15 23 42 / 8%),
      var(--surface-hover-edge-inset);
  }

  .report-card:disabled {
    cursor: not-allowed;
    opacity: 0.78;
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
