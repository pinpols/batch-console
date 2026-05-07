<template>
  <PageContainer>
    <PageHeader
      title="综合查询"
      description="死信、重试调度、执行日志与 Channel 回执的统一查询。"
    />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="Dead Letters" name="deadLetters">
          <DeadLettersTab />
        </el-tab-pane>
        <el-tab-pane label="重试调度" name="retries" lazy>
          <RetriesTab />
        </el-tab-pane>
        <el-tab-pane label="执行日志" name="executionLogs" lazy>
          <ExecutionLogsTab />
        </el-tab-pane>
        <el-tab-pane label="Channel 回执" name="channelReceipts" lazy>
          <ChannelReceiptsTab />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
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
  const activeTab = ref<Tab>(
    VALID.has(route.query.tab as Tab) ? (route.query.tab as Tab) : 'deadLetters',
  )

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })
</script>
