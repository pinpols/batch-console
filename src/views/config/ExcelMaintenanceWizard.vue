<template>
  <PageContainer class="excel-center-page">
    <PageHeader :title="t('excelMaintenanceWizard.titleBase')" compact>
      <template #actions>
        <el-button type="primary" plain @click="goTenantPackage"> 配置包导入 </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <div class="excel-center">
        <div class="excel-center__toolbar">
          <el-segmented v-model="activeDomain" :options="domainOptions" />
        </div>

        <el-table
          class="console-table"
          :data="visibleRows"
          border
          stripe
          :empty-text="t('common.noData')"
        >
          <el-table-column prop="label" label="配置项" min-width="180" />
          <el-table-column prop="domain" label="Domain" min-width="180" />
          <el-table-column :label="t('common.actions')" width="260" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                plain
                :loading="loadingKey === `${row.domain}:template`"
                @click="downloadTemplate(row.domain)"
              >
                {{ t('excelMaintenanceWizard.btnDownloadTemplate') }}
              </el-button>
              <el-button
                :loading="loadingKey === `${row.domain}:export`"
                @click="exportCurrent(row.domain)"
              >
                {{ t('excelMaintenanceWizard.btnExportCurrent') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import {
    excelDownloadTemplate,
    excelExport,
    EXCEL_TEMPLATE_EXPORT_DOMAINS,
    type ExcelDomain,
  } from '@/api/excelDomains'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const loadingKey = ref('')

  const domainLabels = computed<Record<ExcelDomain, string>>(() => ({
    'file-templates': t('excelMaintenanceWizard.domFileTemplates'),
    'file-channels': t('excelMaintenanceWizard.domFileChannels'),
    workflows: t('excelMaintenanceWizard.domWorkflows'),
    'job-definitions': t('excelMaintenanceWizard.domJobDefinitions'),
    'alert-routings': t('excelMaintenanceWizard.domAlertRoutings'),
    'batch-windows': t('excelMaintenanceWizard.domBatchWindows'),
    'business-calendars': t('excelMaintenanceWizard.domBusinessCalendars'),
    'pipeline-definitions': t('excelMaintenanceWizard.domPipelineDefinitions'),
    'quota-policies': t('excelMaintenanceWizard.domQuotaPolicies'),
    'resource-queues': t('excelMaintenanceWizard.domResourceQueues'),
  }))

  const domainRows = computed(() =>
    EXCEL_TEMPLATE_EXPORT_DOMAINS.map((domain) => ({
      domain,
      label: domainLabels.value[domain],
    })),
  )
  const allValue = 'all'
  const domainOptions = computed(() => [
    { label: t('common.all'), value: allValue },
    ...domainRows.value.map((row) => ({ label: row.label, value: row.domain })),
  ])

  const routeDomain = computed(() =>
    typeof route.query.domain === 'string' ? route.query.domain : allValue,
  )
  const activeDomain = ref(routeDomain.value)
  const visibleRows = computed(() =>
    activeDomain.value === allValue
      ? domainRows.value
      : domainRows.value.filter((row) => row.domain === activeDomain.value),
  )

  watch(routeDomain, (domain) => {
    activeDomain.value = domain
  })
  watch(activeDomain, (domain) => {
    void router.replace({
      path: '/config/excel',
      query: domain === allValue ? {} : { ...route.query, domain },
    })
  })

  async function downloadTemplate(domain: ExcelDomain) {
    loadingKey.value = `${domain}:template`
    try {
      triggerBlobDownload(await excelDownloadTemplate(domain), `${domain}-template.xlsx`)
      ElMessage.success(t('excelMaintenanceWizard.templateDownloadedToast'))
    } finally {
      loadingKey.value = ''
    }
  }

  async function exportCurrent(domain: ExcelDomain) {
    loadingKey.value = `${domain}:export`
    try {
      triggerBlobDownload(await excelExport(domain), `${domain}-export.xlsx`)
      ElMessage.success(t('excelMaintenanceWizard.exportedToast'))
    } finally {
      loadingKey.value = ''
    }
  }

  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function goTenantPackage() {
    void router.push('/config/tenant-package')
  }
</script>

<style scoped>
  .excel-center {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .excel-center__toolbar {
    overflow-x: auto;
    padding-bottom: 2px;
  }
</style>
