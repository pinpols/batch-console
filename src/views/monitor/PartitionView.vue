<template>
  <PageContainer>
    <PageHeader
      title="Job Step Instance"
      :description="`实例 #${instanceId} 的步骤分片列表`"
      :show-description="true"
      :back-to="`/monitor/job-instances/${instanceId}`"
    >
      <template #actions>
        <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <el-table
        v-loading="loading"
        :data="rows"
        stripe
        border
        empty-text="暂无数据"
        class="console-table"
      >
        <el-table-column prop="stepCode" label="步骤" width="140" />
        <el-table-column prop="stepType" label="类型" width="100" />
        <el-table-column prop="stepStatus" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.stepStatus ?? '')" category="partition" />
          </template>
        </el-table-column>
        <el-table-column prop="retryCount" label="重试" width="70" />
        <el-table-column prop="errorCode" label="错误码" width="120" show-overflow-tooltip />
        <el-table-column
          prop="errorMessage"
          label="错误信息"
          min-width="160"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="startedAt" label="开始" width="160" />
        <DatetimeColumn prop="finishedAt" label="结束" width="160" />
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="warning" @click="retryPartition(row)"
                >重试</el-button
              >
              <el-button size="small" plain type="danger" @click="cancelPartition(row)"
                >取消</el-button
              >
            </div>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { instanceApi } from '@/api/instance'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleJobStepInstanceResponse } from '@/types/console-api'

  const route = useRoute()
  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleJobStepInstanceResponse[]>([])

  const instanceId = computed(() => Number(route.params.id))

  async function load() {
    if (!Number.isFinite(instanceId.value)) return
    loading.value = true
    try {
      rows.value = await instanceApi.partitions(instanceId.value, tenant.tenantId)
    } finally {
      loading.value = false
    }
  }

  async function cancelPartition(row: ConsoleJobStepInstanceResponse) {
    try {
      await ElMessageBox.confirm(`取消分片 #${row.id}？`, '取消确认', { type: 'warning' })
      await instanceApi.cancelPartition(row.id, tenant.tenantId)
      ElMessage.success('已取消')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function retryPartition(row: ConsoleJobStepInstanceResponse) {
    try {
      await ElMessageBox.confirm(`重试分片 #${row.id}？`, '重试确认', { type: 'warning' })
      await instanceApi.retryPartition(row.id, tenant.tenantId)
      ElMessage.success('已发起重试')
      await load()
    } catch {
      /* cancel */
    }
  }

  watch(
    () => [instanceId.value, tenant.tenantId] as const,
    () => load(),
    { immediate: true },
  )
</script>
