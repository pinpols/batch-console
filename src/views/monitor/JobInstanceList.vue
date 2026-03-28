<template>
  <PageContainer>
    <PageHeader
      title="Job Instance 列表"
      description="执行实例、状态和分片进度的第一阶段页面骨架。"
    >
      <template #actions>
        <el-button>导出</el-button>
        <el-button type="primary" @click="loadData">刷新</el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <template #header>
        <span>查询与列表</span>
      </template>

      <el-form :model="query" inline class="query-form">
        <el-form-item label="Job Code">
          <el-input v-model="query.jobCode" clearable placeholder="Job Code" style="width: 160px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.instanceStatus" clearable placeholder="全部" style="width: 140px">
            <el-option
              v-for="option in statusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="~"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            @change="onDateChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rows" v-loading="loading" stripe>
        <el-table-column prop="instanceNo" label="实例编号" width="180" />
        <el-table-column prop="jobCode" label="Job Code" width="160" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <StatusTag :value="row.instanceStatus" />
          </template>
        </el-table-column>
        <el-table-column label="分片进度" width="160">
          <template #default="{ row }">
            {{ row.completedPartitionCount }}/{{ row.expectedPartitionCount }}
            <span v-if="row.failedPartitionCount > 0" class="failure-hint">
              (失败 {{ row.failedPartitionCount }})
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="startedAt" label="开始时间" width="170" />
        <el-table-column prop="finishedAt" label="结束时间" width="170" />
        <el-table-column label="操作" fixed="right" width="180">
          <template #default="{ row }">
            <el-button link @click="viewDetail(row)">详情</el-button>
            <el-button link @click="viewPartitions(row)">分片</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @change="loadData"
        />
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { instanceApi } from '@/api/instance'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { JobInstance } from '@/types'

  const router = useRouter()
  const tenant = useTenantStore()
  const loading = ref(false)
  const rows = ref<JobInstance[]>([])
  const total = ref(0)
  const dateRange = ref<[string, string] | null>(null)

  const query = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    instanceStatus: '',
    startDate: '',
    endDate: '',
    page: 1,
    pageSize: 20,
  })

  watch(
    () => tenant.tenantId,
    (id) => {
      query.tenantId = id
      query.page = 1
      loadData()
    },
  )

  const statusOptions = [
    { label: 'CREATED', value: 'CREATED' },
    { label: 'WAITING', value: 'WAITING' },
    { label: 'RUNNING', value: 'RUNNING' },
    { label: 'COMPLETED', value: 'COMPLETED' },
    { label: 'FAILED', value: 'FAILED' },
    { label: 'CANCELLED', value: 'CANCELLED' },
  ]

  function onDateChange(val: [string, string] | null) {
    query.startDate = val?.[0] ?? ''
    query.endDate = val?.[1] ?? ''
  }

  function resetQuery() {
    query.jobCode = ''
    query.instanceStatus = ''
    query.startDate = ''
    query.endDate = ''
    dateRange.value = null
    query.page = 1
    loadData()
  }

  async function loadData() {
    loading.value = true
    try {
      const result = await instanceApi.list(query)
      rows.value = result.records
      total.value = result.total
    } finally {
      loading.value = false
    }
  }

  function viewDetail(row: JobInstance) {
    router.push(`/monitor/job-instances/${row.id}`)
  }

  function viewPartitions(row: JobInstance) {
    router.push(`/monitor/job-instances/${row.id}/partitions`)
  }

  onMounted(() => {
    query.tenantId = tenant.tenantId
    loadData()
  })
</script>

<style scoped>
  .query-form {
    margin-bottom: var(--space-md);
  }

  .pager {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--space-lg);
  }

  .failure-hint {
    color: var(--color-danger);
  }
</style>
