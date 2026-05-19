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
      :has-active-filters="hasActiveWebhookFilters"
    >
      <template v-if="!hasActiveWebhookFilters" #empty>
        <EmptyState :description="t('notificationWebhooksTab.emptyDescription')" :image-size="80">
          <template #action>
            <el-button type="primary" :icon="Plus" @click="openWebhookCreate">
              {{ t('notificationCommon.btnAdd') }}
            </el-button>
          </template>
        </EmptyState>
      </template>
      <template #query>
        <ListPageQueryBar
          :filter-busy="filterBusy"
          :refresh-busy="loadingWebhooks"
          @search="applyWebhookFilter"
          @reset="resetWebhookFilter"
          @refresh="() => runRefresh(loadWebhooks)"
        >
          <el-form-item :label="t('notificationWebhooksTab.kwLabel')">
            <el-input
              class="query-w-280"
              v-model="webhookFilterDraft.keyword"
              clearable
              :placeholder="t('notificationWebhooksTab.kwPlaceholder')"
              @keyup.enter="applyWebhookFilter"
            />
          </el-form-item>
          <el-form-item :label="t('notificationCommon.enabledLabel')">
            <el-select
              class="query-w-140"
              v-model="webhookFilterDraft.enabled"
              clearable
              :placeholder="t('notificationCommon.allPlaceholder')"
            >
              <el-option :label="t('notificationCommon.optEnabled')" :value="true" />
              <el-option :label="t('notificationCommon.optDisabled')" :value="false" />
            </el-select>
          </el-form-item>
        </ListPageQueryBar>
      </template>
      <el-table-column prop="id" :label="t('notificationWebhooksTab.colId')" width="80" />
      <el-table-column
        prop="name"
        :label="t('notificationWebhooksTab.colName')"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column
        prop="callbackUrl"
        :label="t('notificationWebhooksTab.colUrl')"
        min-width="250"
        show-overflow-tooltip
      />
      <el-table-column
        prop="eventTypes"
        :label="t('notificationWebhooksTab.colEventTypes')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column prop="enabled" :label="t('notificationCommon.colEnabled')" width="80">
        <template #default="{ row }">
          <StatusTag :value="String(row.enabled)" category="yn" />
        </template>
      </el-table-column>
      <el-table-column :label="t('notificationCommon.colActions')" width="220" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button size="small" plain type="primary" @click="openWebhookEdit(row)">
              {{ t('notificationCommon.btnEdit') }}
            </el-button>
            <el-button size="small" plain @click="viewWebhookLogs(row)">
              {{ t('notificationWebhooksTab.btnDeliveryLogs') }}
            </el-button>
            <el-button size="small" plain type="danger" @click="confirmDeleteWebhook(row)">
              {{ t('notificationCommon.btnDelete') }}
            </el-button>
          </div>
        </template>
      </el-table-column>
    </ProTable>

    <el-drawer
      :append-to-body="true"
      v-model="webhookFormVisible"
      :title="
        webhookEditingId
          ? t('notificationWebhooksTab.dialogTitleEdit')
          : t('notificationWebhooksTab.dialogTitleCreate')
      "
      direction="rtl"
      size="640px"
    >
      <el-form
        ref="webhookFormRef"
        :model="webhookForm"
        :rules="webhookFormRules"
        label-width="88px"
      >
        <el-form-item :label="t('notificationWebhooksTab.fieldName')" prop="name">
          <el-input
            v-model="webhookForm.name"
            :placeholder="t('notificationWebhooksTab.namePlaceholder')"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('notificationWebhooksTab.fieldUrl')" prop="callbackUrl">
          <el-input
            v-model="webhookForm.callbackUrl"
            :placeholder="t('notificationWebhooksTab.urlPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('notificationWebhooksTab.fieldEventTypes')" prop="eventTypes">
          <el-input
            v-model="webhookForm.eventTypes"
            :placeholder="t('notificationWebhooksTab.eventTypesPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('notificationWebhooksTab.fieldSecret')" prop="secret">
          <el-input
            v-model="webhookForm.secret"
            :placeholder="t('notificationWebhooksTab.secretPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('notificationCommon.enabledLabel')" prop="enabled">
          <el-switch v-model="webhookForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="webhookFormVisible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="savingWebhook" @click="saveWebhook">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>

    <el-dialog
      v-model="webhookLogVisible"
      :title="t('notificationWebhooksTab.deliveryLogDialogTitle')"
      width="800px"
    >
      <el-table :data="webhookDeliveryLogs" border size="small" height="400" class="console-table">
        <el-table-column prop="id" :label="t('notificationWebhooksTab.colId')" width="80" />
        <el-table-column
          prop="eventType"
          :label="t('notificationWebhooksTab.logColEvent')"
          width="160"
        />
        <el-table-column
          prop="httpStatus"
          :label="t('notificationWebhooksTab.logColHttp')"
          width="80"
        />
        <el-table-column
          prop="responseBody"
          :label="t('notificationWebhooksTab.logColResponse')"
          min-width="200"
          show-overflow-tooltip
        />
        <DatetimeColumn
          prop="createdAt"
          :label="t('notificationWebhooksTab.logColTime')"
          width="160"
        />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
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
  import EmptyState from '@/components/common/EmptyState.vue'
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
  const webhookPageSize = ref(15)
  const webhookFilterDraft = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const webhookFilterApplied = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const hasActiveWebhookFilters = computed(
    () => !!(webhookFilterApplied.keyword.trim() || webhookFilterApplied.enabled !== undefined),
  )
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
    name: [rules.required(t('notificationWebhooksTab.ruleName')), rules.maxLength(128)],
    callbackUrl: [
      rules.required(t('notificationWebhooksTab.ruleUrl')),
      rules.pattern(/^https?:\/\/[^\s]+$/i, t('notificationWebhooksTab.ruleUrlPattern')),
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
      ElMessage.success(t('notificationCommon.savedToast'))
      webhookFormVisible.value = false
      await loadWebhooks()
    } finally {
      savingWebhook.value = false
    }
  }

  async function confirmDeleteWebhook(row: Record<string, unknown>) {
    try {
      await confirmDanger({
        verb: t('notificationCommon.deleteVerb'),
        target: t('notificationWebhooksTab.deleteTarget', {
          name: row.name || row.callbackUrl || '#' + row.id,
        }),
        consequence: t('notificationWebhooksTab.deleteConsequence'),
        irreversible: false,
      })
      await deleteWebhook(row.id as number, tenant.tenantId)
      ElMessage.success(t('notificationCommon.deletedToast'))
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

  defineExpose({ openWebhookCreate })
</script>
