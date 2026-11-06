<template>
  <el-drawer
    :model-value="modelValue"
    class="tenant-pkg-guide-drawer"
    :title="t('tenantPackageImportWizard.guideDrawerTitle')"
    size="min(1280px, 94vw)"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @open="loadGuideIfNeeded"
  >
    <div v-loading="loading" class="guide">
      <!-- 左侧：工作表目录，按当前筛选显示每张表命中的列数，搜索时直接看出哪些表有结果 -->
      <nav class="guide__nav" :aria-label="t('tenantPackageImportWizard.guideNavTitle')">
        <p class="guide__nav-intro">{{ t('tenantPackageImportWizard.guideDrawerIntroBody') }}</p>
        <p class="guide__nav-title">{{ t('tenantPackageImportWizard.guideNavTitle') }}</p>
        <ul class="guide__sheets">
          <li v-for="item in sheetItems" :key="item.sheet.sheetName">
            <button
              type="button"
              class="guide__sheet"
              :class="{
                'guide__sheet--active': item.sheet.sheetName === activeSheet?.sheetName,
                'guide__sheet--empty': item.matched === 0,
              }"
              :aria-current="item.sheet.sheetName === activeSheet?.sheetName ? 'true' : undefined"
              @click="sheetName = item.sheet.sheetName"
            >
              <span class="guide__sheet-name">{{ item.sheet.sheetName }}</span>
              <span class="guide__sheet-count">
                {{ t('tenantPackageImportWizard.guideNavMatched', { count: item.matched }) }}
              </span>
            </button>
          </li>
        </ul>
      </nav>

      <section class="guide__main">
        <header v-if="activeSheet" class="guide__header">
          <div class="guide__title-row">
            <h3 class="guide__title">{{ activeSheet.sheetName }}</h3>
            <span class="guide__counts">
              {{
                t('tenantPackageImportWizard.guideSheetSummary', {
                  total: activeSheet.columns.length,
                  required: requiredCount,
                })
              }}
            </span>
          </div>
          <p v-if="activeSheet.appliesTo" class="guide__applies">{{ activeSheet.appliesTo }}</p>
        </header>

        <div class="guide__toolbar">
          <!-- 窄屏隐藏左侧目录，改用下拉选择工作表 -->
          <el-select
            v-model="sheetName"
            class="guide__sheet-select"
            filterable
            :placeholder="t('tenantPackageImportWizard.guideSheetPlaceholder')"
            :aria-label="t('tenantPackageImportWizard.guideSheetPlaceholder')"
          >
            <el-option
              v-for="item in sheetItems"
              :key="item.sheet.sheetName"
              :label="`${item.sheet.sheetName}（${t('tenantPackageImportWizard.guideNavMatched', { count: item.matched })}）`"
              :value="item.sheet.sheetName"
            />
          </el-select>
          <el-input
            v-model="keyword"
            class="guide__search"
            clearable
            :prefix-icon="Search"
            :placeholder="t('tenantPackageImportWizard.guideSearchPlaceholder')"
            :aria-label="t('tenantPackageImportWizard.guideSearchPlaceholder')"
          />
          <el-select
            v-model="scenario"
            class="guide__scenario"
            filterable
            :placeholder="t('tenantPackageImportWizard.guideScenarioPlaceholder')"
            :aria-label="t('tenantPackageImportWizard.guideScenarioPlaceholder')"
          >
            <el-option
              v-for="option in scenarioOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-segmented v-model="levelFilter" :options="levelOptions" />
        </div>

        <el-table
          class="guide__table console-table"
          :data="visibleColumns"
          row-key="columnName"
          size="small"
          :empty-text="t('common.noData')"
        >
          <el-table-column type="expand" width="36">
            <template #default="{ row }">
              <div class="guide-detail">
                <div class="guide-detail__block">
                  <strong>{{ t('tenantPackageImportWizard.guideColFillExample') }}</strong>
                  <pre>{{ row.fillExample || row.example || '—' }}</pre>
                </div>
                <div class="guide-detail__side">
                  <div v-if="row.allowedValues?.length" class="guide-detail__block">
                    <strong>{{ t('tenantPackageImportWizard.guideColAllowed') }}</strong>
                    <CopyableText :text="row.allowedValues.join(' / ')" />
                  </div>
                  <div class="guide-detail__block">
                    <strong>{{ t('tenantPackageImportWizard.guideColAppliesTo') }}</strong>
                    <p>{{ row.appliesTo || '—' }}</p>
                  </div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="t('tenantPackageImportWizard.guideColColumn')" min-width="230">
            <template #default="{ row }">
              <div class="guide-column">
                <CopyableText v-if="row.columnName" :text="String(row.columnName)" />
                <span v-else>—</span>
                <el-tag size="small" effect="plain" :type="levelTag(row).type">
                  {{ levelTag(row).label }}
                </el-tag>
                <el-tag v-if="row.readOnly" size="small" type="info" effect="plain">
                  {{ t('tenantPackageImportWizard.guideReadOnly') }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="t('tenantPackageImportWizard.guideColFormat')" width="100">
            <template #default="{ row }">{{ row.format || '—' }}</template>
          </el-table-column>
          <el-table-column
            :label="t('tenantPackageImportWizard.guideColDescription')"
            min-width="260"
          >
            <template #default="{ row }">
              <div class="guide-description">
                <span>{{ row.description || '—' }}</span>
                <div v-if="row.allowedValues?.length" class="guide-description__values">
                  <el-tag
                    v-for="value in row.allowedValues.slice(0, ALLOWED_PREVIEW)"
                    :key="value"
                    size="small"
                    type="info"
                    effect="plain"
                  >
                    {{ value }}
                  </el-tag>
                  <span
                    v-if="row.allowedValues.length > ALLOWED_PREVIEW"
                    class="guide-description__more"
                  >
                    {{
                      t('tenantPackageImportWizard.guideAllowedMore', {
                        count: row.allowedValues.length - ALLOWED_PREVIEW,
                      })
                    }}
                  </span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column :label="t('tenantPackageImportWizard.guideColDefault')" min-width="200">
            <template #default="{ row }">
              <span class="guide-cell-text">{{ row.defaultBehavior || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('tenantPackageImportWizard.guideColExample')" min-width="150">
            <template #default="{ row }">
              <CopyableText v-if="row.example" :text="String(row.example)" />
              <span v-else>—</span>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, ref, shallowRef } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Search } from '@lucide/vue'
  import {
    tenantPackageGuide,
    type TenantPackageColumnGuide,
    type TenantPackageSampleScenario,
    type TenantPackageSheetGuide,
  } from '@/api/tenantPackageExcel'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { guideMatchesScenario } from './tenantPackageGuide'

  defineProps<{ modelValue: boolean }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

  const { t } = useI18n({ useScope: 'global' })

  /** 说明列下直接展示的可选值个数，其余收进展开行。 */
  const ALLOWED_PREVIEW = 6

  type LevelFilter = 'all' | 'required' | 'common' | 'advanced'

  const loading = ref(false)
  const sheets = shallowRef<TenantPackageSheetGuide[]>([])
  const sheetName = ref('')
  const keyword = ref('')
  const scenario = ref<TenantPackageSampleScenario>('ALL')
  const levelFilter = ref<LevelFilter>('all')

  const scenarioOptions = computed<Array<{ label: string; value: TenantPackageSampleScenario }>>(
    () => [
      { label: t('tenantPackageImportWizard.scenarioAll'), value: 'ALL' },
      { label: t('tenantPackageImportWizard.scenarioImportDelimited'), value: 'IMPORT_DELIMITED' },
      {
        label: t('tenantPackageImportWizard.scenarioImportFixedWidth'),
        value: 'IMPORT_FIXED_WIDTH',
      },
      { label: t('tenantPackageImportWizard.scenarioImportExcel'), value: 'IMPORT_EXCEL' },
      { label: t('tenantPackageImportWizard.scenarioImportXml'), value: 'IMPORT_XML' },
      { label: t('tenantPackageImportWizard.scenarioImportJson'), value: 'IMPORT_JSON' },
      { label: t('tenantPackageImportWizard.scenarioExportDelimited'), value: 'EXPORT_DELIMITED' },
      {
        label: t('tenantPackageImportWizard.scenarioExportFixedWidth'),
        value: 'EXPORT_FIXED_WIDTH',
      },
      { label: t('tenantPackageImportWizard.scenarioExportExcel'), value: 'EXPORT_EXCEL' },
      { label: t('tenantPackageImportWizard.scenarioExportJson'), value: 'EXPORT_JSON' },
      { label: t('tenantPackageImportWizard.scenarioProcess'), value: 'PROCESS' },
      { label: t('tenantPackageImportWizard.scenarioDispatch'), value: 'DISPATCH' },
      { label: t('tenantPackageImportWizard.scenarioAtomic'), value: 'ATOMIC' },
      { label: t('tenantPackageImportWizard.scenarioWorkflow'), value: 'WORKFLOW' },
      { label: t('tenantPackageImportWizard.scenarioSchedule'), value: 'SCHEDULE' },
    ],
  )

  const levelOptions = computed(() => [
    { label: t('tenantPackageImportWizard.guideFilterAll'), value: 'all' },
    { label: t('tenantPackageImportWizard.guideFilterRequired'), value: 'required' },
    { label: t('tenantPackageImportWizard.guideFilterCommon'), value: 'common' },
    { label: t('tenantPackageImportWizard.guideFilterAdvanced'), value: 'advanced' },
  ])

  /** 后端 guideLevel 取值为中文层级；必填优先于层级展示。 */
  function levelTag(column: { required?: boolean; guideLevel?: string }): {
    label: string
    type: 'danger' | 'primary' | 'warning' | 'info'
  } {
    if (column.required)
      return { label: t('tenantPackageImportWizard.guideRequired'), type: 'danger' }
    if (column.guideLevel === '常用') {
      return { label: t('tenantPackageImportWizard.guideFilterCommon'), type: 'primary' }
    }
    if (column.guideLevel === '高级') {
      return { label: t('tenantPackageImportWizard.guideFilterAdvanced'), type: 'warning' }
    }
    return { label: t('tenantPackageImportWizard.guideOptional'), type: 'info' }
  }

  function columnMatches(
    column: TenantPackageColumnGuide,
    sheet: TenantPackageSheetGuide,
  ): boolean {
    if (!guideMatchesScenario([sheet.appliesTo ?? '', column.appliesTo ?? ''], scenario.value)) {
      return false
    }
    if (levelFilter.value === 'required' && !column.required) return false
    if (levelFilter.value === 'common' && column.guideLevel !== '常用') return false
    if (levelFilter.value === 'advanced' && column.guideLevel !== '高级') return false
    const query = keyword.value.trim().toLowerCase()
    if (!query) return true
    const searchable = [
      column.columnName,
      column.guideLevel,
      column.format,
      column.description,
      column.example,
      column.fillExample,
      column.defaultBehavior,
      column.appliesTo,
      ...(column.allowedValues ?? []),
    ]
    return searchable.some((value) => value && String(value).toLowerCase().includes(query))
  }

  const sheetItems = computed(() =>
    sheets.value.map((sheet) => ({
      sheet,
      matched: sheet.columns.filter((column) => columnMatches(column, sheet)).length,
    })),
  )

  const activeSheet = computed<TenantPackageSheetGuide | null>(
    () =>
      sheets.value.find((sheet) => sheet.sheetName === sheetName.value) ?? sheets.value[0] ?? null,
  )

  const requiredCount = computed(
    () => activeSheet.value?.columns.filter((column) => column.required).length ?? 0,
  )

  const visibleColumns = computed<TenantPackageColumnGuide[]>(() => {
    const sheet = activeSheet.value
    return sheet ? sheet.columns.filter((column) => columnMatches(column, sheet)) : []
  })

  async function loadGuideIfNeeded() {
    if (sheets.value.length || loading.value) return
    loading.value = true
    try {
      const response = await tenantPackageGuide()
      sheets.value = response.sheets ?? []
      sheetName.value = sheets.value[0]?.sheetName ?? ''
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped>
  :global(.tenant-pkg-guide-drawer .el-drawer__body) {
    padding: 0;
    overflow: hidden;
  }

  .guide {
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    height: 100%;
    min-height: 0;
  }

  .guide__nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    padding: 12px 10px 16px 16px;
    overflow-y: auto;
    border-right: 1px solid var(--color-border-light);
  }

  .guide__nav-intro {
    margin: 0 0 4px;
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.6;
  }

  .guide__nav-title {
    margin: 4px 0 0;
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 600;
  }

  .guide__sheets {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .guide__sheet {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 7px 10px;
    border: 0;
    border-radius: var(--radius-input);
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .guide__sheet:hover {
    background: var(--el-fill-color-light);
  }

  .guide__sheet:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }

  .guide__sheet--active {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--color-primary);
  }

  .guide__sheet--empty {
    color: var(--color-text-placeholder);
  }

  .guide__sheet-name {
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .guide__sheet-count {
    flex-shrink: 0;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .guide__main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    min-height: 0;
    padding: 12px 20px 16px;
    overflow-y: auto;
  }

  .guide__header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .guide__title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 12px;
  }

  .guide__title {
    margin: 0;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 16px;
    font-weight: 600;
  }

  .guide__counts,
  .guide__applies {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  /* 筛选行：搜索伸缩，场景下拉定宽，层级按内容宽度；放不下时整体换行 */
  .guide__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .guide__sheet-select {
    display: none;
    flex: 1 1 100%;
  }

  .guide__search {
    flex: 1 1 240px;
    min-width: 0;
  }

  .guide__scenario {
    flex: 0 1 240px;
    min-width: 180px;
  }

  .guide-column {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .guide-description {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .guide-description__values {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .guide-description__more {
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 20px;
  }

  .guide-cell-text {
    white-space: pre-wrap;
    word-break: break-word;
  }

  .guide-detail {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr);
    gap: 16px;
    padding: 8px 16px 12px;
    color: var(--color-text-secondary);
  }

  .guide-detail__side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .guide-detail__block strong {
    display: block;
    margin-bottom: 6px;
    color: var(--color-text-primary);
  }

  .guide-detail__block p {
    margin: 0;
  }

  .guide-detail pre {
    margin: 0;
    padding: 10px;
    max-height: 260px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    border-radius: var(--radius-input);
    border: 1px solid var(--color-border-light);
    background: var(--el-fill-color-lighter);
    color: var(--color-text-primary);
  }

  @media (max-width: 900px) {
    .guide {
      grid-template-columns: minmax(0, 1fr);
    }

    .guide__nav {
      display: none;
    }

    .guide__sheet-select {
      display: block;
    }

    .guide-detail {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .guide__search,
    .guide__scenario {
      flex-basis: 100%;
    }
  }
</style>
