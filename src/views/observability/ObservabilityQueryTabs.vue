<template>
  <PageContainer>
    <PageHeader>
      <!-- Trace 快搜收进页头右侧(用户反馈:原独占整行大条太浪费);hint 收进 tooltip -->
      <template #actions>
        <el-tooltip :content="t('observability.traceQuickHint')" placement="bottom">
          <div class="obs-trace-quick">
            <TraceIdInput
              v-model="traceQuick"
              :placeholder="t('observability.traceQuickPlaceholder')"
              class="obs-trace-quick__input"
              @keyup.enter="jumpTrace"
            />
            <el-button type="primary" :disabled="!traceQuick.trim()" @click="jumpTrace">
              {{ t('observability.traceQuickGo') }}
            </el-button>
          </div>
        </el-tooltip>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="pill-tabs">
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
  </PageContainer>
</template>

<style scoped>
  .obs-trace-quick {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .obs-trace-quick__input {
    width: 320px;
  }
</style>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import PageContainer from '@/components/common/PageContainer.vue'
  import TraceIdInput from '@/components/common/TraceIdInput.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
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
