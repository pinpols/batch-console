<template>
  <PageContainer>
    <PageHeader
      title="运营概览"
      description="GET /api/console/ops/summary — 依赖当前租户，展示待审批、告警、运行任务等聚合指标。"
    >
      <template #actions>
        <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <template #header>快照 JSON（联调后改为卡片矩阵）</template>
      <pre v-if="summary" class="json-preview">{{ formatted }}</pre>
      <EmptyState v-else-if="!loading" description="暂无数据或接口未就绪" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { getOpsSummary } from '@/api/ops'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'

  const tenant = useTenantStore()
  const loading = ref(false)
  const summary = ref<Record<string, unknown> | null>(null)

  const formatted = computed(() =>
    summary.value ? JSON.stringify(summary.value, null, 2) : '',
  )

  async function load() {
    loading.value = true
    try {
      summary.value = await getOpsSummary(tenant.tenantId)
    } catch {
      summary.value = null
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
</script>

<style scoped>
  .json-preview {
    margin: 0;
    padding: 12px;
    overflow: auto;
    max-height: 480px;
    font-size: 12px;
    line-height: 1.5;
    background: var(--color-bg-page);
    border-radius: 8px;
  }
</style>
