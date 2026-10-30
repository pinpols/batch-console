<template>
  <div class="scenario-template-control">
    <div class="scenario-template-control__heading">
      <div>
        <h3>{{ t('tenantPackageImportWizard.templateScopeTitle') }}</h3>
        <p>{{ t('tenantPackageImportWizard.templateScopeHint') }}</p>
      </div>
      <el-checkbox :model-value="model.includes('ALL')" @change="(checked: unknown) => toggleAll(checked === true)">
        {{ t('tenantPackageImportWizard.scenarioAll') }}
      </el-checkbox>
    </div>
    <div class="scenario-template-control__groups">
      <section
        v-for="group in groupedOptions"
        :key="group.key"
        class="scenario-template-control__group"
        :class="{ 'scenario-template-control__group--other': group.key === 'other' }"
      >
        <el-checkbox
          v-if="group.titleKey"
          :model-value="isGroupChecked(group.options)"
          :indeterminate="isGroupIndeterminate(group.options)"
          :disabled="model.includes('ALL')"
          @change="(checked: unknown) => toggleGroup(group.options, checked === true)"
        >
          {{ t(group.titleKey) }}
        </el-checkbox>
        <span v-else class="scenario-template-control__group-title">
          {{ t('tenantPackageImportWizard.scenarioOther') }}
        </span>
        <div class="scenario-template-control__options">
          <el-checkbox
            v-for="option in group.options"
            :key="option.value"
            :model-value="isSelected(option.value)"
            :disabled="model.includes('ALL')"
            @change="(checked: unknown) => toggleScenario(option.value, checked === true)"
          >
            {{ t(option.formatKey ?? option.labelKey) }}
          </el-checkbox>
        </div>
      </section>
    </div>
    <el-button
      class="scenario-template-control__button"
      link
      type="primary"
      :icon="Download"
      :loading="loading"
      :disabled="model.length === 0"
      @click="$emit('download')"
    >
      {{ t('tenantPackageImportWizard.btnDownloadTemplate') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Download } from '@lucide/vue'
  import type { TenantPackageSampleScenario } from '@/api/tenantPackageExcel'

  type ScenarioOption = {
    value: TenantPackageSampleScenario
    labelKey: string
    formatKey?: string
  }
  type ScenarioGroup = {
    key: string
    titleKey?: string
    options: ScenarioOption[]
  }

  const model = defineModel<TenantPackageSampleScenario[]>({ required: true })
  defineProps<{ loading: boolean }>()
  defineEmits<{ download: [] }>()
  const { t } = useI18n({ useScope: 'global' })

  const groupedOptions = computed<ScenarioGroup[]>(() => [
    {
      key: 'import',
      titleKey: 'tenantPackageImportWizard.scenarioImport',
      options: [
        {
          value: 'IMPORT_DELIMITED',
          labelKey: 'tenantPackageImportWizard.scenarioImportDelimited',
          formatKey: 'tenantPackageImportWizard.formatDelimited',
        },
        {
          value: 'IMPORT_FIXED_WIDTH',
          labelKey: 'tenantPackageImportWizard.scenarioImportFixedWidth',
          formatKey: 'tenantPackageImportWizard.formatFixedWidth',
        },
        {
          value: 'IMPORT_EXCEL',
          labelKey: 'tenantPackageImportWizard.scenarioImportExcel',
          formatKey: 'tenantPackageImportWizard.formatExcel',
        },
        {
          value: 'IMPORT_XML',
          labelKey: 'tenantPackageImportWizard.scenarioImportXml',
          formatKey: 'tenantPackageImportWizard.formatXml',
        },
        {
          value: 'IMPORT_JSON',
          labelKey: 'tenantPackageImportWizard.scenarioImportJson',
          formatKey: 'tenantPackageImportWizard.formatJson',
        },
      ],
    },
    {
      key: 'export',
      titleKey: 'tenantPackageImportWizard.scenarioExport',
      options: [
        {
          value: 'EXPORT_DELIMITED',
          labelKey: 'tenantPackageImportWizard.scenarioExportDelimited',
          formatKey: 'tenantPackageImportWizard.formatDelimited',
        },
        {
          value: 'EXPORT_FIXED_WIDTH',
          labelKey: 'tenantPackageImportWizard.scenarioExportFixedWidth',
          formatKey: 'tenantPackageImportWizard.formatFixedWidth',
        },
        {
          value: 'EXPORT_EXCEL',
          labelKey: 'tenantPackageImportWizard.scenarioExportExcel',
          formatKey: 'tenantPackageImportWizard.formatExcel',
        },
        {
          value: 'EXPORT_JSON',
          labelKey: 'tenantPackageImportWizard.scenarioExportJson',
          formatKey: 'tenantPackageImportWizard.formatJson',
        },
      ],
    },
    {
      key: 'other',
      options: [
        { value: 'PROCESS', labelKey: 'tenantPackageImportWizard.scenarioProcess' },
        { value: 'DISPATCH', labelKey: 'tenantPackageImportWizard.scenarioDispatch' },
        { value: 'ATOMIC', labelKey: 'tenantPackageImportWizard.scenarioAtomic' },
        { value: 'WORKFLOW', labelKey: 'tenantPackageImportWizard.scenarioWorkflow' },
        { value: 'SCHEDULE', labelKey: 'tenantPackageImportWizard.scenarioSchedule' },
      ],
    },
  ])

  function toggleAll(checked: boolean) {
    model.value = checked ? ['ALL'] : []
  }

  function toggleScenario(scenario: TenantPackageSampleScenario, checked: boolean) {
    const selected = model.value.filter((item) => item !== 'ALL')
    model.value = checked
      ? [...new Set([...selected, scenario])]
      : selected.filter((item) => item !== scenario)
  }

  function isSelected(scenario: TenantPackageSampleScenario) {
    return model.value.includes('ALL') || model.value.includes(scenario)
  }

  function isGroupChecked(options: ScenarioOption[]) {
    return (
      model.value.includes('ALL') || options.every((option) => model.value.includes(option.value))
    )
  }

  function isGroupIndeterminate(options: ScenarioOption[]) {
    return (
      !model.value.includes('ALL') &&
      options.some((option) => model.value.includes(option.value)) &&
      !isGroupChecked(options)
    )
  }

  function toggleGroup(options: ScenarioOption[], checked: boolean) {
    const selected = model.value.filter((item) => item !== 'ALL')
    const values = options.map((option) => option.value)
    model.value = checked
      ? [...new Set([...selected, ...values])]
      : selected.filter((item) => !values.includes(item))
  }
</script>

<style scoped>
  .scenario-template-control {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
    min-width: 0;
    padding: 0;
  }

  .scenario-template-control__heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .scenario-template-control__heading h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
  }

  .scenario-template-control__heading p {
    margin: 3px 0 0;
    color: var(--color-text-tertiary);
    font-size: 12px;
    line-height: 1.45;
  }

  .scenario-template-control__groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 20px;
    row-gap: 4px;
  }

  .scenario-template-control__group {
    min-width: 0;
    padding: 5px 0 8px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .scenario-template-control__group--other {
    grid-column: 1 / -1;
  }

  .scenario-template-control__options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 8px;
    row-gap: 0;
    padding: 4px 0 0 22px;
  }

  .scenario-template-control__group--other .scenario-template-control__options {
    padding-left: 0;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .scenario-template-control__group-title {
    display: block;
    margin-bottom: 4px;
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 600;
  }

  .scenario-template-control :deep(.el-checkbox) {
    min-width: 0;
    margin-right: 0;
    min-height: 28px;
    white-space: normal;
  }

  .scenario-template-control :deep(.el-checkbox__label) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.35;
  }

  .scenario-template-control :deep(.el-button.scenario-template-control__button) {
    justify-content: flex-start;
    align-self: center;
    width: auto;
    min-height: 34px;
    margin: 0;
    padding: 0 12px;
    border-radius: var(--radius-input);
    font-weight: 600;
  }

  @media (max-width: 1100px) {
    .scenario-template-control__groups {
      column-gap: 14px;
    }

    .scenario-template-control__options {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .scenario-template-control__group--other .scenario-template-control__options {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .scenario-template-control__groups {
      grid-template-columns: minmax(0, 1fr);
    }

    .scenario-template-control__group--other {
      grid-column: auto;
    }

    .scenario-template-control__group--other .scenario-template-control__options {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .scenario-template-control__options {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .scenario-template-control :deep(.el-checkbox__label) {
      white-space: normal;
    }
  }
</style>
