<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
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
            <el-form-item label="Key">
              <el-input
                class="query-w-180"
                v-model="filters.key"
                clearable
                placeholder="配置 Key，模糊匹配"
              />
            </el-form-item>
            <el-form-item label="名称">
              <el-input
                class="query-w-180"
                v-model="filters.name"
                clearable
                placeholder="配置显示名，模糊匹配"
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-select
                class="query-w-200"
                v-model="filters.status"
                clearable
                filterable
                placeholder="全部发布状态"
              >
                <el-option
                  v-for="opt in configReleaseStatusOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="configKey" label="Key" min-width="140" show-overflow-tooltip />
        <el-table-column prop="configName" label="名称" min-width="140" />
        <el-table-column prop="configType" label="类型" width="120" />
        <el-table-column prop="configStatus" label="状态" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.configStatus ?? '')" category="configStatus" />
          </template>
        </el-table-column>
        <el-table-column prop="versionNo" label="版本" width="80" />
        <DatetimeColumn prop="publishedAt" label="发布时间" width="160" />
        <el-table-column label="操作" width="380" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                plain
                v-track-click="{ action: '查看配置详情', id: row.id }"
                @click="viewDetail(row)"
                >详情</el-button
              >
              <el-button size="small" plain type="primary" @click="doPublish(row)">发布</el-button>
              <el-button size="small" plain @click="doGray(row)">灰度</el-button>
              <el-button size="small" plain type="danger" @click="doRollback(row)">回滚</el-button>
              <el-button size="small" plain @click="doDeps(row)">依赖</el-button>
              <el-button size="small" plain @click="openDiff(row)">对比</el-button>
              <el-button
                size="small"
                plain
                type="warning"
                v-track-click="{ action: '提交配置审批', id: row.id }"
                @click="doSubmitApproval(row)"
                >提审</el-button
              >
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <!-- 依赖关系抽屉 -->
    <el-drawer v-model="depsVisible" title="配置依赖关系" size="640px">
      <div v-loading="depsLoading">
        <el-empty v-if="!depsLoading && !depsData" description="暂无数据" />
        <JsonPreview v-else class="release-json" :data="depsData" />
      </div>
    </el-drawer>

    <!-- 版本对比对话框 -->
    <el-dialog v-model="diffVisible" title="配置版本对比" width="720px">
      <el-form :inline="true" class="diff-form">
        <el-form-item label="版本 A">
          <el-select
            class="query-w-240"
            v-model="diffForm.releaseIdA"
            filterable
            placeholder="选择发布版本"
          >
            <el-option
              v-for="r in allRows"
              :key="r.id"
              :label="`#${r.id} ${r.configKey} v${r.versionNo}`"
              :value="r.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="版本 B">
          <el-select
            class="query-w-240"
            v-model="diffForm.releaseIdB"
            filterable
            placeholder="选择发布版本"
          >
            <el-option
              v-for="r in allRows.filter((x) => x.id !== diffForm.releaseIdA)"
              :key="r.id"
              :label="`#${r.id} ${r.configKey} v${r.versionNo}`"
              :value="r.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="diffLoading"
            :disabled="!diffForm.releaseIdA || !diffForm.releaseIdB"
            @click="doDiff"
          >
            对比
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="diffData" class="diff-result">
        <JsonPreview class="release-json" :data="diffData" />
      </div>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="配置发布详情" size="640px">
      <el-descriptions v-if="detail" :column="2" border size="small">
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="configKey">{{ detail.configKey }}</el-descriptions-item>
        <el-descriptions-item label="configName">{{ detail.configName }}</el-descriptions-item>
        <el-descriptions-item label="configStatus">{{ detail.configStatus }}</el-descriptions-item>
        <el-descriptions-item label="versionNo">{{ detail.versionNo }}</el-descriptions-item>
        <el-descriptions-item label="publishedAt">{{ detail.publishedAt }}</el-descriptions-item>
        <el-descriptions-item label="原始响应" :span="2">
          <JsonPreview :data="detail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch, computed, reactive } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import {
    grayRelease,
    listConfigReleases,
    publishRelease,
    rollbackRelease,
    getConfigRelease,
    submitReleaseApproval,
    listConfigDependencies,
    diffConfigReleases,
  } from '@/api/configReleases'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import type { ConsoleConfigReleaseResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
    runRefresh,
  } = useListFilterFeedback(loading)
  const allRows = ref<ConsoleConfigReleaseResponse[]>([])
  const rows = ref<ConsoleConfigReleaseResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)

  const filters = reactive({
    key: '',
    name: '',
    status: '',
  })

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const configReleaseStatusOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'configStatus'),
  )

  const filtered = computed(() => {
    let r = allRows.value
    const k = filters.key.trim()
    if (k) r = r.filter((x) => String(x.configKey ?? '').includes(k))
    const n = filters.name.trim()
    if (n) r = r.filter((x) => String(x.configName ?? '').includes(n))
    const s = filters.status.trim()
    if (s) r = r.filter((x) => String(x.configStatus ?? '').toUpperCase() === s.toUpperCase())
    return r
  })

  function slicePage() {
    const list = filtered.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    rows.value = pr.records as ConsoleConfigReleaseResponse[]
    total.value = pr.total
  }

  async function load() {
    loading.value = true
    try {
      allRows.value = await listConfigReleases(tenant.tenantId)
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
      filters.key = ''
      filters.name = ''
      filters.status = ''
      page.value = 1
      slicePage()
    })
  }

  watch(filters, () => {
    page.value = 1
    slicePage()
  })

  async function doPublish(row: ConsoleConfigReleaseResponse) {
    try {
      const { value: reason } = await ElMessageBox.prompt(
        '发布原因（可选）',
        `发布 ${row.configKey}`,
        {
          confirmButtonText: '发布',
          cancelButtonText: '取消',
        },
      )
      await publishRelease(row.id, { tenantId: tenant.tenantId, reason: reason || undefined })
      ElMessage.success(`已发布 ${row.configKey}`)
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doGray(row: ConsoleConfigReleaseResponse) {
    try {
      const { value: grayScopeJson } = await ElMessageBox.prompt(
        '灰度范围 JSON（可选，对齐后端 grayScopeJson）',
        `灰度 ${row.configKey}`,
        { confirmButtonText: '确定', cancelButtonText: '取消', inputType: 'textarea' },
      )
      await grayRelease(row.id, {
        tenantId: tenant.tenantId,
        grayScopeJson: grayScopeJson || undefined,
      })
      ElMessage.success(`已灰度 ${row.configKey}`)
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doRollback(row: ConsoleConfigReleaseResponse) {
    try {
      await ElMessageBox.confirm(`确认回滚 ${row.configKey}？`, '回滚', { type: 'warning' })
      const { value: reason } = await ElMessageBox.prompt('回滚原因（可选）', '回滚', {
        confirmButtonText: '提交',
        cancelButtonText: '取消',
      })
      await rollbackRelease(row.id, { tenantId: tenant.tenantId, reason: reason || undefined })
      ElMessage.success(`已回滚 ${row.configKey}`)
      await load()
    } catch {
      /* cancel */
    }
  }

  const detailVisible = ref(false)
  const detail = ref<Record<string, unknown> | null>(null)

  async function viewDetail(row: ConsoleConfigReleaseResponse) {
    detail.value = (await getConfigRelease(row.id, tenant.tenantId)) as unknown as Record<
      string,
      unknown
    >
    detailVisible.value = true
  }

  async function doSubmitApproval(row: ConsoleConfigReleaseResponse) {
    try {
      const { value: reason } = await ElMessageBox.prompt(
        '提审原因（可选）',
        `提交审批 ${row.configKey}`,
        { confirmButtonText: '提交', cancelButtonText: '取消' },
      )
      await submitReleaseApproval(row.id, {
        tenantId: tenant.tenantId,
        reason: reason || undefined,
      })
      ElMessage.success(`已提交审批 ${row.configKey}`)
      await load()
    } catch {
      /* cancel */
    }
  }

  // --- 依赖查询 ---
  const depsVisible = ref(false)
  const depsLoading = ref(false)
  const depsData = ref<unknown>(null)

  async function doDeps(row: ConsoleConfigReleaseResponse) {
    depsData.value = null
    depsVisible.value = true
    depsLoading.value = true
    try {
      depsData.value = await listConfigDependencies(
        tenant.tenantId,
        String(row.configType ?? ''),
        String(row.configKey ?? ''),
      )
    } finally {
      depsLoading.value = false
    }
  }

  // --- 版本对比 ---
  const diffVisible = ref(false)
  const diffLoading = ref(false)
  const diffData = ref<unknown>(null)
  const diffForm = reactive({ releaseIdA: 0, releaseIdB: 0 })

  function openDiff(row: ConsoleConfigReleaseResponse) {
    diffForm.releaseIdA = row.id
    diffForm.releaseIdB = 0
    diffData.value = null
    diffVisible.value = true
  }

  async function doDiff() {
    diffLoading.value = true
    try {
      diffData.value = await diffConfigReleases(
        tenant.tenantId,
        diffForm.releaseIdA,
        diffForm.releaseIdB,
      )
    } finally {
      diffLoading.value = false
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .release-json {
    margin: 0;
    padding: var(--card-inner-padding);
    max-height: 400px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--font-family-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
    border-radius: var(--radius-input, 4px);
    background: var(--el-fill-color-light);
    border: 1px solid var(--color-border-light);
  }

  .diff-form {
    margin-bottom: var(--card-inner-padding);
  }

  .diff-result {
    margin-top: var(--card-inner-padding);
  }
</style>
