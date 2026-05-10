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
        @change="load"
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
            <el-form-item :label="t('fileTemplateList.codeLabel')">
              <el-input
                v-model="keyword"
                clearable
                :placeholder="t('fileTemplateList.codePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('fileTemplateList.typeLabel')">
              <MetaSelect
                class="query-w-160"
                v-model="templateType"
                :options="templateTypeOptions"
                clearable
                filterable
                enum-key="fileTemplateType"
                :placeholder="t('fileTemplateList.typePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('fileTemplateList.bizTypeLabel')">
              <MetaSelect
                class="query-w-160"
                v-model="bizType"
                :options="bizTypeOptions"
                clearable
                filterable
                :placeholder="t('fileTemplateList.bizTypePlaceholder')"
              />
            </el-form-item>
            <el-form-item :label="t('fileTemplateList.enabledLabel')">
              <el-select
                v-model="enabled"
                clearable
                :placeholder="t('fileTemplateList.enabledPlaceholder')"
                class="query-w-120"
              >
                <el-option :label="t('fileTemplateList.optEnabled')" :value="true" />
                <el-option :label="t('fileTemplateList.optDisabled')" :value="false" />
              </el-select>
            </el-form-item>
          </ListPageQueryBar>
        </template>

        <el-table-column
          prop="templateCode"
          :label="t('fileTemplateList.colCode')"
          min-width="160"
        />
        <el-table-column
          prop="templateName"
          :label="t('fileTemplateList.colName')"
          min-width="180"
        />
        <el-table-column prop="templateType" :label="t('fileTemplateList.colType')" width="120">
          <template #default="{ row }">
            {{ resolveEnumLabel('fileTemplateType', row.templateType) }}
          </template>
        </el-table-column>
        <el-table-column prop="fileFormatType" :label="t('fileTemplateList.colFormat')" width="120">
          <template #default="{ row }">
            {{ resolveEnumLabel('fileTemplateFormat', row.fileFormatType) }}
          </template>
        </el-table-column>
        <el-table-column prop="bizType" :label="t('fileTemplateList.colBizType')" width="120" />
        <el-table-column prop="version" :label="t('fileTemplateList.colVersion')" width="90" />
        <el-table-column :label="t('fileTemplateList.colEnabled')" width="90">
          <template #default="{ row }">
            <StatusTag :value="String(row.enabled)" category="yn" />
          </template>
        </el-table-column>
        <DatetimeColumn prop="updatedAt" :label="t('fileTemplateList.colUpdatedAt')" width="160" />
        <el-table-column :label="t('fileTemplateList.colActions')" width="100" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openDetail(row.templateCode)">
                {{ t('fileTemplateList.actionDetail') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer v-model="detailVisible" :title="t('fileTemplateList.detailTitle')" size="720px">
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
          <JsonPreview :data="detail.queryParamSchema || '—'" />
        </el-descriptions-item>
        <el-descriptions-item label="fieldMappings" :span="2">
          <JsonPreview :data="detail.fieldMappings || '—'" />
        </el-descriptions-item>
        <el-descriptions-item label="description" :span="2">
          <JsonPreview :data="detail.description || '—'" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolveEnumLabel(group: string, value?: string | null): string {
    if (!value) return ''
    const key = `enum.${group}.${value}`
    return te(key) ? t(key) : value
  }
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { getMetaBizTypes, type MetaOption } from '@/api/meta'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import { queryFileTemplateDetail, queryFileTemplates } from '@/api/system'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import type { ConsoleFileTemplateResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const {
    filterBusy: queryActionBusy,
    runRefresh,
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
  // templateType 走后端 enum(完整候选);未到达时 fallback 到 rows 派生
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const templateTypeOptions = computed(() => {
    const fromEnum = pickMetaEnumGroup(metaEnums.value, 'fileTemplateType')
    if (fromEnum.length > 0) return fromEnum
    return Array.from(
      new Set(
        allRows.value.map((row) => row.templateType).filter((item): item is string => !!item),
      ),
    ).map((v) => ({ value: v, label: v }))
  })
  // bizType 是租户级业务字典(独立 API),进页面 + 切租户时拉
  const bizTypeOptions = ref<MetaOption[]>([])
  async function loadBizTypes() {
    try {
      bizTypeOptions.value = await getMetaBizTypes(tenant.tenantId)
    } catch {
      bizTypeOptions.value = []
    }
  }

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
    loadError.value = null
    try {
      const pr = await queryFileTemplates(tenant.tenantId, 1, 200)
      allRows.value = (pr.items ?? []) as ConsoleFileTemplateResponse[]
      syncPage()
    } catch (err) {
      loadError.value = err
      throw err
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

  useTenantReload(() => {
    void load()
    void loadBizTypes()
  })
</script>

<style scoped></style>
