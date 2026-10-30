<template>
  <ProTable :data="pagedRows" :loading="loading" :error="error" :on-retry="load"
    :total="rows.length" v-model:page="page" v-model:page-size="pageSize" @change="() => {}">
    <template #toolbar>
      <el-button :loading="loading" @click="load">{{ t('terminalNotifications.refresh') }}</el-button>
    </template>
    <el-table-column prop="source" :label="t('terminalNotifications.source')" width="100" />
    <el-table-column prop="id" :label="t('terminalNotifications.id')" width="90" />
    <el-table-column prop="eventType" :label="t('terminalNotifications.eventType')" width="180" />
    <el-table-column prop="terminalEventKey" :label="t('terminalNotifications.eventKey')" min-width="240" show-overflow-tooltip />
    <el-table-column prop="deliveryStatus" :label="t('terminalNotifications.status')" width="180">
      <template #default="{ row }">
        {{ displayStatus(row as TerminalDelivery) }}
      </template>
    </el-table-column>
    <el-table-column prop="attempt" :label="t('terminalNotifications.attempt')" width="110" />
    <el-table-column prop="errorMessage" :label="t('terminalNotifications.error')" min-width="220" show-overflow-tooltip />
    <DatetimeColumn prop="createdAt" :label="t('terminalNotifications.createdAt')" width="160" />
    <el-table-column :label="t('terminalNotifications.actions')" width="220" fixed="right">
      <template #default="{ row }">
        <el-button v-if="canManage" link type="primary" :disabled="!canRetryTerminalDelivery(row as TerminalDelivery)" @click="open(row as TerminalDelivery)">
          {{ t('terminalNotifications.reconcileRetry') }}
        </el-button>
        <RouterLink :to="{ path: '/observability/operation-audits', query: { aggregateType: 'NOTIFICATION_DELIVERY', aggregateId: `${row.source}:${row.id}` } }">
          {{ t('terminalNotifications.audit') }}
        </RouterLink>
      </template>
    </el-table-column>
  </ProTable>
  <el-dialog v-model="visible" :title="t('terminalNotifications.reconcileRetry')" width="560px"
    :close-on-click-modal="false" :close-on-press-escape="!submitting" :show-close="!submitting">
    <el-alert type="warning" :closable="false" :title="t('terminalNotifications.reconcileHint')" />
    <p>{{ selected?.row.terminalEventKey }}</p>
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item :label="t('terminalNotifications.reason')" required>
        <el-input v-model="reason" type="textarea" :maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item :label="t('terminalNotifications.reference')" required>
        <el-input v-model="reference" :maxlength="500" />
      </el-form-item>
      <el-checkbox v-model="confirmed">{{ t('terminalNotifications.confirmed') }}</el-checkbox>
    </el-form>
    <template #footer>
      <el-button :disabled="submitting" @click="visible = false">{{ t('terminalNotifications.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!ready" @click="submit">
        {{ t('terminalNotifications.queueRetry') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { RouterLink } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { listTerminalDeliveries, retryTerminalDelivery, type TerminalDelivery } from '@/api/terminalNotifications'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ProTable from '@/components/table/ProTable.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { canRetryTerminalDelivery, terminalDeliveryStatusKey } from './terminalDeliveryRecovery'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()
  const rows = ref<TerminalDelivery[]>([])
  const page = ref(1)
  const pageSize = ref(15)
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  const visible = ref(false)
  const submitting = ref(false)
  const reason = ref('')
  const reference = ref('')
  const confirmed = ref(false)
  const selected = ref<{ tenantId: string; row: TerminalDelivery; requestId: string } | null>(null)
  const canManage = computed(() => auth.hasPermission('ROLE_ADMIN') || auth.hasPermission('ROLE_TENANT_ADMIN'))
  const ready = computed(() => canManage.value && !!selected.value && confirmed.value &&
    !!reason.value.trim() && !!reference.value.trim() && !submitting.value)
  const pagedRows = computed(() => toPageResult(rows.value, page.value, pageSize.value).records)

  function displayStatus(row: TerminalDelivery): string {
    const statusKey = terminalDeliveryStatusKey(row)
    return statusKey ? t(statusKey) : row.deliveryStatus
  }

  async function load() {
    const expectedTenant = tenant.tenantId
    if (!expectedTenant) return
    const current = ++generation
    loading.value = true
    error.value = ''
    try {
      const result = await listTerminalDeliveries(expectedTenant)
      if (current === generation && expectedTenant === tenant.tenantId) rows.value = result
    } catch {
      if (current === generation && expectedTenant === tenant.tenantId) {
        rows.value = []
        error.value = t('terminalNotifications.loadFailed')
      }
    } finally {
      if (current === generation) loading.value = false
    }
  }

  function open(row: TerminalDelivery) {
    if (!canManage.value || !canRetryTerminalDelivery(row)) return
    selected.value = { tenantId: tenant.tenantId, row: { ...row }, requestId: crypto.randomUUID() }
    reason.value = ''
    reference.value = ''
    confirmed.value = false
    visible.value = true
  }

  async function submit() {
    const target = selected.value
    if (!ready.value || !target || target.tenantId !== tenant.tenantId) return
    submitting.value = true
    try {
      await retryTerminalDelivery(target.tenantId, target.row.source, target.row.id, {
        requestId: target.requestId, expectedAttempt: target.row.attempt,
        reason: reason.value.trim(), reconciliationReference: reference.value.trim(), confirmedNotDelivered: true,
      })
      if (target.tenantId === tenant.tenantId && selected.value?.requestId === target.requestId) {
        visible.value = false
        ElMessage.success(t('terminalNotifications.queued'))
        await load()
      }
    } catch {
      // 统一客户端显示错误,保留同一请求身份供网络中断后安全重试。
    } finally {
      submitting.value = false
    }
  }

  useTenantReload(() => {
    ++generation
    visible.value = false
    selected.value = null
    rows.value = []
    page.value = 1
    return load()
  })
</script>
