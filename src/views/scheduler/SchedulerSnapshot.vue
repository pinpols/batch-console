<template>
  <PageContainer>
    <PageHeader
      title="调度快照"
      description="GET /api/console/scheduler/snapshot 与 /snapshot/history"
    />
    <SectionCard>
      <EmptyState description="TODO: 当前快照卡片 + 历史表格" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>
