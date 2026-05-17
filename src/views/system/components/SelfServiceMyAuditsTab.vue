<template>
  <div class="my-audits">
    <div v-if="loading" class="my-audits__state">{{ t('selfServicePanel.listLoading') }}</div>
    <div v-else-if="error" class="my-audits__state my-audits__state--error">
      {{ t('selfServicePanel.listError') }}
    </div>
    <el-empty v-else-if="rows.length === 0" :description="t('selfServicePanel.listEmpty')" />
    <el-table v-else :data="rows" size="small" stripe>
      <el-table-column label="time" width="160">
        <template #default="{ row }">{{ fmtDatetime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="operationType" label="action" min-width="160" show-overflow-tooltip />
      <el-table-column prop="targetType" label="target" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.targetType }}/{{ row.targetId ?? '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="result" width="90">
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
      <el-table-column prop="traceId" label="trace" width="110">
        <template #default="{ row }">
          <span class="trace-short">{{ String(row.traceId ?? '').slice(0, 8) || '—' }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { fmtDatetime } from '@/utils/datetime'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
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

  onMounted(load)
</script>

<style scoped>
  .my-audits__state {
    padding: 24px;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .my-audits__state--error {
    color: var(--color-danger);
  }

  .trace-short {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
</style>
