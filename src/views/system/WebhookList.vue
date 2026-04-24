<template>
  <PageContainer>
    <PageHeader title="Webhook 管理" description="Webhook 端点 CRUD 及投递日志查看。">
      <template #actions>
        <el-button type="primary" :icon="Plus" class="pretty-add-button" @click="openCreate">
          新增 Webhook
        </el-button>
        <el-button :loading="loading" @click="load">刷新</el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ProTable
        :data="pagedRows"
        :loading="loading"
        :total="filteredRows.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :has-active-filters="hasActiveFilters"
        @change="() => {}"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loading"
            @search="applyFilter"
            @reset="resetFilter"
            @refresh="load"
          >
            <el-form-item label="关键字">
              <el-input
                class="query-w-280"
                v-model="filterDraft.keyword"
                clearable
                placeholder="搜索 URL / 事件类型"
                @keyup.enter="applyFilter"
              />
            </el-form-item>
            <el-form-item label="启用">
              <el-select
                class="query-w-140"
                v-model="filterDraft.enabled"
                clearable
                placeholder="全部"
              >
                <el-option label="已启用" :value="true" />
                <el-option label="已停用" :value="false" />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="url" label="URL" min-width="250" show-overflow-tooltip />
        <el-table-column prop="eventTypes" label="事件类型" min-width="160" show-overflow-tooltip />
        <el-table-column prop="enabled" label="启用" width="80">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button size="small" plain @click="viewLogs(row)">投递日志</el-button>
              <el-button size="small" plain type="danger" @click="confirmDelete(row)"
                >删除</el-button
              >
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-dialog
      v-model="formVisible"
      :title="editingId ? '编辑 Webhook' : '新增 Webhook'"
      width="560px"
    >
      <el-form label-width="100px">
        <el-form-item label="URL">
          <el-input v-model="form.url" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="事件类型">
          <el-input v-model="form.eventTypes" placeholder="逗号分隔，如 JOB_COMPLETED,JOB_FAILED" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logVisible" title="投递日志" width="800px">
      <el-table :data="deliveryLogs" border size="small" height="400" class="console-table">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="eventType" label="事件" width="160" />
        <el-table-column prop="httpStatus" label="HTTP" width="80" />
        <el-table-column prop="responseBody" label="响应" min-width="200" show-overflow-tooltip />
        <DatetimeColumn prop="createdAt" label="时间" width="160" />
      </el-table>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import { toPageResult } from '@/api/adapters'
  import {
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    listWebhookDeliveryLogs,
  } from '@/api/webhooks'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'

  const tenant = useTenantStore()
  const loading = ref(false)
  const saving = ref(false)
  const formVisible = ref(false)
  const logVisible = ref(false)
  const editingId = ref<number | null>(null)
  const rows = ref<Record<string, unknown>[]>([])
  const filterDraft = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const filterApplied = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const page = ref(1)
  const pageSize = ref(20)

  const filteredRows = computed(() => {
    const k = filterApplied.keyword.trim().toLowerCase()
    const en = filterApplied.enabled
    return rows.value.filter((row) => {
      const okEnabled = en === undefined ? true : !!row.enabled === en
      if (!okEnabled) return false
      if (!k) return true
      const hay = `${row.url ?? ''} ${row.eventTypes ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  const hasActiveFilters = computed(
    () => !!filterApplied.keyword.trim() || filterApplied.enabled !== undefined,
  )

  const pagedRows = computed(
    () =>
      toPageResult(filteredRows.value, page.value, pageSize.value).records as unknown as Record<
        string,
        unknown
      >[],
  )
  const deliveryLogs = ref<Record<string, unknown>[]>([])
  const form = reactive({ url: '', eventTypes: '', enabled: true })

  async function load() {
    loading.value = true
    try {
      rows.value = (await listWebhooks(tenant.tenantId)) as Record<string, unknown>[]
    } catch {
      rows.value = []
    } finally {
      loading.value = false
    }
  }

  function applyFilter() {
    filterApplied.keyword = filterDraft.keyword.trim()
    filterApplied.enabled = filterDraft.enabled
    page.value = 1
  }

  function resetFilter() {
    filterDraft.keyword = ''
    filterDraft.enabled = undefined
    applyFilter()
  }

  function openCreate() {
    editingId.value = null
    form.url = ''
    form.eventTypes = ''
    form.enabled = true
    formVisible.value = true
  }

  function openEdit(row: Record<string, unknown>) {
    editingId.value = row.id as number
    form.url = String(row.url ?? '')
    form.eventTypes = String(row.eventTypes ?? '')
    form.enabled = !!row.enabled
    formVisible.value = true
  }

  async function save() {
    saving.value = true
    try {
      const body = {
        tenantId: tenant.tenantId,
        url: form.url,
        eventTypes: form.eventTypes,
        enabled: form.enabled,
      }
      if (editingId.value) await updateWebhook(editingId.value, body)
      else await createWebhook(body)
      ElMessage.success('已保存')
      formVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  async function confirmDelete(row: Record<string, unknown>) {
    try {
      await ElMessageBox.confirm(`删除 Webhook #${row.id}？`, '删除确认', { type: 'warning' })
      await deleteWebhook(row.id as number, tenant.tenantId)
      ElMessage.success('已删除')
      await load()
    } catch {
      /* cancel */
    }
  }

  async function viewLogs(row: Record<string, unknown>) {
    deliveryLogs.value = (await listWebhookDeliveryLogs(
      tenant.tenantId,
      row.id as number,
    )) as Record<string, unknown>[]
    logVisible.value = true
  }

  useTenantReload(load)
</script>

<style scoped></style>
