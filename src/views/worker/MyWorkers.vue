<template>
  <PageContainer>
    <PageHeader :title="t('myWorkers.title')" :description="t('myWorkers.description')">
      <template #actions>
        <el-button :loading="loading" @click="onRefresh">
          {{ t('myWorkers.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <div class="metric-row">
      <MetricCard
        :label="t('myWorkers.countLabel')"
        :value="count"
        tone="info"
        :description="t('myWorkers.countDescription')"
      />
    </div>

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="loading"
        :error="loadError"
        :on-retry="onRefresh"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="() => {}"
      >
        <el-table-column prop="workerCode" :label="t('myWorkers.colWorkerCode')" min-width="140">
          <template #default="{ row }">
            <CopyableText :text="row.workerCode" />
          </template>
        </el-table-column>
        <el-table-column prop="workerGroup" :label="t('myWorkers.colGroup')" width="120" />
        <el-table-column prop="status" :label="t('myWorkers.colStatus')" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.status ?? '')" category="worker" />
          </template>
        </el-table-column>
        <el-table-column prop="currentLoad" :label="t('myWorkers.colLoad')" width="80" />
        <DatetimeColumn prop="heartbeatAt" :label="t('myWorkers.colHeartbeat')" width="160" />

        <template #empty>
          <EmptyState variant="tenant-empty" :description="t('myWorkers.empty')" />
        </template>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
  import { useListLoadState } from '@/composables/useListLoadState'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useSseAutoReload } from '@/composables/useSseAutoReload'
  import { listMyWorkers, countMyWorkers } from '@/api/myWorkers'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import MetricCard from '@/components/common/MetricCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import type { ConsoleWorkerRegistryResponse } from '@/types/console-api'

  const tenant = useTenantStore()

  const page = ref(1)
  const pageSize = ref(15)
  const count = ref(0)
  const allWorkers = ref<ConsoleWorkerRegistryResponse[]>([])

  const { loading, error: loadError, run } = useListLoadState()

  const total = computed(() => allWorkers.value.length)
  const rows = computed(() => {
    const pr = toPageResult(allWorkers.value, page.value, pageSize.value)
    return pr.records as ConsoleWorkerRegistryResponse[]
  })

  async function loadData() {
    await run(async () => {
      const [list, c] = await Promise.all([
        listMyWorkers(tenant.tenantId),
        countMyWorkers(tenant.tenantId),
      ])
      allWorkers.value = list ?? []
      count.value = typeof c === 'number' ? c : (list?.length ?? 0)
      page.value = 1
    })
  }

  function onRefresh() {
    return loadData()
  }

  useTenantReload(loadData)

  useSseAutoReload({
    domain: 'workers',
    reload: loadData,
    scope: () => tenant.tenantId,
  })
</script>

<style scoped>
  .metric-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 240px));
    gap: var(--space-sm);
  }
</style>
