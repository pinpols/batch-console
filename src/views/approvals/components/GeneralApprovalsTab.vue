<template>
  <ProTable
    ref="proTableRef"
    :data="rows"
    :loading="tableBlocking"
    :total="total"
    v-model:page="page"
    v-model:page-size="pageSize"
    @change="slicePage"
    @selection-change="onSel"
    :error="loadError"
    :on-retry="load"
    row-key="approvalNo"
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
      <BulkActionBar :count="selection.length" :running="batchRunning" @clear="clearSelection">
        <template #default="{ running }">
          <el-button size="small" type="primary" plain :loading="running" @click="runBatchApprove">
            {{ t('approvals.batchApprove') }}
          </el-button>
          <el-button size="small" type="danger" plain :loading="running" @click="runBatchReject">
            {{ t('approvals.batchReject') }}
          </el-button>
        </template>
      </BulkActionBar>
    </template>

    <el-table-column
      type="selection"
      width="48"
      :selectable="selectableRow"
      :reserve-selection="true"
    />
    <el-table-column prop="approvalNo" :label="t('approvals.colApprovalNo')" width="160">
      <template #default="{ row }">
        <!-- dump:审批单号 mono + accent 蓝 -->
        <CopyableText class="ap-no" :text="row.approvalNo" />
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
        <router-link v-if="targetLink(row)" class="cell-link ap-mono" :to="targetLink(row) || ''">
          {{ row.targetId }}
        </router-link>
        <span v-else class="ap-mono">{{ row.targetId || '—' }}</span>
      </template>
    </el-table-column>
    <el-table-column
      prop="requesterId"
      :label="t('approvals.colRequester')"
      width="110"
      show-overflow-tooltip
    />
    <!-- dump 列序:目标/申请人之后是「申请时间」,相对格式(今天 13:52 / 昨天 18:03) -->
    <el-table-column prop="createdAt" :label="requestedAtLabel" width="130">
      <template #default="{ row }">
        <span class="ap-mono ap-time" :title="String(row.createdAt ?? '')">
          {{ relativeDayTime(row.createdAt) }}
        </span>
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
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
  import { h } from 'vue'

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
  import {
    batchApprove,
    batchReject,
    approveOne,
    queryApprovalsPage,
    rejectOne,
  } from '@/api/approvals'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { fmtCompact } from '@/utils/datetime'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import BulkActionBar from '@/components/table/BulkActionBar.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import type { ConsoleApprovalCommandResponse } from '@/types/console-api'
  import { useAuthStore } from '@/stores/auth'

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
  const rows = ref<ConsoleApprovalCommandResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)
  const selection = ref<ConsoleApprovalCommandResponse[]>([])
  // 批量执行中:驱动 BulkActionBar 内动作按钮 loading + 禁用清除
  const batchRunning = ref(false)
  const proTableRef = ref<{ clearSelection?: () => void } | null>(null)

  function clearSelection() {
    selection.value = []
    proTableRef.value?.clearSelection?.()
  }

  const route = useRoute()
  const auth = useAuthStore()
  // 深链 /approvals?requester=me(自助「我的申请」):把 me 解析成当前用户标识,
  // 精确过滤 requesterId,使「我的申请」只显示本人提交的审批单(此前该条件被丢弃)。
  const requesterParam = route.query.requester ? String(route.query.requester) : ''
  const requesterFilter =
    requesterParam === 'me'
      ? (auth.userInfo?.username ?? auth.userInfo?.userId ?? '')
      : requesterParam
  const filters = reactive({
    status: route.query.status ? String(route.query.status) : '',
    type: '',
    keyword: '',
    requesterId: requesterFilter,
  })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const approvalStatusSelectOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'approvalStatus'),
  )

  const approvalTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'approvalType'))

  const terminal = new Set(['APPROVED', 'REJECTED', 'CLOSED', 'CANCELLED'])
  const requestedAtLabel = computed(() => t('approvals.colRequestedAt'))

  function relativeDayTime(value: unknown): string {
    return fmtCompact(value)
  }

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
    // 服务端分页由 page/pageSize watcher 触发 load;保留 ProTable change 回调避免模板漂移。
  }

  // 服务端分页 + 服务端筛选:status→approvalStatus / type→approvalType / keyword 跨列模糊 /
  // requesterId(?requester=me 入口)全部传后端,不再端上全量聚合 + 当前页局部过滤。
  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const resp = await queryApprovalsPage(tenant.tenantId, page.value, pageSize.value, {
        approvalStatus: (filters.status ?? '').trim() || undefined,
        approvalType: (filters.type ?? '').trim() || undefined,
        keyword: (filters.keyword ?? '').trim() || undefined,
        requesterId: (filters.requesterId ?? '').trim() || undefined,
      })
      rows.value = (resp.items ?? []) as ConsoleApprovalCommandResponse[]
      total.value = Number(resp.total ?? rows.value.length)
    } catch (err) {
      loadError.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  function onSearch() {
    return runSearch(async () => {
      page.value = 1
      await load()
    })
  }

  function reset() {
    return runReset(async () => {
      filters.status = ''
      filters.type = ''
      filters.keyword = ''
      page.value = 1
      await load()
    })
  }

  // 翻页 / 改 pageSize 触发服务端重拉
  watch([page, pageSize], () => {
    void load()
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
      // 补偿类审批:从审批单 payloadJson 取出 compensationType 一并提交,
      // 否则 BE 执行补偿时拒为 400「必须指定补偿类型」。非补偿单解析不到则为 undefined,不影响。
      let compensationType: string | undefined
      try {
        compensationType = (JSON.parse(row.payloadJson || '{}') as { compensationType?: string })
          .compensationType
      } catch {
        compensationType = undefined
      }
      await approveOne(row.approvalNo, {
        tenantId: tenant.tenantId,
        reason: reason || undefined,
        compensationType,
      })
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

  /**
   * 渲染批量结果:成功/失败计数走 BE 真实返回,失败列表用 ElNotification 持久通知。
   * 不再用 selection.length 谎报全成功。
   */
  function reportBatchResult(
    results: { approvalNo: string; success: boolean; message: string }[] | null | undefined,
    fallbackTotal: number,
    action: 'approve' | 'reject',
  ) {
    const list = Array.isArray(results) ? results : []
    const okList = list.filter((r) => r.success)
    const failList = list.filter((r) => !r.success)
    const okN = okList.length
    const failN = failList.length

    // 防御:BE 没回数组时退化为旧语义(只能信任 length),但仍标记 unknown
    if (list.length === 0) {
      ElMessage.warning(
        action === 'approve'
          ? t('approvals.batchApprovedToastUnknown', { n: fallbackTotal })
          : t('approvals.batchRejectedToastUnknown', { n: fallbackTotal }),
      )
      return
    }

    if (failN === 0) {
      ElMessage.success(
        action === 'approve'
          ? t('approvals.batchApprovedToast', { n: okN })
          : t('approvals.batchRejectedToast', { n: okN }),
      )
      return
    }

    // 部分失败 / 全部失败 → 持久通知 + 失败明细
    const title =
      action === 'approve'
        ? t('approvals.batchApprovePartialTitle')
        : t('approvals.batchRejectPartialTitle')
    const summary =
      action === 'approve'
        ? t('approvals.batchApprovePartialSummary', { ok: okN, fail: failN })
        : t('approvals.batchRejectPartialSummary', { ok: okN, fail: failN })
    ElNotification({
      title,
      type: okN === 0 ? 'error' : 'warning',
      duration: 0,
      message: h('div', null, [
        h('div', { style: 'margin-bottom:8px' }, summary),
        h(
          'ul',
          { style: 'margin:0;padding-left:18px;max-height:200px;overflow:auto' },
          failList
            .slice(0, 50)
            .map((r) =>
              h('li', { style: 'font-size:12px;line-height:1.6' }, [
                h('code', null, r.approvalNo),
                ' — ',
                r.message || t('approvals.batchUnknownFailReason'),
              ]),
            ),
        ),
        failList.length > 50
          ? h(
              'div',
              { style: 'font-size:12px;color:var(--el-text-color-secondary);margin-top:4px' },
              t('approvals.batchMoreFailures', { n: failList.length - 50 }),
            )
          : null,
      ]),
    })
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
    } catch {
      return
    }
    batchRunning.value = true
    try {
      const results = await batchApprove({ tenantId: tenant.tenantId, approvalNos: nos })
      reportBatchResult(results, nos.length, 'approve')
      clearSelection()
      await load()
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      batchRunning.value = false
    }
  }

  async function runBatchReject() {
    const nos = selection.value.map((r) => r.approvalNo)
    let reason: string | undefined
    try {
      const r = await ElMessageBox.prompt(
        t('approvals.batchRejectPrompt'),
        t('approvals.batchRejectTitle', { n: nos.length }),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      reason = r.value || undefined
    } catch {
      return
    }
    batchRunning.value = true
    try {
      const results = await batchReject({
        tenantId: tenant.tenantId,
        approvalNos: nos,
        reason,
      })
      reportBatchResult(results, nos.length, 'reject')
      clearSelection()
      await load()
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    } finally {
      batchRunning.value = false
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  /* dump proto-approvals:单号 mono 蓝、目标 mono */
  .ap-no {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-primary);
  }

  .ap-mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .trace {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .trace code {
    font-size: 11px;
  }
</style>
