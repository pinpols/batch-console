<template>
  <PageContainer>
    <PageHeader
      title="文件渠道"
      description="只读渠道列表；渠道类型选项来自元数据枚举接口，编码支持模糊筛选。"
    />

    <SectionCard>
      <ProTable
        :data="tableRows"
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
            @refresh="load"
          >
            <el-form-item label="渠道编码">
              <el-input
                v-model="filters.channelCode"
                clearable
                placeholder="渠道编码，模糊匹配"
                style="width: 180px"
              />
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                v-model="filters.channelType"
                clearable
                filterable
                placeholder="全部渠道类型"
                style="width: 160px"
              >
                <el-option
                  v-for="option in channelTypeOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="channelCode" label="渠道编码" min-width="140" />
        <el-table-column prop="channelType" label="类型" width="120" />
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <el-table-column prop="timeoutSeconds" label="超时(s)" width="100" />
        <DatetimeColumn prop="updatedAt" label="更新" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row)">详情</el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer v-model="detailVisible" title="渠道详情" size="680px">
      <el-descriptions v-if="detailRow" :column="2" border size="small">
        <el-descriptions-item label="channelCode">{{ detailRow.channelCode }}</el-descriptions-item>
        <el-descriptions-item label="channelType">{{ detailRow.channelType }}</el-descriptions-item>
        <el-descriptions-item label="enabled">{{
          detailRow.enabled ? '是' : '否'
        }}</el-descriptions-item>
        <el-descriptions-item label="timeoutSeconds">{{
          detailRow.timeoutSeconds ?? '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="updatedAt" :span="2">{{
          detailRow.updatedAt || '—'
        }}</el-descriptions-item>
        <el-descriptions-item label="原始响应" :span="2">
          <pre class="json-preview">{{ JSON.stringify(detailRow, null, 2) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch, computed, reactive } from 'vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { getMetaEnums, type MetaOption } from '@/api/meta'
  import { queryFileChannels } from '@/api/fileChannelsQuery'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { toPageResult } from '@/api/adapters'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import type { ConsoleFileChannelResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const {
    filterBusy: queryActionBusy,
    tableBlocking,
    runSearch,
    runReset,
  } = useListFilterFeedback(loading)
  const allRows = ref<ConsoleFileChannelResponse[]>([])
  const rows = ref<ConsoleFileChannelResponse[]>([])
  const channelTypeOptions = ref<MetaOption[]>([])
  const detailVisible = ref(false)
  const detailRow = ref<ConsoleFileChannelResponse | null>(null)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)

  const filters = reactive({
    channelCode: '',
    channelType: '',
  })

  const filtered = computed(() => {
    let r = allRows.value
    const c = filters.channelCode.trim()
    if (c) r = r.filter((x) => String(x.channelCode ?? '').includes(c))
    const t = filters.channelType.trim()
    if (t) r = r.filter((x) => String(x.channelType ?? '').includes(t))
    return r
  })

  const tableRows = computed(() => rows.value as unknown as Record<string, unknown>[])

  function slicePage() {
    const list = filtered.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    rows.value = pr.records as ConsoleFileChannelResponse[]
  }

  async function load() {
    loading.value = true
    try {
      allRows.value = await queryFileChannels(tenant.tenantId)
      const enums = await getMetaEnums()
      channelTypeOptions.value = enums.channelType ?? []
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
      filters.channelCode = ''
      filters.channelType = ''
      page.value = 1
      slicePage()
    })
  }

  function openDetail(row: ConsoleFileChannelResponse) {
    detailRow.value = row
    detailVisible.value = true
  }

  watch(filters, () => {
    page.value = 1
    slicePage()
  })

  useTenantReload(load)
</script>

<style scoped></style>
