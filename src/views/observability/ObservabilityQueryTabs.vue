<template>
  <PageContainer>
    <PageHeader />

    <!-- P2.2 顶部全局 Trace 快搜:粘 traceId 直跳 Trace 诊断 -->
    <SectionCard class="obs-trace-bar">
      <div class="obs-trace-bar__row">
        <el-input
          v-model="traceQuick"
          :placeholder="t('observability.traceQuickPlaceholder')"
          clearable
          class="obs-trace-bar__input"
          @keyup.enter="jumpTrace"
        >
          <template #prefix>
            <el-icon><Aim /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" :disabled="!traceQuick.trim()" @click="jumpTrace">
          {{ t('observability.traceQuickGo') }}
        </el-button>
        <span class="obs-trace-bar__hint">{{ t('observability.traceQuickHint') }}</span>
      </div>
    </SectionCard>

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('observability.tabDeadLetters')" name="deadLetters">
          <DeadLettersTab />
        </el-tab-pane>
        <el-tab-pane :label="t('observability.tabRetries')" name="retries" lazy>
          <RetriesTab />
        </el-tab-pane>
        <el-tab-pane :label="t('observability.tabExecLogs')" name="executionLogs" lazy>
          <ExecutionLogsTab />
        </el-tab-pane>
        <el-tab-pane :label="t('observability.tabChannelReceipts')" name="channelReceipts" lazy>
          <ChannelReceiptsTab />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<style scoped>
  .obs-trace-bar {
    margin-bottom: 12px;
  }
  .obs-trace-bar__row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .obs-trace-bar__input {
    flex: 0 0 480px;
    max-width: 60%;
  }
  .obs-trace-bar__hint {
    color: var(--color-text-tertiary);
    font-size: 12px;
  }
</style>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Aim } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DeadLettersTab from './components/DeadLettersTab.vue'
  import RetriesTab from './components/RetriesTab.vue'
  import ExecutionLogsTab from './components/ExecutionLogsTab.vue'
  import ChannelReceiptsTab from './components/ChannelReceiptsTab.vue'

  type Tab = 'deadLetters' | 'retries' | 'executionLogs' | 'channelReceipts'
  const VALID = new Set<Tab>(['deadLetters', 'retries', 'executionLogs', 'channelReceipts'])

  const route = useRoute()
  const router = useRouter()
  // P2.2 默认 tab 改为"执行日志"——比 Dead Letters 更接近"综合搜索"心智
  const activeTab = ref<Tab>(
    VALID.has(route.query.tab as Tab) ? (route.query.tab as Tab) : 'executionLogs',
  )

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })

  // P2.2 顶部 traceId 快搜:直跳 Trace 诊断页
  const traceQuick = ref<string>('')
  function jumpTrace() {
    const v = traceQuick.value.trim()
    if (!v) return
    void router.push(`/observability/trace?traceId=${encodeURIComponent(v)}`)
  }
</script>
