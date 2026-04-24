<template>
  <PageContainer>
    <PageHeader
      title="Trigger 管理"
      description="Job Trigger 注册、注销、暂停与恢复。"
      :show-description="true"
    />

    <SectionCard>
      <ProTable
        :data="pagedRows"
        :loading="loading"
        :total="filtered.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :has-active-filters="!!keyword"
        @change="() => {}"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="onReset"
            @refresh="load"
          >
            <el-form-item label="Job Code">
              <el-input
                class="query-w-220"
                v-model="kwDraft"
                clearable
                placeholder="按 Job Code 模糊搜索"
                @keyup.enter="onSearch"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="jobCode" label="Job Code" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <CopyableText :text="String(row.jobCode ?? '')" />
          </template>
        </el-table-column>
        <el-table-column prop="triggerType" label="类型" width="120">
          <template #default="{ row }">
            {{ row.triggerType || '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="triggerStatus" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag
              v-if="row.triggerStatus || row.status"
              :value="String(row.triggerStatus ?? row.status ?? '')"
              category="trigger"
            />
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column label="Cron 表达式" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <code v-if="row.cronExpression" class="cell-code">{{ row.cronExpression }}</code>
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <DatetimeColumn prop="nextFireTime" label="下次触发" width="160" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                plain
                type="primary"
                v-track-click="{ action: '注册 Trigger', jobCode: row.jobCode }"
                @click="doRegister(row)"
                >注册</el-button
              >
              <el-button
                size="small"
                plain
                type="danger"
                v-track-click="{ action: '注销 Trigger', jobCode: row.jobCode }"
                @click="doUnregister(row)"
                >注销</el-button
              >
              <el-button
                size="small"
                plain
                type="warning"
                v-track-click="{ action: '暂停 Trigger', jobCode: row.jobCode }"
                @click="doPause(row)"
                >暂停</el-button
              >
              <el-button
                size="small"
                plain
                type="success"
                v-track-click="{ action: '恢复 Trigger', jobCode: row.jobCode }"
                @click="doResume(row)"
                >恢复</el-button
              >
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    listTriggers,
    registerTrigger,
    unregisterTrigger,
    pauseTrigger,
    resumeTrigger,
  } from '@/api/triggers'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'

  const tenant = useTenantStore()
  const loading = ref(false)
  const allRows = ref<Record<string, unknown>[]>([])
  const page = ref(1)
  const pageSize = ref(20)
  const kwDraft = ref('')
  const keyword = ref('')

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return allRows.value
    return allRows.value.filter((r) =>
      String(r.jobCode ?? '')
        .toLowerCase()
        .includes(k),
    )
  })

  const pagedRows = computed(
    () =>
      toPageResult(filtered.value, page.value, pageSize.value).records as unknown as Record<
        string,
        unknown
      >[],
  )

  function onSearch() {
    keyword.value = kwDraft.value
    page.value = 1
  }
  function onReset() {
    kwDraft.value = ''
    keyword.value = ''
    page.value = 1
  }

  async function load() {
    loading.value = true
    try {
      allRows.value = (await listTriggers(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      allRows.value = []
    } finally {
      loading.value = false
    }
  }

  async function doRegister(row: Record<string, unknown>) {
    try {
      await ElMessageBox.confirm(`注册 Trigger：${row.jobCode}？`, '注册确认', { type: 'info' })
      await registerTrigger(String(row.jobCode), tenant.tenantId)
      ElMessage.success('已注册')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doUnregister(row: Record<string, unknown>) {
    try {
      await ElMessageBox.confirm(`注销 Trigger：${row.jobCode}？`, '注销确认', { type: 'warning' })
      await unregisterTrigger(String(row.jobCode), tenant.tenantId)
      ElMessage.success('已注销')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doPause(row: Record<string, unknown>) {
    try {
      await ElMessageBox.confirm(`暂停 Trigger：${row.jobCode}？`, '暂停确认', { type: 'warning' })
      await pauseTrigger(String(row.jobCode), tenant.tenantId)
      ElMessage.success('已暂停')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doResume(row: Record<string, unknown>) {
    try {
      await resumeTrigger(String(row.jobCode), tenant.tenantId)
      ElMessage.success('已恢复')
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)
</script>

<style scoped></style>
