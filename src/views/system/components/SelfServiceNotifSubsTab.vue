<template>
  <div class="notif-subs">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      :title="t('selfServicePanel.descNotifSubs')"
      class="notif-subs__intro"
    />

    <div v-if="loading" class="notif-subs__state">{{ t('selfServicePanel.listLoading') }}</div>
    <div v-else-if="error" class="notif-subs__state notif-subs__state--error">
      {{ t('selfServicePanel.listError') }}
    </div>
    <el-empty v-else-if="rules.length === 0" :description="t('selfServicePanel.listEmpty')" />
    <el-table v-else :data="rules" size="small" stripe>
      <el-table-column prop="ruleCode" label="ruleCode" min-width="160" show-overflow-tooltip />
      <el-table-column prop="eventType" label="eventType" min-width="160" show-overflow-tooltip />
      <el-table-column prop="severity" label="severity" width="90">
        <template #default="{ row }">
          <el-tag size="small" effect="plain" :type="severityType(row.severity)">
            {{ row.severity ?? '—' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="status" width="90">
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
    </el-table>

    <div class="notif-subs__cta">
      <el-button type="primary" :icon="TopRight" @click="goNotifications">
        {{ t('selfServicePanel.actionGoNotifications') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { TopRight } from '@element-plus/icons-vue'
  import { useTenantStore } from '@/stores/tenant'
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

  onMounted(load)
</script>

<style scoped>
  .notif-subs__intro {
    margin-bottom: 16px;
  }

  .notif-subs__state {
    padding: 24px;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .notif-subs__state--error {
    color: var(--color-danger);
  }

  .notif-subs__cta {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
</style>
