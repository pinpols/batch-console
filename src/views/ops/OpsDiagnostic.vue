<template>
  <PageContainer>
    <PageHeader
      title="运维诊断"
      description="Kafka Lag、Outbox 运维工具与集群健康诊断。"
      :show-description="true"
    />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <!-- 工具箱 -->
        <el-tab-pane label="运维工具箱" name="toolbox">
          <div class="data-panel">
            <div class="section-toolbar">
              <h3 class="section-title u-mb-0">Kafka Lag</h3>
              <span class="u-flex-1" />
              <el-button :loading="loadingLag" @click="loadKafkaLag">刷新</el-button>
            </div>
            <pre v-if="kafkaLag" class="json-preview">{{ JSON.stringify(kafkaLag, null, 2) }}</pre>
            <el-empty v-else description="暂无数据" />
          </div>

          <div class="data-panel">
            <div class="section-toolbar">
              <h3 class="section-title u-mb-0">Outbox 统计</h3>
              <span class="u-flex-1" />
              <el-button :loading="loadingOutbox" @click="loadOutboxStats">刷新</el-button>
              <el-button
                type="warning"
                :loading="cleaning"
                v-track-click="'Outbox 清理'"
                @click="doCleanup"
                >清理</el-button
              >
              <el-button
                type="primary"
                :loading="republishing"
                v-track-click="'Outbox 重发布'"
                @click="doRepublish"
                >重发布</el-button
              >
            </div>
            <pre v-if="outboxStats" class="json-preview">{{
              JSON.stringify(outboxStats, null, 2)
            }}</pre>
            <el-empty v-else description="暂无数据" />
          </div>
        </el-tab-pane>

        <!-- 集群诊断 -->
        <el-tab-pane label="集群诊断" name="cluster">
          <div class="section-toolbar">
            <span class="u-flex-1" />
            <el-button type="primary" :loading="loadingCluster" @click="loadCluster"
              >全部刷新</el-button
            >
          </div>

          <div class="data-panel">
            <h3 class="section-title">集群概览</h3>
            <pre v-if="clusterData" class="json-preview">{{
              JSON.stringify(clusterData, null, 2)
            }}</pre>
            <el-empty v-else description="暂无数据" />
          </div>

          <div class="data-panel">
            <h3 class="section-title">ShedLock 状态</h3>
            <el-table
              v-if="shedLockRows.length"
              :data="shedLockRows"
              stripe
              border
              size="small"
              class="console-table"
            >
              <el-table-column
                prop="name"
                label="Lock 名称"
                min-width="200"
                show-overflow-tooltip
              />
              <el-table-column prop="lockUntil" label="Lock Until" width="200" />
              <DatetimeColumn prop="lockedAt" label="Locked At" width="160" />
              <el-table-column
                prop="lockedBy"
                label="Locked By"
                min-width="180"
                show-overflow-tooltip
              />
            </el-table>
            <pre v-else-if="shedLockRaw" class="json-preview">{{
              JSON.stringify(shedLockRaw, null, 2)
            }}</pre>
            <el-empty v-else description="暂无数据" />
          </div>

          <div class="data-panel">
            <h3 class="section-title">Worker 一致性</h3>
            <pre v-if="workerConsistency" class="json-preview">{{
              JSON.stringify(workerConsistency, null, 2)
            }}</pre>
            <el-empty v-else description="暂无数据" />
          </div>

          <div class="data-panel">
            <h3 class="section-title">Outbox 健康</h3>
            <pre v-if="outboxHealth" class="json-preview">{{
              JSON.stringify(outboxHealth, null, 2)
            }}</pre>
            <el-empty v-else description="暂无数据" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { getKafkaLag, getOutboxStats, cleanupOutbox, republishOutbox } from '@/api/ops'
  import {
    getClusterDiagnostic,
    getShedLockStatus,
    getWorkerConsistency,
    getOutboxHealth,
  } from '@/api/clusterDiagnostic'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
  const activeTab = ref('toolbox')

  // ── 工具箱 ──
  const loadingLag = ref(false)
  const loadingOutbox = ref(false)
  const cleaning = ref(false)
  const republishing = ref(false)
  const kafkaLag = ref<unknown>(null)
  const outboxStats = ref<unknown>(null)

  async function loadKafkaLag() {
    loadingLag.value = true
    try {
      kafkaLag.value = await getKafkaLag(tenant.tenantId)
    } catch {
      kafkaLag.value = null
    } finally {
      loadingLag.value = false
    }
  }

  async function loadOutboxStats() {
    loadingOutbox.value = true
    try {
      outboxStats.value = await getOutboxStats(tenant.tenantId)
    } catch {
      outboxStats.value = null
    } finally {
      loadingOutbox.value = false
    }
  }

  async function doCleanup() {
    try {
      await ElMessageBox.confirm('确认清理 Outbox？', '清理确认', { type: 'warning' })
      cleaning.value = true
      await cleanupOutbox(tenant.tenantId)
      ElMessage.success('清理完成')
      await loadOutboxStats()
    } catch {
      /* cancel */
    } finally {
      cleaning.value = false
    }
  }

  async function doRepublish() {
    try {
      await ElMessageBox.confirm('确认重发布 Outbox？', '重发布确认', { type: 'warning' })
      republishing.value = true
      await republishOutbox(tenant.tenantId)
      ElMessage.success('已发起重发布')
      await loadOutboxStats()
    } catch {
      /* cancel */
    } finally {
      republishing.value = false
    }
  }

  // ── 集群诊断 ──
  const loadingCluster = ref(false)
  const clusterData = ref<unknown>(null)
  const shedLockRaw = ref<unknown>(null)
  const shedLockRows = ref<Record<string, unknown>[]>([])
  const workerConsistency = ref<unknown>(null)
  const outboxHealth = ref<unknown>(null)

  async function loadCluster() {
    loadingCluster.value = true
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
      loadingCluster.value = false
    }
  }

  function loadAll() {
    void loadKafkaLag()
    void loadOutboxStats()
    void loadCluster()
  }

  useTenantReload(loadAll)
</script>

<style scoped></style>
