<template>
  <PageContainer>
    <PageHeader title="运维工具箱" description="Kafka Lag、Outbox 统计、清理与重发布。" />

    <SectionCard>
      <div class="section-toolbar">
        <h3 class="section-title" style="margin-bottom: 0; flex: 1">Kafka Lag</h3>
        <el-button :loading="loadingLag" @click="loadKafkaLag">刷新</el-button>
      </div>
      <pre v-if="kafkaLag" class="json-preview">{{ JSON.stringify(kafkaLag, null, 2) }}</pre>
      <el-empty v-else description="暂无数据" />
    </SectionCard>

    <SectionCard>
      <div class="section-toolbar">
        <h3 class="section-title" style="margin-bottom: 0; flex: 1">Outbox 统计</h3>
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
      <pre v-if="outboxStats" class="json-preview">{{ JSON.stringify(outboxStats, null, 2) }}</pre>
      <el-empty v-else description="暂无数据" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { getKafkaLag, getOutboxStats, cleanupOutbox, republishOutbox } from '@/api/ops'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'

  const tenant = useTenantStore()
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

  function loadAll() {
    void loadKafkaLag()
    void loadOutboxStats()
  }

  watch(() => tenant.tenantId, loadAll)
  onMounted(loadAll)
</script>

<style scoped></style>
