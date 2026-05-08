<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="filtered"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="() => {}"
      >
        <template #query>
          <ListPageQueryBar
            :model="filters"
            :filter-busy="queryActionBusy"
            :refresh-busy="isFetching"
            :disabled="isPending"
            @search="onSearch"
            @reset="reset"
            @refresh="onRefreshDefinitions"
          >
            <el-form-item label="Job Code">
              <el-input
                class="query-w-160"
                v-model="filters.jobCode"
                clearable
                placeholder="请输入 jobCode"
              />
            </el-form-item>
            <el-form-item label="名称">
              <el-input
                class="query-w-160"
                v-model="filters.jobName"
                clearable
                placeholder="请输入 jobName"
              />
            </el-form-item>
            <el-form-item label="启用">
              <el-select class="query-w-120" v-model="filters.enabled" clearable placeholder="全部">
                <el-option label="启用" :value="true" />
                <el-option label="停用" :value="false" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel tip="Worker 分组，决定由哪组 Worker 执行该 Job">Worker Group</HelpLabel>
              </template>
              <el-select
                class="query-w-180"
                v-model="filters.workerGroup"
                clearable
                filterable
                placeholder="请选择 workerGroup"
              >
                <el-option
                  v-for="option in workerGroupOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel tip="调度队列，控制并发和执行优先级">Queue</HelpLabel>
              </template>
              <el-select
                class="query-w-160"
                v-model="filters.queueCode"
                clearable
                filterable
                placeholder="请选择 queueCode"
              >
                <el-option
                  v-for="option in queueOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <template #label>
                <HelpLabel tip="CRON 定时触发 / EVENT 事件触发 / MANUAL 手动触发"
                  >调度类型</HelpLabel
                >
              </template>
              <el-select
                class="query-w-160"
                v-model="filters.scheduleType"
                clearable
                placeholder="请选择 scheduleType"
              >
                <el-option
                  v-for="option in scheduleTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="jobCode" label="Job Code" min-width="140">
          <template #default="{ row }">
            <CopyableText :text="row.jobCode" />
          </template>
        </el-table-column>
        <el-table-column prop="jobName" label="名称" min-width="160" />
        <el-table-column prop="tenantId" label="租户" width="100" />
        <el-table-column prop="workerGroup" label="Worker Group" width="140" />
        <el-table-column prop="queueCode" label="队列" width="140" />
        <el-table-column prop="scheduleType" label="调度类型" width="120" />
        <el-table-column prop="executionMode" label="执行模式" width="110">
          <template #default="{ row }">
            <StatusTag :value="row.executionMode || 'FULL'" category="executionMode" />
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="启用" width="80">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <el-table-column
          prop="scheduleExpr"
          label="调度表达式"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column label="操作" min-width="320" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openEdit(row)">编辑</el-button>
              <el-button
                size="small"
                plain
                :type="row.enabled ? 'warning' : 'success'"
                :loading="actingJobCode === row.jobCode"
                @click="toggleRow(row)"
              >
                {{ row.enabled ? '停用' : '启用' }}
              </el-button>
              <el-button
                size="small"
                plain
                type="primary"
                :loading="actingJobCode === row.jobCode"
                @click="triggerRow(row)"
              >
                手动触发
              </el-button>
              <el-button size="small" plain @click="goInstances(row.jobCode)">查看实例</el-button>
              <el-button
                size="small"
                plain
                v-track-click="{ action: '克隆 Job', jobCode: row.jobCode }"
                @click="cloneRow(row)"
                >克隆</el-button
              >
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer
      v-model="editDrawerVisible"
      :title="editDrawerTitle"
      size="520px"
      :before-close="onEditDrawerClose"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editFormRules"
        label-width="120px"
        @submit.prevent
      >
        <el-form-item label="Job Code">
          <el-input :model-value="editingJobCode" disabled />
        </el-form-item>
        <el-form-item label="执行模式" prop="executionMode">
          <el-select v-model="editForm.executionMode" class="query-w-full">
            <el-option
              v-for="option in executionModeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="editForm.executionMode === 'INCREMENTAL'"
          label="水位字段名"
          prop="watermarkField"
        >
          <el-input
            v-model="editForm.watermarkField"
            placeholder="增量水位字段名(例:update_time / id)"
            maxlength="64"
            show-word-limit
          />
        </el-form-item>
        <div class="drawer-actions">
          <el-button @click="closeEditDrawer">取消</el-button>
          <el-button type="primary" :loading="editSaving" @click="submitEdit">保存</el-button>
        </div>
      </el-form>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormItemRule, FormRules } from 'element-plus'
  import { jobApi } from '@/api/job'
  import { getMetaEnums, getMetaQueues, type MetaOption } from '@/api/meta'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useJobDefinitionsPaged } from '@/composables/queries/useJobDefinitionsPaged'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import type { ConsoleJobDefinitionResponse } from '@/types/console-api'

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const page = ref(1)
  const pageSize = ref(20)
  const actingJobCode = ref('')
  const queueOptions = ref<MetaOption[]>([])
  const scheduleTypeOptions = ref<MetaOption[]>([])
  const filters = reactive({
    tenantId: tenant.tenantId,
    jobCode: '',
    jobName: '',
    enabled: undefined as boolean | undefined,
    workerGroup: '',
    queueCode: '',
    scheduleType: '',
  })

  const filterTenantRef = computed(() => filters.tenantId)
  // 服务端过滤参数：后端 queryJobDefinitions 仅支持 jobCode / enabled；
  // 次要过滤（jobName / workerGroup / queueCode / scheduleType）后端未暴露
  // → 放到"本页前端过滤"。要完整搜索须用 Job Code / 启用状态。
  const serverJobCode = computed(() => filters.jobCode.trim() || undefined)
  const serverEnabled = computed<boolean | undefined>(() => filters.enabled ?? undefined)
  const { data, isPending, isFetching, refetch } = useJobDefinitionsPaged({
    page,
    pageSize,
    jobCode: serverJobCode,
    enabled: serverEnabled,
    tenantIdOverride: filterTenantRef,
  })

  const remoteBlocking = computed(() => isPending.value || isFetching.value)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(remoteBlocking)

  const pageRows = computed(() => data.value?.records ?? [])

  const workerGroupOptions = computed(() =>
    Array.from(
      new Set(pageRows.value.map((row) => row.workerGroup).filter((v): v is string => !!v)),
    ),
  )

  /** 只对后端未暴露的次要 filter（jobName / workerGroup / queueCode / scheduleType）做本页过滤。 */
  const filtered = computed(() => {
    return pageRows.value.filter((row) => {
      if (filters.jobName.trim() && !row.jobName?.includes(filters.jobName.trim())) return false
      if (filters.workerGroup.trim() && !row.workerGroup?.includes(filters.workerGroup.trim())) {
        return false
      }
      if (filters.queueCode.trim() && !row.queueCode?.includes(filters.queueCode.trim())) {
        return false
      }
      if (filters.scheduleType.trim() && !row.scheduleType?.includes(filters.scheduleType.trim())) {
        return false
      }
      return true
    })
  })

  const total = computed(() => data.value?.total ?? 0)

  function onSearch() {
    return runSearch(() => {
      page.value = 1
    })
  }

  function reset() {
    return runReset(() => {
      filters.tenantId = tenant.tenantId
      filters.jobCode = ''
      filters.jobName = ''
      filters.enabled = undefined
      filters.workerGroup = ''
      filters.queueCode = ''
      filters.scheduleType = ''
      page.value = 1
    })
  }

  function onRefreshDefinitions() {
    return runRefresh(() => refetch())
  }

  function goInstances(jobCode: string) {
    void router.push({ path: '/monitor/job-instances', query: { jobCode } })
  }

  async function loadMeta() {
    const [enums, queues] = await Promise.all([
      getMetaEnums(),
      getMetaQueues(filters.tenantId || tenant.tenantId),
    ])
    scheduleTypeOptions.value = enums.scheduleType ?? []
    queueOptions.value = queues
  }

  async function toggleRow(row: ConsoleJobDefinitionResponse) {
    try {
      await ElMessageBox.confirm(
        `${row.enabled ? '停用' : '启用'} Job「${row.jobCode}」？`,
        '状态切换确认',
        { type: 'warning' },
      )
    } catch {
      return
    }
    actingJobCode.value = row.jobCode
    try {
      await jobApi.toggleEnabled(row.jobCode, filters.tenantId || tenant.tenantId, !row.enabled)
      ElMessage.success(`已${row.enabled ? '停用' : '启用'} ${row.jobCode}`)
      await refetch()
    } finally {
      actingJobCode.value = ''
    }
  }

  async function triggerRow(row: ConsoleJobDefinitionResponse) {
    let payloadText = ''
    try {
      const { value } = await ElMessageBox.prompt(
        '可选，输入 JSON payload；留空则发送空对象',
        `手动触发 ${row.jobCode}`,
        {
          inputType: 'textarea',
          inputValue: '{}',
          confirmButtonText: '触发',
          cancelButtonText: '取消',
        },
      )
      payloadText = value?.trim() || '{}'
      JSON.parse(payloadText)
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      ElMessage.error('payload 需为合法 JSON')
      return
    }
    actingJobCode.value = row.jobCode
    try {
      await jobApi.trigger(
        row.jobCode,
        filters.tenantId || tenant.tenantId,
        JSON.parse(payloadText),
      )
      ElMessage.success(`已触发 ${row.jobCode}`)
    } finally {
      actingJobCode.value = ''
    }
  }

  async function cloneRow(row: ConsoleJobDefinitionResponse) {
    try {
      await ElMessageBox.confirm(`克隆 Job「${row.jobCode}」？`, '克隆确认', { type: 'info' })
      await jobApi.clone(row.id, filters.tenantId || tenant.tenantId)
      ElMessage.success(`已克隆 ${row.jobCode}`)
      await refetch()
    } catch {
      /* cancel */
    }
  }

  // ── 编辑抽屉(轻量版,只露 ExecutionMode + watermarkField,部分更新) ─────
  const editFormRef = ref<FormInstance>()
  const editDrawerVisible = ref(false)
  const editSaving = ref(false)
  const editingId = ref<number | null>(null)
  const editingTenantId = ref('')
  const editingJobCode = ref('')
  const editForm = reactive({
    executionMode: 'FULL',
    watermarkField: '',
  })

  const { data: metaEnumsData } = useConsoleMetaEnumsQuery()
  const executionModeOptions = computed(() =>
    pickMetaEnumGroup(metaEnumsData.value, 'executionMode'),
  )

  const editDrawerTitle = computed(() =>
    editingJobCode.value ? `编辑 Job「${editingJobCode.value}」` : '编辑 Job',
  )

  const watermarkRule: FormItemRule = {
    validator: (_rule, value: unknown, callback) => {
      if (editForm.executionMode !== 'INCREMENTAL') return callback()
      const v = typeof value === 'string' ? value.trim() : ''
      if (!v) return callback(new Error('INCREMENTAL 模式下必须填写水位字段名'))
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v)) {
        return callback(new Error('只能含字母 / 数字 / 下划线,且不能以数字开头'))
      }
      return callback()
    },
    trigger: 'blur',
  }

  const editFormRules: FormRules = {
    executionMode: [{ required: true, message: '请选择执行模式', trigger: 'change' }],
    watermarkField: [watermarkRule],
  }

  // 切到 FULL/CDC 时自动清空水位字段
  watch(
    () => editForm.executionMode,
    (mode) => {
      if (mode !== 'INCREMENTAL') editForm.watermarkField = ''
    },
  )

  function openEdit(row: ConsoleJobDefinitionResponse) {
    editingId.value = row.id
    editingTenantId.value = row.tenantId || filters.tenantId || tenant.tenantId
    editingJobCode.value = row.jobCode
    editForm.executionMode = row.executionMode || 'FULL'
    editForm.watermarkField = row.watermarkField ?? ''
    editDrawerVisible.value = true
    // 抽屉打开后清掉历史校验态
    void editFormRef.value?.clearValidate()
  }

  function closeEditDrawer() {
    editDrawerVisible.value = false
  }

  function onEditDrawerClose(done: () => void) {
    if (editSaving.value) return
    done()
  }

  async function submitEdit() {
    if (editingId.value == null) return
    const valid = await editFormRef.value?.validate().catch(() => false)
    if (!valid) return
    editSaving.value = true
    try {
      await jobApi.updateDefinition(editingId.value, {
        tenantId: editingTenantId.value,
        executionMode: editForm.executionMode,
        // 仅 INCREMENTAL 时回写值;其它模式回写空串让后端清字段
        watermarkField:
          editForm.executionMode === 'INCREMENTAL' ? editForm.watermarkField.trim() : '',
      })
      ElMessage.success(`已更新 ${editingJobCode.value}`)
      editDrawerVisible.value = false
      await refetch()
    } finally {
      editSaving.value = false
    }
  }

  {
    const q = route.query
    if (q.jobCode) filters.jobCode = String(q.jobCode)
  }

  useTenantReload(loadMeta)
</script>

<style scoped>
  .drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }
</style>
