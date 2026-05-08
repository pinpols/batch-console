<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="通知渠道" name="channels">
          <NotificationChannelsTab />
        </el-tab-pane>
        <el-tab-pane label="订阅规则" name="rules">
          <NotificationRulesTab />
        </el-tab-pane>
        <el-tab-pane label="Webhook" name="webhooks">
          <NotificationWebhooksTab />
        </el-tab-pane>
        <el-tab-pane label="投递日志" name="deliveryLogs">
          <NotificationDeliveryLogsTab />
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
  import NotificationChannelsTab from './components/NotificationChannelsTab.vue'
  import NotificationRulesTab from './components/NotificationRulesTab.vue'
  import NotificationWebhooksTab from './components/NotificationWebhooksTab.vue'
  import NotificationDeliveryLogsTab from './components/NotificationDeliveryLogsTab.vue'

  const activeTab = ref('channels')
</script>
