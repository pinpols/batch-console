<template>
  <div class="failed-jobs">
    <div v-if="loading" class="failed-jobs__state">{{ t('selfServicePanel.listLoading') }}</div>
    <div v-else-if="error" class="failed-jobs__state failed-jobs__state--error">
      {{ t('selfServicePanel.listError') }}
    </div>
    <el-empty v-else-if="rows.length === 0" :description="t('selfServicePanel.listEmpty')" />
    <el-table v-else :data="rows" size="small" stripe>
      <el-table-column prop="instanceNo" label="instanceNo" min-width="180">
        <template #default="{ row }">
          <router-link class="cell-link" :to="`/monitor/job-instances/${row.id}`">
            {{ row.instanceNo }}
          </router-link>
        </template>
      </el-table-column>
      <el-table-column prop="jobCode" label="jobCode" min-width="160" show-overflow-tooltip />
      <el-table-column prop="bizDate" label="bizDate" width="110" />
      <el-table-column label="finishedAt" width="170">
        <template #default="{ row }">{{ fmtDatetime(row.finishedAt) }}</template>
      </el-table-column>
      <el-table-column label="op" width="92" align="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" :icon="RefreshRight" @click="goRerun(row)">
            {{ t('selfServicePanel.actionGoRerun') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RefreshRight } from '@element-plus/icons-vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useTenantStore } from '@/stores/tenant'
  import { queryJobInstances } from '@/api/queries/instances'
  import type { ConsoleJobInstanceResponse } from '@/types/console-api'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const tenant = useTenantStore()

  const loading = ref(false)
  const error = ref(false)
  const rows = ref<ConsoleJobInstanceResponse[]>([])

  async function load() {
    if (!tenant.tenantId) return
    loading.value = true
    error.value = false
    try {
      const res = await queryJobInstances({
        tenantId: tenant.tenantId,
        instanceStatus: 'FAILED',
        page: 1,
        pageSize: 10,
      })
      rows.value = res?.records ?? []
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  function goRerun(row: ConsoleJobInstanceResponse) {
    // 跳到 SelfServicePanel 的 rerun drawer,带 jobCode 给表单预填
    void router.push({
      path: '/self-service',
      query: { action: 'rerun', jobCode: row.jobCode, bizDate: row.bizDate ?? '' },
    })
  }

  onMounted(load)
</script>

<style scoped>
  .failed-jobs__state {
    padding: 24px;
    text-align: center;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .failed-jobs__state--error {
    color: var(--color-danger);
  }
</style>
