<template>
  <div class="notif-subs">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="t('selfServicePanel.descNotifSubs')"
      class="notif-subs__intro"
    />

    <ProTable
      :data="rules"
      :loading="loading"
      :error="error"
      :error-text="t('selfServicePanel.listError')"
      :on-retry="load"
      :total="rules.length"
      :page="1"
      :page-size="10"
      :show-pager="false"
      :persist-page-size="false"
      :empty-text="t('selfServicePanel.listEmpty')"
      :skeleton-rows="4"
    >
      <template #empty>
        <EmptyState :description="t('selfServicePanel.listEmpty')" :image-size="72" />
      </template>

      <el-table-column
        prop="ruleCode"
        :label="t('selfServicePanel.colRuleCode')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column
        prop="eventType"
        :label="t('selfServicePanel.colEventType')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column prop="severity" :label="t('selfServicePanel.colSeverity')" width="100">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="severityType(row.severity)">
            {{ row.severity ?? '—' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column :label="t('common.status')" width="100">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="row.enabled ? 'success' : 'info'">
            {{
              row.enabled
                ? t('selfServicePanel.triggerStatusActive')
                : t('selfServicePanel.triggerStatusPaused')
            }}
          </el-tag>
        </template>
      </el-table-column>
    </ProTable>

    <div class="notif-subs__cta">
      <el-button type="primary" :icon="TopRight" @click="goNotifications">
        {{ t('selfServicePanel.actionGoNotifications') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { TopRight } from '@element-plus/icons-vue'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { listNotificationRules } from '@/api/notifications'

  type Severity = 'INFO' | 'WARNING' | 'CRITICAL' | string

  interface NotificationRule {
    ruleCode?: string
    eventType?: string
    severity?: Severity
    enabled?: boolean
  }

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const tenant = useTenantStore()

  const loading = ref(false)
  const error = ref(false)
  const rules = ref<NotificationRule[]>([])

  function severityType(s?: string): 'danger' | 'warning' | 'info' {
    if (s === 'CRITICAL') return 'danger'
    if (s === 'WARNING') return 'warning'
    return 'info'
  }

  async function load() {
    if (!tenant.tenantId) return
    loading.value = true
    error.value = false
    try {
      const list = (await listNotificationRules(tenant.tenantId)) as NotificationRule[]
      rules.value = list ?? []
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  function goNotifications() {
    void router.push({ path: '/system/notifications' })
  }

  useTenantReload(load)
</script>

<style scoped>
  .notif-subs__intro {
    margin-bottom: 16px;
  }

  .notif-subs__cta {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
</style>
