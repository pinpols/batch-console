<template>
  <PageContainer>
    <PageHeader
      title="执行日志（审计检索）"
      description="基于审计全量与端上筛选；操作类型与结果优先使用 meta/enums，缺省再回落当前数据与本地映射。"
    />
    <SectionCard>
      <ProTable
        :data="tableRows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
        :show-pager="true"
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
            <el-form-item label="Trace">
              <el-input
                v-model="traceDraft"
                clearable
                placeholder="Trace Id，端上模糊匹配"
                style="width: 200px"
                @keyup.enter="onSearch"
              />
            </el-form-item>
            <el-form-item label="操作类型">
              <el-select
                v-model="opDraft"
                clearable
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入 operationType"
                style="width: 200px"
                @keyup.enter="onSearch"
              >
                <el-option
                  v-for="o in operationTypeOptions"
                  :key="o.value"
                  :label="o.label"
                  :value="o.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="结果">
              <el-select
                v-model="opResultDraft"
                clearable
                filterable
                placeholder="全部操作结果"
                style="width: 200px"
                @keyup.enter="onSearch"
              >
                <el-option
                  v-for="opt in opResultOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-switch v-model="poll" active-text="每 30 秒自动刷新列表" />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <DatetimeColumn prop="createdAt" label="时间" width="160" />
        <el-table-column prop="operationType" label="操作" width="120" />
        <el-table-column prop="operationResult" label="结果" width="110">
          <template #default="{ row }">
            <StatusTag :value="String(row.operationResult ?? '')" category="operationResult" />
          </template>
        </el-table-column>
        <el-table-column prop="operatorId" label="操作者" width="120" />
        <el-table-column prop="traceId" label="Trace" min-width="120" show-overflow-tooltip />
        <el-table-column prop="detailSummary" label="摘要" min-width="160" show-overflow-tooltip />
      </ProTable>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { queryAudits } from '@/api/observabilityQueries'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleAuditLogResponse } from '@/types/console-api'

  const route = useRoute()
  const tenant = useTenantStore()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(loading)
  const rows = ref<ConsoleAuditLogResponse[]>([])
  const traceDraft = ref('')
  const opDraft = ref('')
  const opResultDraft = ref('')
  const traceApplied = ref('')
  const opApplied = ref('')
  const opResultApplied = ref('')
  const poll = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const display = ref<ConsoleAuditLogResponse[]>([])

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const operationTypeOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'operationType'))

  const opResultOptions = computed(() => pickMetaEnumGroup(metaEnums.value, 'operationResult'))

  const filtered = computed(() => {
    let r = rows.value
    const t = traceApplied.value.trim()
    if (t) r = r.filter((x) => x.traceId?.includes(t))
    const o = opApplied.value.trim()
    if (o) r = r.filter((x) => String(x.operationType ?? '') === o)
    const res = opResultApplied.value.trim()
    if (res)
      r = r.filter((x) => String(x.operationResult ?? '').toUpperCase() === res.toUpperCase())
    return r
  })

  const tableRows = computed(() => display.value as unknown as Record<string, unknown>[])

  function slicePage() {
    const list = filtered.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    display.value = pr.records as ConsoleAuditLogResponse[]
  }

  function onSearch() {
    return runSearch(() => {
      traceApplied.value = traceDraft.value.trim()
      opApplied.value = opDraft.value.trim()
      opResultApplied.value = opResultDraft.value.trim()
      page.value = 1
      slicePage()
    })
  }

  function reset() {
    return runReset(() => {
      traceDraft.value = ''
      opDraft.value = ''
      opResultDraft.value = ''
      traceApplied.value = ''
      opApplied.value = ''
      opResultApplied.value = ''
      page.value = 1
      slicePage()
    })
  }

  async function load() {
    loading.value = true
    try {
      rows.value = await queryAudits(tenant.tenantId, {
        traceId: traceApplied.value.trim() || undefined,
        operationType: opApplied.value.trim() || undefined,
        operationResult: opResultApplied.value.trim() || undefined,
      })
      page.value = 1
      slicePage()
    } finally {
      loading.value = false
    }
  }

  watch(poll, (on) => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (on) {
      timer = setInterval(() => load(), 30_000)
    }
  })

  {
    const q = route.query
    if (q.traceId) {
      traceDraft.value = String(q.traceId)
      traceApplied.value = String(q.traceId)
    }
  }

  useTenantReload(load)

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })
</script>
