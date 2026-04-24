<template>
  <PageContainer>
    <PageHeader
      title="可观测性查询"
      description="Dead Letters、重试调度、执行日志、Channel 回执查询。"
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
  import { ref } from 'vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import DeadLettersTab from './components/DeadLettersTab.vue'
  import RetriesTab from './components/RetriesTab.vue'
  import ExecutionLogsTab from './components/ExecutionLogsTab.vue'
  import ChannelReceiptsTab from './components/ChannelReceiptsTab.vue'

  const activeTab = ref<'deadLetters' | 'retries' | 'executionLogs' | 'channelReceipts'>(
    'deadLetters',
  )
</script>
