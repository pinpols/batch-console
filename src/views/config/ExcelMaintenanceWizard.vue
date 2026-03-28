<template>
  <PageContainer>
    <PageHeader :title="title" description="upload → preview → apply → export（见设计文档 §10.8）" />
    <SectionCard>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="域参数">{{ domain }}</el-descriptions-item>
        <el-descriptions-item label="Export">{{ exportPath }}</el-descriptions-item>
        <el-descriptions-item label="Upload">{{ uploadPath }}</el-descriptions-item>
      </el-descriptions>
      <EmptyState class="mt" description="TODO: 分步表单向导 + 校验结果表格" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'

  const route = useRoute()
  const domain = computed(() => (route.params.domain as string) || '')

  const title = computed(() => `Excel 维护 — ${domain.value || '…'}`)

  const base = computed(() => {
    const d = domain.value
    if (d === 'file-templates') return '/api/console/config/file-templates/excel'
    if (d === 'file-channels') return '/api/console/config/file-channels/excel'
    if (d === 'workflows') return '/api/console/config/workflows/excel'
    if (d === 'job-definitions') return '/api/console/config/job-definitions/excel'
    return '(未知域)'
  })

  const exportPath = computed(() => `${base.value}/export`)
  const uploadPath = computed(() => `${base.value}/upload`)
</script>

<style scoped>
  .mt {
    margin-top: var(--space-lg);
  }
</style>
