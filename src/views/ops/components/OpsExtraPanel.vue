<template>
  <SectionCard class="extra-panel-card">
    <div class="section-toolbar">
      <el-button :loading="extraLoading" @click="$emit('loadExtra')">刷新扩展面板</el-button>
    </div>
    <div class="extra-panels">
      <div class="extra-block">
        <h4 class="extra-title">SLA 报告</h4>
        <pre v-if="slaReport" class="json-preview">{{ JSON.stringify(slaReport, null, 2) }}</pre>
        <span v-else class="extra-empty">暂无数据</span>
      </div>
      <div class="extra-block">
        <h4 class="extra-title">执行进度</h4>
        <pre v-if="executionProgress" class="json-preview">{{
          JSON.stringify(executionProgress, null, 2)
        }}</pre>
        <span v-else class="extra-empty">暂无数据</span>
      </div>
      <div class="extra-block">
        <h4 class="extra-title">租户用量</h4>
        <pre v-if="tenantUsage" class="json-preview">{{
          JSON.stringify(tenantUsage, null, 2)
        }}</pre>
        <span v-else class="extra-empty">暂无数据</span>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
  import SectionCard from '@/components/common/SectionCard.vue'

  defineProps<{
    extraLoading: boolean
    slaReport: unknown
    executionProgress: unknown
    tenantUsage: unknown
  }>()

  defineEmits<{
    loadExtra: []
  }>()
</script>

<style scoped>
  .extra-panels {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-md);
  }
  .extra-block {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    padding: var(--card-inner-padding);
  }
  .extra-title {
    margin: 0 0 var(--space-sm);
    font-size: var(--font-size-sm);
    font-weight: 650;
    color: var(--color-text-primary);
  }
  .extra-empty {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
  }
</style>
