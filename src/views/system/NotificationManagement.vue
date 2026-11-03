<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button @click="$router.push('/system/event-catalog')">
          {{ t('notificationManagement.eventCatalogAction') }}
        </el-button>
        <el-button
          v-if="activeCreateAction"
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          @click="openCreate"
        >
          {{ activeCreateAction.label }}
        </el-button>
      </template>
    </PageHeader>

    <el-alert
      v-if="activeTab === 'rules' || activeTab === 'webhooks'"
      :title="t('notificationCommon.slaAlertHint')"
      type="info"
      show-icon
      :closable="false"
    />

    <div>
      <el-tabs v-model="activeTab" class="pill-tabs">
        <el-tab-pane :label="t('notificationManagement.tabChannels')" name="channels">
          <NotificationChannelsTab ref="channelsTabRef" />
        </el-tab-pane>
        <el-tab-pane :label="t('notificationManagement.tabRules')" name="rules">
          <NotificationRulesTab ref="rulesTabRef" />
        </el-tab-pane>
        <el-tab-pane :label="t('notificationManagement.tabWebhooks')" name="webhooks">
          <NotificationWebhooksTab ref="webhooksTabRef" />
        </el-tab-pane>
        <el-tab-pane
          v-if="canPreviewRoute"
          :label="t('notificationManagement.tabRoutePreview')"
          name="routePreview"
          lazy
        >
          <NotificationRoutePreview />
        </el-tab-pane>
        <el-tab-pane :label="t('notificationManagement.tabDeliveryLogs')" name="deliveryLogs">
          <NotificationDeliveryLogsTab />
        </el-tab-pane>
        <el-tab-pane
          :label="t('notificationManagement.tabTerminalDeliveries')"
          name="terminalDeliveries"
        >
          <NotificationTerminalDeliveriesTab />
        </el-tab-pane>
      </el-tabs>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { Plus } from '@lucide/vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import NotificationChannelsTab from './components/NotificationChannelsTab.vue'
  import NotificationRulesTab from './components/NotificationRulesTab.vue'
  import NotificationWebhooksTab from './components/NotificationWebhooksTab.vue'
  import NotificationDeliveryLogsTab from './components/NotificationDeliveryLogsTab.vue'
  import NotificationTerminalDeliveriesTab from './components/NotificationTerminalDeliveriesTab.vue'
  import NotificationRoutePreview from './components/NotificationRoutePreview.vue'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'

  const { t } = useI18n({ useScope: 'global' })
  type NotificationTab =
    'channels' | 'rules' | 'webhooks' | 'routePreview' | 'deliveryLogs' | 'terminalDeliveries'
  type CreateTabExpose = {
    openChannelCreate?: () => void
    openRuleCreate?: () => void
    openWebhookCreate?: () => void
  }

  const TABS: readonly NotificationTab[] = [
    'channels',
    'rules',
    'webhooks',
    'routePreview',
    'deliveryLogs',
    'terminalDeliveries',
  ]
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()

  /** 页签与 URL 的 tab 参数双向同步，深链能直接落到对应页签与其新增入口 */
  function tabFromQuery(value: unknown): NotificationTab {
    return TABS.includes(value as NotificationTab) ? (value as NotificationTab) : 'channels'
  }
  const activeTab = ref<NotificationTab>(tabFromQuery(route.query.tab))
  watch(
    () => route.query.tab,
    (tab) => {
      const selected = tabFromQuery(tab)
      if (selected !== activeTab.value) activeTab.value = selected
    },
  )
  watch(activeTab, (tab) => {
    if (route.query.tab !== tab) void router.replace({ query: { ...route.query, tab } })
  })
  const auth = useAuthStore()
  const canPreviewRoute = computed(
    () => auth.hasPermission('ROLE_ADMIN') || auth.hasPermission('ROLE_TENANT_ADMIN'),
  )
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

  // 各页签的新增在无租户时会直接返回；这里先给出提示，避免点击后毫无反应
  function openCreate() {
    if (!tenant.tenantId) {
      ElMessage.warning(t('notificationManagement.selectTenantFirst'))
      return
    }
    activeCreateAction.value?.open()
  }
</script>
