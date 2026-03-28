<template>
  <PageContainer>
    <PageHeader
      title="Job Step Instance"
      description="GET /api/console/query/job-step-instances — 分片/步骤级下钻（原 Partition 语义）"
    />
    <SectionCard>
      <EmptyState description="TODO: 按 jobInstanceId 筛选 + Table V2" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>
