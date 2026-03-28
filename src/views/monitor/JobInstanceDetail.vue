<template>
  <PageContainer>
    <PageHeader
      title="Job Instance 详情"
      description="实例上下文、状态流转和日志入口的详情骨架。"
    />

    <div class="detail-grid">
      <MetricCard label="实例编号" value="--" description="来自路由参数 :id" />
      <MetricCard label="当前状态" value="--" description="后续接入状态流转" />
      <MetricCard label="分片进度" value="--" description="完成 / 总数" />
    </div>

    <SectionCard>
      <EmptyState description="TODO: Job Instance 时间线、基础信息和日志联动" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
</script>

<style scoped>
  .detail-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  @media (max-width: 1200px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

