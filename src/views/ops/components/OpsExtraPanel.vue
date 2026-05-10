<template>
  <SectionCard class="extra-panel-card">
    <div class="section-toolbar">
      <span class="u-flex-1" />
      <el-button type="primary" :icon="Refresh" :loading="extraLoading" @click="$emit('loadExtra')">
        刷新
      </el-button>
    </div>
    <div class="extra-panels">
      <div class="extra-block">
        <h4 class="extra-title">SLA 报告</h4>
        <JsonPreview v-if="slaReport" :data="slaReport" />
        <span v-else class="extra-empty">暂无数据</span>
      </div>
      <div class="extra-block">
        <h4 class="extra-title">执行进度</h4>
        <div class="extra-hint">
          <p>需指定 Job + 业务日期才能查看,本概览页未提供选择器。</p>
          <RouterLink class="extra-hint__link" to="/monitor/job-instances">
            前往 Job 实例列表 →
          </RouterLink>
        </div>
      </div>
      <div class="extra-block">
        <h4 class="extra-title">租户用量</h4>
        <JsonPreview v-if="tenantUsage" :data="tenantUsage" />
        <span v-else class="extra-empty">暂无数据</span>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
  import { Refresh } from '@element-plus/icons-vue'
  import { RouterLink } from 'vue-router'
  import SectionCard from '@/components/common/SectionCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'

  defineProps<{
    extraLoading: boolean
    slaReport: unknown
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

  .extra-hint {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
    line-height: 1.6;
  }
  .extra-hint p {
    margin: 0 0 6px;
  }
  .extra-hint__link {
    color: var(--el-color-primary);
    text-decoration: none;
  }
  .extra-hint__link:hover {
    text-decoration: underline;
  }
</style>
