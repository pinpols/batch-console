<template>
  <PageContainer>
    <PageHeader title="AI 助手" description="POST /api/console/ai/chat（需额外 prompt 授权）" />
    <SectionCard>
      <EmptyState description="TODO: 对话 UI + 审计跳转" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>
