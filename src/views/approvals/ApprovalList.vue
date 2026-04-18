<template>
  <PageContainer>
    <PageHeader
      title="审批中心"
      description="拉取当前租户审批单；状态与类型为枚举/数据驱动下拉，关键字仍支持单号与申请人模糊搜索。"
    />

    <SectionCard>
      <ProTable
        :data="tableRows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
        @selection-change="onSel"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="queryActionBusy"
            :refresh-busy="loading"
            :disabled="loading"
            @search="onSearch"
            @reset="reset"
            @refresh="load"
          >
            <el-form-item label="状态">
              <el-select
                v-model="filters.status"
                clearable
                filterable
                placeholder="全部审批状态"
                style="width: 200px"
              >
                <el-option
                  v-for="opt in approvalStatusSelectOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                v-model="filters.type"
                clearable
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入 approvalType"
                style="width: 180px"
              >
                <el-option
                  v-for="o in approvalTypeOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="关键字">
              <el-input
                v-model="filters.keyword"
                clearable
                placeholder="审批单号、申请人、目标类型或 Id"
                style="width: 240px"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <template #toolbar>
          <el-button type="primary" plain :disabled="!selection.length" @click="runBatchApprove"
            >批量通过</el-button
          >
          <el-button type="danger" plain :disabled="!selection.length" @click="runBatchReject"
            >批量拒绝</el-button
          >
          <span v-if="lastTrace" class="trace">
            最近 traceId：
            <code>{{ lastTrace }}</code>
            <el-button size="small" link type="primary" @click="copyTrace">复制</el-button>
          </span>
        </template>

        <el-table-column type="selection" width="48" :selectable="selectableRow" />
        <el-table-column prop="approvalNo" label="审批单号" width="160">
          <template #default="{ row }">
            <CopyableText :text="row.approvalNo" />
          </template>
        </el-table-column>
        <el-table-column prop="approvalType" label="类型" width="110" show-overflow-tooltip />
        <el-table-column prop="approvalStatus" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.approvalStatus ?? '')" category="approval" />
          </template>
        </el-table-column>
        <el-table-column prop="targetType" label="目标类型" width="110" show-overflow-tooltip />
        <!-- 弹性列：吃掉剩余宽度，避免表格右侧出现整块空白 -->
        <el-table-column prop="targetId" label="目标 Id" min-width="220" show-overflow-tooltip />
        <el-table-column prop="requesterId" label="申请人" width="110" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                plain
                type="primary"
                :disabled="!isPending(row)"
                @click="approveRow(row)"
              >
                通过
              </el-button>
              <el-button
                size="small"
                plain
                type="danger"
                :disabled="!isPending(row)"
                @click="rejectRow(row)"
              >
                拒绝
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch, reactive } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { batchApprove, batchReject, approveOne, queryApprovals, rejectOne } from '@/api/approvals'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { lastApiMeta } from '@/utils/lastApiMeta'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import type { ConsoleApprovalCommandResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(loading)
  const allRows = ref<ConsoleApprovalCommandResponse[]>([])
  const rows = ref<ConsoleApprovalCommandResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const selection = ref<ConsoleApprovalCommandResponse[]>([])

  const lastTrace = computed(() => lastApiMeta.value?.traceId ?? '')
  const tableRows = computed(() => rows.value as unknown as Record<string, unknown>[])

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
    try {
      allRows.value = await queryApprovals(tenant.tenantId)
      page.value = 1
      slicePage()
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
      const { value: reason } = await ElMessageBox.prompt('审批意见（可选）', '通过审批', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: 'reason',
      })
      await approveOne(row.approvalNo, { tenantId: tenant.tenantId, reason: reason || undefined })
      ElMessage.success(`已通过审批 ${row.approvalNo}`)
      await load()
    } catch {
      /* cancel */
    }
  }

  async function rejectRow(row: ConsoleApprovalCommandResponse) {
    try {
      const { value: reason } = await ElMessageBox.prompt('拒绝原因', '拒绝审批', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPlaceholder: '必填或按后端要求',
      })
      await rejectOne(row.approvalNo, { tenantId: tenant.tenantId, reason: reason || undefined })
      ElMessage.success(`已拒绝审批 ${row.approvalNo}`)
      await load()
    } catch {
      /* cancel */
    }
  }

  async function runBatchApprove() {
    const nos = selection.value.map((r) => r.approvalNo)
    try {
      await ElMessageBox.confirm(`确认批量通过 ${nos.length} 条？`, '批量通过', { type: 'warning' })
      await batchApprove({ tenantId: tenant.tenantId, approvalNos: nos })
      ElMessage.success(`已批量通过 ${nos.length} 条审批`)
      await load()
    } catch {
      /* cancel */
    }
  }

  async function runBatchReject() {
    const nos = selection.value.map((r) => r.approvalNo)
    try {
      const { value: reason } = await ElMessageBox.prompt(
        '拒绝原因（可选）',
        `批量拒绝 ${nos.length} 条`,
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
        },
      )
      await batchReject({
        tenantId: tenant.tenantId,
        approvalNos: nos,
        reason: reason || undefined,
      })
      ElMessage.success(`已批量拒绝 ${nos.length} 条审批`)
      await load()
    } catch {
      /* cancel */
    }
  }

  function copyTrace() {
    if (!lastTrace.value) return
    void navigator.clipboard.writeText(lastTrace.value)
    ElMessage.success('已复制')
  }

  useTenantReload(load)
</script>

<style scoped>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .trace {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .trace code {
    font-size: 11px;
  }
</style>
