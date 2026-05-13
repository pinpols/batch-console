<template>
  <ProTable
    :data="rows"
    :loading="tableBlocking"
    :total="total"
    v-model:page="page"
    v-model:page-size="pageSize"
    @change="slicePage"
    @selection-change="onSel"
    :error="loadError"
    :on-retry="load"
  >
    <template #query>
      <ListPageQueryBar
        :filter-busy="queryActionBusy"
        :refresh-busy="loading"
        :disabled="loading"
        @search="onSearch"
        @reset="reset"
        @refresh="() => runRefresh(load)"
      >
        <el-form-item :label="t('approvals.statusLabel')">
          <MetaSelect
            class="query-w-200"
            v-model="filters.status"
            clearable
            filterable
            enum-key="approvalStatus"
            :placeholder="t('approvals.statusPlaceholder')"
            :options="approvalStatusSelectOptions"
          />
        </el-form-item>
        <el-form-item :label="t('approvals.typeLabel')">
          <MetaSelect
            class="query-w-180"
            v-model="filters.type"
            clearable
            filterable
            allow-create
            default-first-option
            enum-key="approvalType"
            :placeholder="t('approvals.typePlaceholder')"
            :options="approvalTypeOptions"
          />
        </el-form-item>
        <el-form-item :label="t('approvals.keywordLabel')">
          <el-input
            class="query-w-240"
            v-model="filters.keyword"
            clearable
            :placeholder="t('approvals.keywordPlaceholder')"
          />
        </el-form-item>
      </ListPageQueryBar>
    </template>

    <template #toolbar>
      <el-button type="primary" plain :disabled="!selection.length" @click="runBatchApprove">
        {{ t('approvals.batchApprove') }}
      </el-button>
      <el-button type="danger" plain :disabled="!selection.length" @click="runBatchReject">
        {{ t('approvals.batchReject') }}
      </el-button>
    </template>

    <el-table-column type="selection" width="48" :selectable="selectableRow" />
    <el-table-column prop="approvalNo" :label="t('approvals.colApprovalNo')" width="160">
      <template #default="{ row }">
        <CopyableText :text="row.approvalNo" />
      </template>
    </el-table-column>
    <el-table-column
      prop="approvalType"
      :label="t('approvals.colType')"
      width="110"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        {{ resolveType(row.approvalType) }}
      </template>
    </el-table-column>
    <el-table-column prop="approvalStatus" :label="t('approvals.colStatus')" width="120">
      <template #default="{ row }">
        <StatusTag :value="String(row.approvalStatus ?? '')" category="approval" />
      </template>
    </el-table-column>
    <el-table-column
      prop="actionType"
      :label="t('approvals.colAction')"
      width="100"
      show-overflow-tooltip
    />
    <el-table-column
      prop="targetType"
      :label="t('approvals.colTargetType')"
      width="110"
      show-overflow-tooltip
    />
    <el-table-column
      prop="targetId"
      :label="t('approvals.colTargetId')"
      min-width="180"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <router-link v-if="targetLink(row)" class="cell-link" :to="targetLink(row) || ''">
          {{ row.targetId }}
        </router-link>
        <span v-else>{{ row.targetId || '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column
      prop="requesterId"
      :label="t('approvals.colRequester')"
      width="110"
      show-overflow-tooltip
    />
    <el-table-column
      prop="approverId"
      :label="t('approvals.colApprover')"
      width="110"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span v-if="row.approverId">{{ row.approverId }}</span>
        <span v-else class="muted">—</span>
      </template>
    </el-table-column>
    <el-table-column :label="t('approvals.colReason')" min-width="200" show-overflow-tooltip>
      <template #default="{ row }">
        <span v-if="row.approvalReason">{{ row.approvalReason }}</span>
        <span v-else-if="row.rejectionReason" class="muted">
          {{ t('approvals.rejectPrefix') }}{{ row.rejectionReason }}
        </span>
        <span v-else class="muted">—</span>
      </template>
    </el-table-column>
    <DatetimeColumn prop="approvedAt" :label="t('approvals.colApprovedAt')" width="160" />
    <DatetimeColumn prop="executedAt" :label="t('approvals.colExecutedAt')" width="160" />
    <el-table-column :label="t('approvals.colActions')" width="160" fixed="right" align="center">
      <template #default="{ row }">
        <div class="table-actions">
          <el-button
            size="small"
            plain
            type="primary"
            :disabled="!isPending(row)"
            @click="approveRow(row)"
          >
            {{ t('approvals.actionApprove') }}
          </el-button>
          <el-button
            size="small"
            plain
            type="danger"
            :disabled="!isPending(row)"
            @click="rejectRow(row)"
          >
            {{ t('approvals.actionReject') }}
          </el-button>
        </div>
      </template>
    </el-table-column>
  </ProTable>
</template>

<script setup lang="ts">
  import { computed, ref, watch, reactive } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveType(value?: string | null): string {
    if (!value) return ''
    const key = `enum.approvalType.${value}`
    return te(key) ? t(key) : value
  }

  /**
   * targetId 跳到对应实体详情:
   * JOB_RERUN → /monitor/job-instances/{id}
   * CONFIG_RELEASE → /config/releases?id={id}(配置发布列表过滤)
   * 其余类型返回空,展示纯文本。
   */
  function targetLink(row: { approvalType?: string; targetId?: string }): string | null {
    if (!row?.targetId) return null
    const id = String(row.targetId)
    switch (row.approvalType) {
      case 'JOB_RERUN':
        // BE targetId 可能是 instanceNo 或数字 ID;数字直接跳详情,字符串跳列表过滤
        return /^\d+$/.test(id)
          ? `/monitor/job-instances/${id}`
          : `/monitor/job-instances?instanceNo=${encodeURIComponent(id)}`
      case 'CONFIG_RELEASE':
        return `/config/releases?id=${encodeURIComponent(id)}`
      default:
        return null
    }
  }
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { batchApprove, batchReject, approveOne, queryApprovals, rejectOne } from '@/api/approvals'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import type { ConsoleApprovalCommandResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  const allRows = ref<ConsoleApprovalCommandResponse[]>([])
  const rows = ref<ConsoleApprovalCommandResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const selection = ref<ConsoleApprovalCommandResponse[]>([])

  const filters = reactive({
    status: '',
    type: '',
    keyword: '',
  })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const approvalStatusSelectOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'approvalStatus'),
  )

  const approvalTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'approvalType'))

  const filtered = computed(() => {
    let r = allRows.value
    const s = filters.status.trim()
    if (s) r = r.filter((x) => String(x.approvalStatus ?? '').toUpperCase() === s.toUpperCase())
    const t = filters.type.trim()
    if (t) r = r.filter((x) => String(x.approvalType ?? '') === t)
    const k = filters.keyword.trim()
    if (k) {
      r = r.filter((x) => {
        const hay = `${x.approvalNo ?? ''} ${x.requesterId ?? ''} ${x.targetType ?? ''} ${x.targetId ?? ''}`
        return hay.includes(k)
      })
    }
    return r
  })

  const terminal = new Set(['APPROVED', 'REJECTED', 'CLOSED', 'CANCELLED'])

  function isPending(row: ConsoleApprovalCommandResponse) {
    return !terminal.has(row.approvalStatus)
  }

  function selectableRow(row: ConsoleApprovalCommandResponse) {
    return isPending(row)
  }

  function onSel(s: ConsoleApprovalCommandResponse[]) {
    selection.value = s
  }

  function slicePage() {
    const list = filtered.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    rows.value = pr.records as ConsoleApprovalCommandResponse[]
    total.value = pr.total
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      allRows.value = await queryApprovals(tenant.tenantId)
      page.value = 1
      slicePage()
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function onSearch() {
    return runSearch(() => {
      page.value = 1
      slicePage()
    })
  }

  function reset() {
    return runReset(() => {
      filters.status = ''
      filters.type = ''
      filters.keyword = ''
      page.value = 1
      slicePage()
    })
  }

  watch(filters, () => {
    page.value = 1
    slicePage()
  })

  async function approveRow(row: ConsoleApprovalCommandResponse) {
    try {
      const { value: reason } = await ElMessageBox.prompt(
        t('approvals.approveDialogPrompt'),
        t('approvals.approveDialogTitle'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputPlaceholder: t('approvals.approveDialogPlaceholder'),
        },
      )
      await approveOne(row.approvalNo, { tenantId: tenant.tenantId, reason: reason || undefined })
      ElMessage.success(t('approvals.approvedToast', { no: row.approvalNo }))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function rejectRow(row: ConsoleApprovalCommandResponse) {
    try {
      const { value: reason } = await ElMessageBox.prompt(
        t('approvals.rejectDialogPrompt'),
        t('approvals.rejectDialogTitle'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputPlaceholder: t('approvals.rejectDialogPlaceholder'),
        },
      )
      await rejectOne(row.approvalNo, { tenantId: tenant.tenantId, reason: reason || undefined })
      ElMessage.success(t('approvals.rejectedToast', { no: row.approvalNo }))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function runBatchApprove() {
    const nos = selection.value.map((r) => r.approvalNo)
    try {
      await ElMessageBox.confirm(
        t('approvals.batchApproveConfirm', { n: nos.length }),
        t('approvals.batchApproveTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await batchApprove({ tenantId: tenant.tenantId, approvalNos: nos })
      ElMessage.success(t('approvals.batchApprovedToast', { n: nos.length }))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function runBatchReject() {
    const nos = selection.value.map((r) => r.approvalNo)
    try {
      const { value: reason } = await ElMessageBox.prompt(
        t('approvals.batchRejectPrompt'),
        t('approvals.batchRejectTitle', { n: nos.length }),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await batchReject({
        tenantId: tenant.tenantId,
        approvalNos: nos,
        reason: reason || undefined,
      })
      ElMessage.success(t('approvals.batchRejectedToast', { n: nos.length }))
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .trace {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .trace code {
    font-size: 11px;
  }
</style>
