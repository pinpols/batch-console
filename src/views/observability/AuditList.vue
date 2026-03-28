<template>
  <PageContainer>
    <PageHeader title="审计日志" description="GET /api/console/query/audits" />
    <SectionCard>
      <EmptyState description="TODO: ProTable + traceId 展示" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>
