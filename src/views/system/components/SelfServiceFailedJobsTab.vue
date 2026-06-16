<template>
  <div class="failed-jobs">
    <ProTable
      :data="rows"
      :loading="loading"
      :error="error"
      :error-text="t('selfServicePanel.listError')"
      :on-retry="load"
      :total="rows.length"
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
        prop="instanceNo"
        :label="t('selfServicePanel.colInstanceNo')"
        min-width="180"
      >
        <template #default="{ row }">
          <router-link class="cell-link" :to="`/monitor/job-instances/${row.id}`">
            {{ row.instanceNo }}
          </router-link>
        </template>
      </el-table-column>
      <el-table-column
        prop="jobCode"
        :label="t('selfServicePanel.colJobCode')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column prop="bizDate" :label="t('selfServicePanel.colBizDate')" width="110" />
      <el-table-column :label="t('selfServicePanel.colFinishedAt')" width="170">
        <template #default="{ row }">{{ fmtDatetime(row.finishedAt) }}</template>
      </el-table-column>
      <el-table-column :label="t('common.actions')" width="120" align="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" :icon="RefreshRight" @click="goRerun(row)">
            {{ t('selfServicePanel.actionGoRerun') }}
          </el-button>
        </template>
      </el-table-column>
    </ProTable>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RefreshRight } from '@element-plus/icons-vue'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
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

  useTenantReload(load)
</script>
