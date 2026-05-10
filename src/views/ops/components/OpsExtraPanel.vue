<template>
  <SectionCard class="extra-panel-card">
    <div class="section-toolbar">
      <span class="u-flex-1" />
      <el-button type="primary" :icon="Refresh" :loading="extraLoading" @click="$emit('loadExtra')">
        {{ t('opsExtraPanel.btnRefresh') }}
      </el-button>
    </div>
    <div class="extra-panels">
      <div class="extra-block">
        <h4 class="extra-title">{{ t('opsExtraPanel.slaReport') }}</h4>
        <JsonPreview v-if="slaReport" :data="slaReport" />
        <span v-else class="extra-empty">{{ t('opsExtraPanel.emptyData') }}</span>
      </div>
      <div class="extra-block">
        <h4 class="extra-title">{{ t('opsExtraPanel.execProgress') }}</h4>
        <div class="extra-hint">
          <p>{{ t('opsExtraPanel.execProgressHint') }}</p>
          <RouterLink class="extra-hint__link" to="/monitor/job-instances">
            {{ t('opsExtraPanel.linkJobInstances') }}
          </RouterLink>
        </div>
      </div>
      <div class="extra-block">
        <h4 class="extra-title">{{ t('opsExtraPanel.tenantUsage') }}</h4>
        <JsonPreview v-if="tenantUsage" :data="tenantUsage" />
        <span v-else class="extra-empty">{{ t('opsExtraPanel.emptyData') }}</span>
      </div>
    </div>
  </SectionCard>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { RouterLink } from 'vue-router'
  import SectionCard from '@/components/common/SectionCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'

  const { t } = useI18n({ useScope: 'global' })

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
