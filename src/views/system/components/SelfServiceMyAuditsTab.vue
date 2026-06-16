<template>
  <div class="my-audits">
    <ProTable
      :data="rows"
      :loading="loading"
      :error="error"
      :error-text="t('selfServicePanel.listError')"
      :on-retry="load"
      :total="rows.length"
      :page="1"
      :page-size="20"
      :show-pager="false"
      :persist-page-size="false"
      :empty-text="t('selfServicePanel.listEmpty')"
      :skeleton-rows="5"
    >
      <template #empty>
        <EmptyState :description="t('selfServicePanel.listEmpty')" :image-size="72" />
      </template>

      <el-table-column :label="t('selfServicePanel.colTime')" width="160">
        <template #default="{ row }">{{ fmtDatetime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column
        prop="operationType"
        :label="t('selfServicePanel.colAction')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column
        prop="targetType"
        :label="t('selfServicePanel.colTarget')"
        min-width="140"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span>{{ row.targetType }}/{{ row.targetId ?? '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('selfServicePanel.colResult')" width="100">
        <template #default="{ row }">
          <el-tag
            size="small"
            effect="plain"
            :type="row.operationResult === 'SUCCESS' ? 'success' : 'danger'"
          >
            {{ row.operationResult ?? '—' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="traceId" :label="t('selfServicePanel.colTrace')" width="110">
        <template #default="{ row }">
          <span class="trace-short">{{ String(row.traceId ?? '').slice(0, 8) || '—' }}</span>
        </template>
      </el-table-column>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { queryAudits } from '@/api/observabilityQueries'
  import type { ConsoleAuditLogResponse } from '@/types/console-api'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const auth = useAuthStore()

  const loading = ref(false)
  const error = ref(false)
  const rows = ref<ConsoleAuditLogResponse[]>([])

  async function load() {
    if (!tenant.tenantId) return
    loading.value = true
    error.value = false
    try {
      // queryAudits 返回 fetchAllPageItems 聚合的数组(单租户 paged 全拉);只取前 20 条
      const all = (await queryAudits(tenant.tenantId, {
        operatorId: auth.userInfo?.userId,
      })) as ConsoleAuditLogResponse[]
      rows.value = (all ?? []).slice(0, 20)
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .trace-short {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
</style>
