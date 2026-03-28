<template>
  <PageContainer>
    <PageHeader
      title="Outbox"
      description="GET /api/console/query/outbox-retries | outbox-deliveries"
    />
    <SectionCard>
      <EmptyState description="TODO: Tab 切换两类查询列表" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>
