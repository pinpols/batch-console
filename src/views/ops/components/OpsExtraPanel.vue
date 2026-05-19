<template>
  <SectionCard class="extra-panel-card">
    <div class="section-toolbar">
      <span class="u-flex-1" />
      <el-button
        :icon="Refresh"
        :loading="extraLoading || refresh.loading.value"
        @click="onRefresh"
      >
        {{ t('opsExtraPanel.btnRefresh') }}
      </el-button>
    </div>
    <div class="extra-panels">
      <div class="extra-block extra-block--gauge">
        <h4 class="extra-title">{{ t('opsExtraPanel.slaGaugeTitle') }}</h4>
        <VChart
          class="gauge-chart"
          :option="slaGaugeOption"
          :theme="chartTheme"
          autoresize
          :loading="extraLoading"
        />
      </div>
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
  import { onMounted, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { RouterLink } from 'vue-router'
  import VChart from 'vue-echarts'
  import SectionCard from '@/components/common/SectionCard.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { useRefreshAction } from '@/composables/useRefreshAction'

  const { t } = useI18n({ useScope: 'global' })

  const props = defineProps<{
    extraLoading: boolean
    slaReport: unknown
    tenantUsage: unknown
    slaGaugeOption: Record<string, unknown>
    chartTheme: string | undefined
  }>()

  const emit = defineEmits<{
    loadExtra: []
  }>()

  const refresh = useRefreshAction()

  /** 等父组件 extraLoading 从 true 翻回 false,即视为本轮加载完成 */
  function waitParentLoadDone(): Promise<void> {
    return new Promise<void>((resolve) => {
      const stop = watch(
        () => props.extraLoading,
        (v, old) => {
          if (old && !v) {
            stop()
            resolve()
          }
        },
      )
    })
  }

  function onRefresh() {
    void refresh.run(async () => {
      emit('loadExtra')
      await waitParentLoadDone()
    })
  }

  // 挂载时主动加载:用户直接进 ?tab=extra 时,父级 loadCharts 还没跑,
  // slaReport / tenantUsage / gauge 都没数据 → 卡片空白。这里触发一次。
  onMounted(() => {
    if (!props.slaReport && !props.tenantUsage) {
      emit('loadExtra')
    }
  })
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
  .extra-block--gauge {
    display: flex;
    flex-direction: column;
  }
  .gauge-chart {
    width: 100%;
    height: 220px;
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
