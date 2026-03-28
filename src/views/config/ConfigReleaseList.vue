<template>
  <PageContainer>
    <PageHeader
      title="配置发布"
      description="GET/POST /api/console/config/releases — 发布、灰度、回滚入口骨架"
    />
    <SectionCard>
      <EmptyState description="TODO: 发布单列表与状态机操作" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>
