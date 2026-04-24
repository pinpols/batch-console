<template>
  <PageContainer>
    <PageHeader
      title="文件模板"
      description="模板全量加载后本地筛选；类型与业务类型选项由列表数据归纳。"
    />

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="load"
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
            <el-form-item label="模板编码">
              <el-input v-model="keyword" clearable placeholder="模板编码或名称，模糊匹配" />
            </el-form-item>
            <el-form-item label="模板类型">
              <el-select
                class="query-w-160"
                v-model="templateType"
                clearable
                filterable
                placeholder="全部模板类型"
              >
                <el-option
                  v-for="option in templateTypeOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="业务类型">
              <el-select
                class="query-w-160"
                v-model="bizType"
                clearable
                filterable
                placeholder="全部业务类型"
              >
                <el-option
                  v-for="option in bizTypeOptions"
                  :key="option"
                  :label="option"
                  :value="option"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="启用">
              <el-select v-model="enabled" clearable placeholder="全部" class="query-w-120">
                <el-option label="启用" :value="true" />
                <el-option label="停用" :value="false" />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column prop="templateCode" label="模板编码" min-width="160" />
        <el-table-column prop="templateName" label="名称" min-width="180" />
        <el-table-column prop="templateType" label="类型" width="120" />
        <el-table-column prop="fileFormatType" label="格式" width="120" />
        <el-table-column prop="bizType" label="业务类型" width="120" />
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <DatetimeColumn prop="updatedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row.templateCode)">
                详情
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer v-model="detailVisible" title="模板详情" size="720px">
      <el-descriptions v-if="detail" :column="2" border size="small">
        <el-descriptions-item label="templateCode">{{ detail.templateCode }}</el-descriptions-item>
        <el-descriptions-item label="templateName">{{ detail.templateName }}</el-descriptions-item>
        <el-descriptions-item label="templateType">{{ detail.templateType }}</el-descriptions-item>
        <el-descriptions-item label="fileFormatType">{{
          detail.fileFormatType
        }}</el-descriptions-item>
        <el-descriptions-item label="bizType">{{ detail.bizType }}</el-descriptions-item>
        <el-descriptions-item label="version">{{ detail.version }}</el-descriptions-item>
        <el-descriptions-item label="charset">{{ detail.charset }}</el-descriptions-item>
        <el-descriptions-item label="targetCharset">{{
          detail.targetCharset
        }}</el-descriptions-item>
        <el-descriptions-item label="delimiter">{{ detail.delimiter || '—' }}</el-descriptions-item>
        <el-descriptions-item label="lineSeparator">{{
          detail.lineSeparator || '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="queryParamSchema" :span="2">
          <pre class="json-preview">{{ detail.queryParamSchema || '—' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="fieldMappings" :span="2">
          <pre class="json-preview">{{ detail.fieldMappings || '—' }}</pre>
        </el-descriptions-item>
        <el-descriptions-item label="description" :span="2">
          <pre class="json-preview">{{ detail.description || '—' }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { queryFileTemplateDetail, queryFileTemplates } from '@/api/system'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleFileTemplateResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(loading)
  const detailVisible = ref(false)
  const detail = ref<ConsoleFileTemplateResponse | null>(null)
  const allRows = ref<ConsoleFileTemplateResponse[]>([])
  const rows = ref<ConsoleFileTemplateResponse[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const keyword = ref('')
  const templateType = ref('')
  const bizType = ref('')
  const enabled = ref<boolean | undefined>()
  const templateTypeOptions = computed(() =>
    Array.from(
      new Set(
        allRows.value.map((row) => row.templateType).filter((item): item is string => !!item),
      ),
    ),
  )
  const bizTypeOptions = computed(() =>
    Array.from(
      new Set(allRows.value.map((row) => row.bizType).filter((item): item is string => !!item)),
    ),
  )

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    return allRows.value.filter((row) => {
      if (
        k &&
        !`${row.templateCode} ${row.templateName} ${row.templateType}`.toLowerCase().includes(k)
      ) {
        return false
      }
      if (templateType.value.trim() && !row.templateType?.includes(templateType.value.trim())) {
        return false
      }
      if (bizType.value.trim() && !row.bizType?.includes(bizType.value.trim())) {
        return false
      }
      if (enabled.value != null && row.enabled !== enabled.value) return false
      return true
    })
  })

  function syncPage() {
    const start = (page.value - 1) * pageSize.value
    total.value = filtered.value.length
    rows.value = filtered.value.slice(start, start + pageSize.value)
  }

  async function load() {
    loading.value = true
    try {
      const pr = await queryFileTemplates(tenant.tenantId, 1, 200)
      allRows.value = (pr.items ?? []) as ConsoleFileTemplateResponse[]
      syncPage()
    } finally {
      loading.value = false
    }
  }

  async function openDetail(templateCode: string) {
    detail.value = await queryFileTemplateDetail(tenant.tenantId, templateCode)
    detailVisible.value = true
  }

  function onSearch() {
    return runSearch(() => {
      page.value = 1
      syncPage()
    })
  }

  function reset() {
    return runReset(() => {
      keyword.value = ''
      templateType.value = ''
      bizType.value = ''
      enabled.value = undefined
      page.value = 1
      syncPage()
    })
  }

  watch([page, pageSize], syncPage)

  useTenantReload(load)
</script>

<style scoped></style>
