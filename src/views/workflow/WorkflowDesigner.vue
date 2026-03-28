<template>
  <PageContainer>
    <PageHeader
      title="Workflow 编排"
      description="Workflow DAG 查看与基础编辑骨架，后续可接入 Vue Flow 或 X6。"
    />

    <SectionCard>
      <EmptyState description="TODO: Workflow DAG 画布、节点面板与发布流程" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
</script>

