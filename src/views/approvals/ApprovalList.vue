<template>
  <PageContainer>
    <PageHeader
      title="审批中心"
      description="列表：GET /api/console/query/approvals；操作：POST /api/console/approvals/..."
    />
    <SectionCard>
      <EmptyState description="TODO: ProTable + 单条/批量审批" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>
