<template>
  <PageContainer>
    <PageHeader
      title="集群诊断"
      description="集群健康状态、ShedLock、Worker 一致性、Outbox 健康检查。"
    >
      <template #actions>
        <el-button type="primary" :loading="loading" @click="loadAll">全部刷新</el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <h3 class="section-title">集群概览</h3>
      <pre v-if="clusterData" class="json-preview">{{ JSON.stringify(clusterData, null, 2) }}</pre>
      <el-empty v-else description="暂无数据" />
    </SectionCard>

    <SectionCard>
      <h3 class="section-title">ShedLock 状态</h3>
      <el-table
        v-if="shedLockRows.length"
        :data="shedLockRows"
        stripe
        border
        size="small"
        class="console-table"
      >
        <el-table-column prop="name" label="Lock 名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="lockUntil" label="Lock Until" width="200" />
        <DatetimeColumn prop="lockedAt" label="Locked At" width="160" />
        <el-table-column prop="lockedBy" label="Locked By" min-width="180" show-overflow-tooltip />
      </el-table>
      <pre v-else-if="shedLockRaw" class="json-preview">{{
        JSON.stringify(shedLockRaw, null, 2)
      }}</pre>
      <el-empty v-else description="暂无数据" />
    </SectionCard>

    <SectionCard>
      <h3 class="section-title">Worker 一致性</h3>
      <pre v-if="workerConsistency" class="json-preview">{{
        JSON.stringify(workerConsistency, null, 2)
      }}</pre>
      <el-empty v-else description="暂无数据" />
    </SectionCard>

    <SectionCard>
      <h3 class="section-title">Outbox 健康</h3>
      <pre v-if="outboxHealth" class="json-preview">{{
        JSON.stringify(outboxHealth, null, 2)
      }}</pre>
      <el-empty v-else description="暂无数据" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import {
    getClusterDiagnostic,
    getShedLockStatus,
    getWorkerConsistency,
    getOutboxHealth,
  } from '@/api/clusterDiagnostic'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
  const loading = ref(false)
  const clusterData = ref<unknown>(null)
  const shedLockRaw = ref<unknown>(null)
  const shedLockRows = ref<Record<string, unknown>[]>([])
  const workerConsistency = ref<unknown>(null)
  const outboxHealth = ref<unknown>(null)

  async function loadAll() {
    loading.value = true
    try {
      const [cluster, shedLock, workers, outbox] = await Promise.all([
        getClusterDiagnostic(tenant.tenantId).catch(() => null),
        getShedLockStatus(tenant.tenantId).catch(() => null),
        getWorkerConsistency(tenant.tenantId).catch(() => null),
        getOutboxHealth(tenant.tenantId).catch(() => null),
      ])
      clusterData.value = cluster
      shedLockRaw.value = shedLock
      shedLockRows.value = Array.isArray(shedLock) ? (shedLock as Record<string, unknown>[]) : []
      workerConsistency.value = workers
      outboxHealth.value = outbox
    } finally {
      loading.value = false
    }
  }

  watch(
    () => tenant.tenantId,
    () => loadAll(),
  )
  onMounted(loadAll)
</script>

<style scoped></style>
