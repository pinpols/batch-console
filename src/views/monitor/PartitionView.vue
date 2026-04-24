<template>
  <PageContainer>
    <PageHeader
      title="Job Partition"
      :description="`实例 #${instanceId} 的分区列表`"
      :show-description="true"
      :back-to="`/monitor/job-instances/${instanceId}`"
    >
      <template #actions>
        <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ListPageQueryBar
        :filter-busy="false"
        :refresh-busy="loading"
        @search="applyFilter"
        @reset="resetFilter"
        @refresh="load"
      >
        <el-form-item label="状态">
          <el-select
            class="query-w-200"
            v-model="filterDraft.partitionStatus"
            clearable
            filterable
            placeholder="全部"
          >
            <el-option
              v-for="opt in partitionStatusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </ListPageQueryBar>
      <el-table
        v-loading="loading"
        :data="rows"
        stripe
        border
        empty-text="暂无数据"
        class="console-table"
      >
        <el-table-column prop="partitionNo" label="分区" width="90" />
        <el-table-column prop="partitionKey" label="分区键" min-width="160" show-overflow-tooltip />
        <el-table-column prop="partitionStatus" label="状态" width="140">
          <template #default="{ row }">
            <StatusTag :value="String(row.partitionStatus ?? '')" category="partition" />
          </template>
        </el-table-column>
        <el-table-column prop="workerGroup" label="Worker 组" width="140" show-overflow-tooltip />
        <el-table-column prop="workerCode" label="Worker" width="140" show-overflow-tooltip />
        <el-table-column prop="retryCount" label="重试" width="70" />
        <DatetimeColumn prop="leaseExpireAt" label="Lease 过期" width="160" />
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
      <TablePagerBar
        :page="page"
        :page-size="pageSize"
        :total="total"
        @update:page="onPageChange"
        @update:page-size="
          (s: number) => {
            pageSize = s
            page = 1
            void load()
          }
        "
      />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch, reactive } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { instanceApi } from '@/api/instance'
  import { queryPartitionsPaged, type ConsoleJobPartitionResponse } from '@/api/queries/partitions'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'

  const route = useRoute()
  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<ConsoleJobPartitionResponse[]>([])
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)

  const instanceId = computed(() => Number(route.params.id))

  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const partitionStatusOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'partitionStatus'),
  )

  const filterDraft = reactive({ partitionStatus: '' })
  const filterApplied = reactive({ partitionStatus: '' })

  async function load() {
    if (!Number.isFinite(instanceId.value)) return
    loading.value = true
    try {
      const pr = await queryPartitionsPaged({
        tenantId: tenant.tenantId,
        jobInstanceId: instanceId.value,
        partitionStatus: filterApplied.partitionStatus,
        page: page.value,
        pageSize: pageSize.value,
      })
      rows.value = pr.records
      total.value = pr.total
    } finally {
      loading.value = false
    }
  }

  function applyFilter() {
    filterApplied.partitionStatus = filterDraft.partitionStatus
    page.value = 1
    void load()
  }

  function resetFilter() {
    filterDraft.partitionStatus = ''
    filterApplied.partitionStatus = ''
    page.value = 1
    void load()
  }

  function onPageChange(p: number) {
    page.value = p
    void load()
  }

  async function cancelPartition(row: ConsoleJobPartitionResponse) {
    try {
      await ElMessageBox.confirm(`取消分片 #${row.id}？`, '取消确认', { type: 'warning' })
      await instanceApi.cancelPartition(row.id, tenant.tenantId)
      ElMessage.success('已取消')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function retryPartition(row: ConsoleJobPartitionResponse) {
    try {
      await ElMessageBox.confirm(`重试分片 #${row.id}？`, '重试确认', { type: 'warning' })
      await instanceApi.retryPartition(row.id, tenant.tenantId)
      ElMessage.success('已发起重试')
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)

  watch(instanceId, () => {
    void load()
  })
</script>
