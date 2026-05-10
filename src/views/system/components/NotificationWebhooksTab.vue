<template>
  <div>
    <ProTable
      :data="pagedWebhookRows"
      :loading="loadingWebhooks"
      :error="loadWebhooksError"
      :on-retry="loadWebhooks"
      :total="filteredWebhooks.length"
      v-model:page="webhookPage"
      v-model:page-size="webhookPageSize"
      @change="() => {}"
    >
      <template #query>
        <ListPageQueryBar
          :filter-busy="filterBusy"
          :refresh-busy="loadingWebhooks"
          @search="applyWebhookFilter"
          @reset="resetWebhookFilter"
          @refresh="() => runRefresh(loadWebhooks)"
        >
          <template #prepend>
            <el-button
              type="primary"
              :icon="Plus"
              class="pretty-add-button"
              @click="openWebhookCreate"
            >
              新增
            </el-button>
          </template>
          <el-form-item label="URL">
            <el-input
              class="query-w-280"
              v-model="webhookFilterDraft.keyword"
              clearable
              placeholder="搜索 URL / 事件类型"
              @keyup.enter="applyWebhookFilter"
            />
          </el-form-item>
          <el-form-item label="启用">
            <el-select
              class="query-w-140"
              v-model="webhookFilterDraft.enabled"
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
      <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="callbackUrl" label="URL" min-width="250" show-overflow-tooltip />
      <el-table-column prop="eventTypes" label="事件类型" min-width="160" show-overflow-tooltip />
      <el-table-column prop="enabled" label="启用" width="80">
        <template #default="{ row }">
          <StatusTag :value="String(row.enabled)" category="yn" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" plain type="primary" @click="openWebhookEdit(row)"
              >编辑</el-button
            >
            <el-button size="small" plain @click="viewWebhookLogs(row)">投递日志</el-button>
            <el-button size="small" plain type="danger" @click="confirmDeleteWebhook(row)"
              >删除</el-button
            >
          </div>
        </template>
      </el-table-column>
    </ProTable>

    <el-dialog
      v-model="webhookFormVisible"
      :title="webhookEditingId ? '编辑 Webhook' : '新增 Webhook'"
      width="560px"
    >
      <el-form
        ref="webhookFormRef"
        :model="webhookForm"
        :rules="webhookFormRules"
        label-width="100px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="webhookForm.name" placeholder="webhook 名称" maxlength="128" />
        </el-form-item>
        <el-form-item label="URL" prop="callbackUrl">
          <el-input v-model="webhookForm.callbackUrl" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="事件类型" prop="eventTypes">
          <el-input
            v-model="webhookForm.eventTypes"
            placeholder="逗号分隔，如 JOB_COMPLETED,JOB_FAILED"
          />
        </el-form-item>
        <el-form-item label="Secret" prop="secret">
          <el-input v-model="webhookForm.secret" placeholder="可选,签名密钥" />
        </el-form-item>
        <el-form-item label="启用" prop="enabled">
          <el-switch v-model="webhookForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="webhookFormVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingWebhook" @click="saveWebhook">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="webhookLogVisible" title="Webhook 投递日志" width="800px">
      <el-table :data="webhookDeliveryLogs" border size="small" height="400" class="console-table">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="eventType" label="事件" width="160" />
        <el-table-column prop="httpStatus" label="HTTP" width="80" />
        <el-table-column prop="responseBody" label="响应" min-width="200" show-overflow-tooltip />
        <DatetimeColumn prop="createdAt" label="时间" width="160" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormRules } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import {
    listWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    listWebhookDeliveryLogs,
  } from '@/api/webhooks'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'

  const tenant = useTenantStore()
  const {
    loading: loadingWebhooks,
    error: loadWebhooksError,
    run: runLoadingWebhooks,
  } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingWebhooks)
  const savingWebhook = ref(false)
  const webhookFormVisible = ref(false)
  const webhookLogVisible = ref(false)
  const webhookEditingId = ref<number | null>(null)
  const webhookRows = ref<Record<string, unknown>[]>([])
  const webhookPage = ref(1)
  const webhookPageSize = ref(20)
  const webhookFilterDraft = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const webhookFilterApplied = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const webhookDeliveryLogs = ref<Record<string, unknown>[]>([])
  const webhookForm = reactive({
    name: '',
    callbackUrl: '',
    eventTypes: '',
    secret: '',
    enabled: true,
  })

  const { formRef: webhookFormRef, validate: validateWebhookForm } = useFormValidate()
  const webhookFormRules: FormRules = {
    name: [rules.required('名称必填'), rules.maxLength(128)],
    callbackUrl: [
      rules.required('URL 必填'),
      rules.pattern(/^https?:\/\/[^\s]+$/i, 'URL 须以 http:// 或 https:// 开头'),
    ],
  }

  async function loadWebhooks() {
    await runLoadingWebhooks(async () => {
      webhookRows.value = (await listWebhooks(tenant.tenantId)) as Record<string, unknown>[]
    }).catch(() => {
      webhookRows.value = []
    })
  }

  function openWebhookCreate() {
    webhookEditingId.value = null
    webhookForm.name = ''
    webhookForm.callbackUrl = ''
    webhookForm.eventTypes = ''
    webhookForm.secret = ''
    webhookForm.enabled = true
    webhookFormVisible.value = true
  }

  function openWebhookEdit(row: Record<string, unknown>) {
    webhookEditingId.value = row.id as number
    webhookForm.name = String(row.name ?? '')
    webhookForm.callbackUrl = String(row.callbackUrl ?? '')
    webhookForm.eventTypes = String(row.eventTypes ?? '')
    webhookForm.secret = String(row.secret ?? '')
    webhookForm.enabled = !!row.enabled
    webhookFormVisible.value = true
  }

  async function saveWebhook() {
    if (!(await validateWebhookForm())) return
    savingWebhook.value = true
    try {
      const eventTypeList = webhookForm.eventTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const baseBody = {
        callbackUrl: webhookForm.callbackUrl,
        eventTypes: eventTypeList,
        secret: webhookForm.secret || undefined,
        enabled: webhookForm.enabled,
      }
      if (webhookEditingId.value) {
        await updateWebhook(webhookEditingId.value, tenant.tenantId, baseBody)
      } else {
        await createWebhook(tenant.tenantId, { name: webhookForm.name, ...baseBody })
      }
      ElMessage.success('已保存')
      webhookFormVisible.value = false
      await loadWebhooks()
    } finally {
      savingWebhook.value = false
    }
  }

  async function confirmDeleteWebhook(row: Record<string, unknown>) {
    try {
      await ElMessageBox.confirm(`删除 Webhook #${row.id}？`, '删除确认', { type: 'warning' })
      await deleteWebhook(row.id as number, tenant.tenantId)
      ElMessage.success('已删除')
      await loadWebhooks()
    } catch {
      /* cancel */
    }
  }

  async function viewWebhookLogs(row: Record<string, unknown>) {
    webhookDeliveryLogs.value = (await listWebhookDeliveryLogs(
      tenant.tenantId,
      row.id as number,
    )) as Record<string, unknown>[]
    webhookLogVisible.value = true
  }

  function normalize(s: unknown) {
    return String(s ?? '')
      .trim()
      .toLowerCase()
  }

  const filteredWebhooks = computed(() => {
    const k = normalize(webhookFilterApplied.keyword)
    const en = webhookFilterApplied.enabled
    return webhookRows.value.filter((row) => {
      const okEnabled = en === undefined ? true : !!row.enabled === en
      if (!okEnabled) return false
      if (!k) return true
      const hay = `${row.url ?? ''} ${row.eventTypes ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  const pagedWebhookRows = computed(
    () => toPageResult(filteredWebhooks.value, webhookPage.value, webhookPageSize.value).records,
  )

  function applyWebhookFilter() {
    return runSearch(() => {
      webhookFilterApplied.keyword = webhookFilterDraft.keyword.trim()
      webhookFilterApplied.enabled = webhookFilterDraft.enabled
      webhookPage.value = 1
    })
  }

  function resetWebhookFilter() {
    return runReset(() => {
      webhookFilterDraft.keyword = ''
      webhookFilterDraft.enabled = undefined
      webhookFilterApplied.keyword = ''
      webhookFilterApplied.enabled = undefined
      webhookPage.value = 1
    })
  }

  useTenantReload(() => {
    webhookPage.value = 1
    void loadWebhooks()
  })
</script>
