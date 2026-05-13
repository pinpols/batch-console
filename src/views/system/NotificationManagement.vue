<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          v-if="activeCreateAction"
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          @click="activeCreateAction.open"
        >
          {{ activeCreateAction.label }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane :label="t('notificationManagement.tabChannels')" name="channels">
          <NotificationChannelsTab ref="channelsTabRef" />
        </el-tab-pane>
        <el-tab-pane :label="t('notificationManagement.tabRules')" name="rules">
          <NotificationRulesTab ref="rulesTabRef" />
        </el-tab-pane>
        <el-tab-pane label="Webhook" name="webhooks">
          <NotificationWebhooksTab ref="webhooksTabRef" />
        </el-tab-pane>
        <el-tab-pane :label="t('notificationManagement.tabDeliveryLogs')" name="deliveryLogs">
          <NotificationDeliveryLogsTab />
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Plus } from '@element-plus/icons-vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import NotificationChannelsTab from './components/NotificationChannelsTab.vue'
  import NotificationRulesTab from './components/NotificationRulesTab.vue'
  import NotificationWebhooksTab from './components/NotificationWebhooksTab.vue'
  import NotificationDeliveryLogsTab from './components/NotificationDeliveryLogsTab.vue'

  const { t } = useI18n({ useScope: 'global' })
  type NotificationTab = 'channels' | 'rules' | 'webhooks' | 'deliveryLogs'
  type CreateTabExpose = {
    openChannelCreate?: () => void
    openRuleCreate?: () => void
    openWebhookCreate?: () => void
  }

  const activeTab = ref<NotificationTab>('channels')
  const channelsTabRef = ref<CreateTabExpose | null>(null)
  const rulesTabRef = ref<CreateTabExpose | null>(null)
  const webhooksTabRef = ref<CreateTabExpose | null>(null)

  const activeCreateAction = computed(() => {
    if (activeTab.value === 'channels') {
      return {
        label: t('notificationChannelsTab.dialogTitleCreate'),
        open: () => channelsTabRef.value?.openChannelCreate?.(),
      }
    }
    if (activeTab.value === 'rules') {
      return {
        label: t('notificationRulesTab.dialogTitleCreate'),
        open: () => rulesTabRef.value?.openRuleCreate?.(),
      }
    }
    if (activeTab.value === 'webhooks') {
      return {
        label: t('notificationWebhooksTab.dialogTitleCreate'),
        open: () => webhooksTabRef.value?.openWebhookCreate?.(),
      }
    }
    return null
  })
</script>
