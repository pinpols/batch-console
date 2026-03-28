<template>
  <PageContainer>
    <PageHeader title="Workflow Run 列表" description="GET /api/console/query/workflow-runs" />
    <SectionCard>
      <EmptyState description="TODO: ProTable + 跳转详情" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>
