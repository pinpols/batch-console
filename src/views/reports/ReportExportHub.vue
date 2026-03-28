<template>
  <PageContainer>
    <PageHeader
      title="报表导出"
      description="GET /api/console/reports/excel/* — 仅导出，无 upload/preview/apply"
    />
    <SectionCard>
      <el-space wrap>
        <el-button v-for="r in reports" :key="r.key" @click="hint(r)">{{ r.label }}</el-button>
      </el-space>
      <EmptyState class="mt" description="TODO: 直连下载 blob + 文件名" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'

  const reports = [
    { key: 'config-releases', label: 'config-releases' },
    { key: 'audits', label: 'audits' },
    { key: 'scheduler-snapshot', label: 'scheduler-snapshot' },
    { key: 'workers', label: 'workers' },
  ]

  function hint(r: { key: string; label: string }) {
    ElMessage.info(`对接 GET /api/console/reports/excel/${r.key}（需 tenantId 等 query）`)
  }
</script>

<style scoped>
  .mt {
    margin-top: var(--space-lg);
  }
</style>
