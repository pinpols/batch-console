<template>
  <el-drawer
    :append-to-body="true"
    :model-value="modelValue"
    :title="t('tenantCopyConfigDialog.title')"
    direction="rtl"
    size="860px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-alert type="info" :closable="false" show-icon class="mb-12">
      <template #title>{{ t('tenantCopyConfigDialog.infoAlert') }}</template>
    </el-alert>
    <el-form ref="copyFormRef" :model="form" :rules="copyFormRules" label-width="88px">
      <el-form-item :label="t('tenantCopyConfigDialog.fieldSource')" prop="sourceTenantId">
        <el-select
          class="query-w-280"
          v-model="form.sourceTenantId"
          filterable
          :placeholder="t('tenantCopyConfigDialog.sourcePlaceholder')"
        >
          <el-option
            v-for="ten in sourceableItems"
            :key="ten.tenantId"
            :label="`${ten.tenantId} — ${ten.tenantName}`"
            :value="ten.tenantId"
          >
            <span>{{ ten.tenantId }} — {{ ten.tenantName }}</span>
            <el-tag
              v-if="isTemplateTenant(ten.tenantId)"
              size="small"
              type="primary"
              effect="plain"
              class="u-ml-8"
            >
              {{ t('tenantConfigShared.templateTag') }}
            </el-tag>
          </el-option>
        </el-select>
        <div class="field-hint">{{ t('tenantCopyConfigDialog.sourceHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('tenantCopyConfigDialog.fieldTargets')" prop="targetTenantIds">
        <el-select
          v-model="form.targetTenantIds"
          multiple
          filterable
          :placeholder="t('tenantCopyConfigDialog.targetsPlaceholder')"
          class="query-w-full"
        >
          <el-option
            v-for="ten in targetableItems"
            :key="ten.tenantId"
            :label="`${ten.tenantId} — ${ten.tenantName}`"
            :value="ten.tenantId"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('tenantConfigShared.configTypeLabel')">
        <el-checkbox-group v-model="form.configTypes">
          <el-checkbox v-for="ct in ALL_CONFIG_TYPES" :key="ct" :label="ct" :value="ct" />
        </el-checkbox-group>
        <div class="field-hint">{{ t('tenantConfigShared.configTypeHintAll') }}</div>
      </el-form-item>
      <el-form-item :label="t('tenantCopyConfigDialog.fieldJobCodes')">
        <el-input-tag
          v-model="form.jobCodes"
          class="query-w-full"
          :placeholder="t('tenantCopyConfigDialog.jobCodesPlaceholder')"
        />
        <div class="field-hint">{{ t('tenantCopyConfigDialog.jobCodesHint') }}</div>
      </el-form-item>
      <el-form-item :label="t('tenantConfigShared.writeModeLabel')">
        <el-radio-group v-model="form.mode">
          <el-radio value="SKIP_EXISTING">{{ t('tenantConfigShared.modeSkipExisting') }}</el-radio>
          <el-radio value="UPSERT">{{ t('tenantConfigShared.modeUpsert') }}</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="t('tenantCopyConfigDialog.previewOptions')">
        <el-checkbox v-model="form.includeUnchanged">
          {{ t('tenantCopyConfigDialog.includeUnchanged') }}
        </el-checkbox>
        <el-checkbox v-model="form.includeDeleteCandidates">
          {{ t('tenantCopyConfigDialog.includeDeleteCandidates') }}
        </el-checkbox>
      </el-form-item>
    </el-form>

    <el-tabs v-if="hasPreviewData" v-model="activeResultTab" class="preview-tabs">
      <el-tab-pane :label="t('tenantCopyConfigDialog.tabDiff')" name="diff">
        <div v-if="diffPreview" class="preview-panel">
          <div class="metric-row">
            <div v-for="metric in diffMetrics" :key="metric.label" class="metric-item">
              <span class="metric-label">{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
          <el-table
            :data="diffPreview.tenants ?? []"
            size="small"
            border
            class="preview-table"
            max-height="220"
          >
            <el-table-column
              prop="tenantId"
              :label="t('tenantCopyConfigDialog.colTenant')"
              width="130"
              show-overflow-tooltip
            />
            <el-table-column
              prop="addCount"
              :label="t('tenantCopyConfigDialog.colAdd')"
              width="80"
              align="right"
            />
            <el-table-column
              prop="updateCount"
              :label="t('tenantCopyConfigDialog.colUpdate')"
              width="80"
              align="right"
            />
            <el-table-column
              prop="unchangedCount"
              :label="t('tenantCopyConfigDialog.colUnchanged')"
              width="90"
              align="right"
            />
            <el-table-column
              prop="deleteCandidateCount"
              :label="t('tenantCopyConfigDialog.colDeleteCandidate')"
              width="110"
              align="right"
            />
            <el-table-column :label="t('tenantCopyConfigDialog.colImpacts')" min-width="180">
              <template #default="{ row }">
                <el-tag
                  v-for="impact in row.impacts ?? []"
                  :key="`${impact.impactType}:${impact.ref}`"
                  size="small"
                  effect="plain"
                  class="u-mr-6"
                >
                  {{ impact.ref || impact.impactType }}
                </el-tag>
                <span v-if="!row.impacts?.length" class="text-muted">—</span>
              </template>
            </el-table-column>
          </el-table>
          <el-collapse v-if="diffItems.length" class="preview-collapse">
            <el-collapse-item :title="t('tenantCopyConfigDialog.diffItemsTitle')" name="items">
              <el-table :data="diffItems" size="small" border max-height="260">
                <el-table-column
                  prop="tenantId"
                  :label="t('tenantCopyConfigDialog.colTenant')"
                  width="120"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="configType"
                  :label="t('tenantCopyConfigDialog.colConfigType')"
                  width="150"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="configKey"
                  :label="t('tenantCopyConfigDialog.colConfigKey')"
                  min-width="180"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="action"
                  :label="t('tenantCopyConfigDialog.colAction')"
                  width="130"
                >
                  <template #default="{ row }">
                    <el-tag :type="actionTagType(row.action)" size="small" effect="plain">
                      {{ row.action }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="reason"
                  :label="t('tenantCopyConfigDialog.colReason')"
                  min-width="180"
                  show-overflow-tooltip
                />
              </el-table>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-tab-pane>
      <el-tab-pane :label="t('tenantCopyConfigDialog.tabMatrix')" name="matrix">
        <el-table
          v-if="matrixPreview"
          :data="matrixPreview.rows ?? []"
          size="small"
          border
          class="preview-table"
          max-height="320"
        >
          <el-table-column
            prop="tenantId"
            :label="t('tenantCopyConfigDialog.colTenant')"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="jobCode"
            :label="t('tenantCopyConfigDialog.colJobCode')"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="exists"
            :label="t('tenantCopyConfigDialog.colExists')"
            width="90"
            align="center"
          >
            <template #default="{ row }">
              <el-tag :type="row.exists ? 'success' : 'danger'" size="small" effect="plain">
                {{ row.exists ? t('common.yes') : t('common.no') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="enabled"
            :label="t('tenantCopyConfigDialog.colEnabled')"
            width="90"
            align="center"
          >
            <template #default="{ row }">
              <span v-if="row.enabled == null" class="text-muted">—</span>
              <el-tag v-else :type="row.enabled ? 'success' : 'info'" size="small" effect="plain">
                {{ row.enabled ? t('common.yes') : t('common.no') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="scheduleType"
            :label="t('tenantCopyConfigDialog.colSchedule')"
            width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="queueCode"
            :label="t('tenantCopyConfigDialog.colQueue')"
            width="130"
            show-overflow-tooltip
          />
          <el-table-column
            prop="pipelineJobCodes"
            :label="t('tenantCopyConfigDialog.colPipelines')"
            min-width="180"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ (row.pipelineJobCodes ?? []).join(', ') || '—' }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        {{ t('tenantConfigShared.cancel') }}
      </el-button>
      <el-button plain :loading="previewing === 'copy'" :disabled="busy" @click="runCopyPreview">
        {{ t('tenantCopyConfigDialog.btnCopyPreview') }}
      </el-button>
      <el-button
        plain
        :loading="previewing === 'overlay'"
        :disabled="busy"
        @click="runOverlayPreview"
      >
        {{ t('tenantCopyConfigDialog.btnOverlayPreview') }}
      </el-button>
      <el-button plain :loading="previewing === 'matrix'" :disabled="busy" @click="runMatrix">
        {{ t('tenantCopyConfigDialog.btnMatrix') }}
      </el-button>
      <el-button
        plain
        :loading="saving && lastDryRun"
        :disabled="busy && !(saving && lastDryRun)"
        @click="submit(true)"
      >
        {{ t('tenantConfigShared.dryRunPreviewDiff') }}
      </el-button>
      <el-button
        type="danger"
        :loading="saving && !lastDryRun"
        :disabled="busy && !(saving && !lastDryRun)"
        @click="submit(false)"
      >
        {{ t('tenantCopyConfigDialog.btnRunFormal') }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import type { FormRules, TagProps } from 'element-plus'
  import {
    compareTenantJobConfigMatrix,
    copyTenantConfig,
    previewTenantConfigCopy,
    previewTenantConfigOverlay,
    type ConfigType,
    type TenantConfigDiffPreviewResponse,
    type TenantConfigMatrixResponse,
  } from '@/api/ops'
  import type { Tenant } from '@/api/tenants'
  import { ALL_CONFIG_TYPES, isReservedTenant, isTemplateTenant } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const { t } = useI18n({ useScope: 'global' })

  const props = defineProps<{
    modelValue: boolean
    items: Tenant[]
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'result', data: unknown): void
  }>()

  const saving = ref(false)
  const previewing = ref<'' | 'copy' | 'overlay' | 'matrix'>('')
  const lastDryRun = ref(true)
  const activeResultTab = ref<'diff' | 'matrix'>('diff')
  const diffPreview = ref<TenantConfigDiffPreviewResponse | null>(null)
  const matrixPreview = ref<TenantConfigMatrixResponse | null>(null)
  const form = reactive({
    sourceTenantId: '',
    targetTenantIds: [] as string[],
    configTypes: [] as ConfigType[],
    jobCodes: [] as string[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
    includeUnchanged: false,
    includeDeleteCandidates: false,
  })

  const { formRef: copyFormRef, validate: validateCopyForm } = useFormValidate()
  const copyFormRules: FormRules = {
    sourceTenantId: [rules.required(t('tenantCopyConfigDialog.ruleSource'), 'change')],
    targetTenantIds: [
      {
        validator: (_r, v: unknown[], cb) =>
          Array.isArray(v) && v.length > 0
            ? cb()
            : cb(new Error(t('tenantCopyConfigDialog.ruleTargets'))),
        trigger: 'change',
      },
    ],
  }

  // 源租户:排除系统/内置租户(参考 tenantConfigTypes.RESERVED_TENANT_IDS)
  const sourceableItems = computed(() => props.items.filter((x) => !isReservedTenant(x.tenantId)))
  // 目标租户:同样排掉系统租户(系统配置不该被业务租户配置覆盖),且不能选当前源
  const targetableItems = computed(() =>
    props.items.filter((x) => !isReservedTenant(x.tenantId) && x.tenantId !== form.sourceTenantId),
  )
  const busy = computed(() => saving.value || previewing.value !== '')
  const hasPreviewData = computed(() => Boolean(diffPreview.value || matrixPreview.value))
  const normalizedJobCodes = computed(() =>
    form.jobCodes.map((x) => x.trim()).filter((x, idx, arr) => x && arr.indexOf(x) === idx),
  )
  const diffMetrics = computed(() => {
    const s = diffPreview.value?.summary
    return [
      { label: t('tenantCopyConfigDialog.metricTargets'), value: s?.targetTenantCount ?? 0 },
      { label: t('tenantCopyConfigDialog.metricAdd'), value: s?.addCount ?? 0 },
      { label: t('tenantCopyConfigDialog.metricUpdate'), value: s?.updateCount ?? 0 },
      { label: t('tenantCopyConfigDialog.metricUnchanged'), value: s?.unchangedCount ?? 0 },
      {
        label: t('tenantCopyConfigDialog.metricDeleteCandidate'),
        value: s?.deleteCandidateCount ?? 0,
      },
    ]
  })
  const diffItems = computed(() =>
    (diffPreview.value?.tenants ?? []).flatMap((tenant) =>
      (tenant.items ?? []).map((item) => ({
        tenantId: tenant.tenantId,
        configType: item.configType,
        configKey: item.configKey,
        action: item.action,
        reason: item.reason,
      })),
    ),
  )

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      form.sourceTenantId = ''
      form.targetTenantIds = []
      form.configTypes = []
      form.jobCodes = []
      form.mode = 'SKIP_EXISTING'
      form.includeUnchanged = false
      form.includeDeleteCandidates = false
      lastDryRun.value = true
      previewing.value = ''
      activeResultTab.value = 'diff'
      diffPreview.value = null
      matrixPreview.value = null
    },
  )

  function previewPayload() {
    return {
      sourceTenantId: form.sourceTenantId,
      targetTenantIds: form.targetTenantIds,
      configTypes: form.configTypes.length ? form.configTypes : undefined,
      jobCodes: normalizedJobCodes.value.length ? normalizedJobCodes.value : undefined,
      includeUnchanged: form.includeUnchanged,
      includeDeleteCandidates: form.includeDeleteCandidates,
    }
  }

  async function runCopyPreview() {
    if (!(await validateCopyForm())) return
    previewing.value = 'copy'
    try {
      diffPreview.value = await previewTenantConfigCopy(previewPayload())
      activeResultTab.value = 'diff'
    } finally {
      previewing.value = ''
    }
  }

  async function runOverlayPreview() {
    if (!(await validateCopyForm())) return
    previewing.value = 'overlay'
    try {
      diffPreview.value = await previewTenantConfigOverlay(previewPayload())
      activeResultTab.value = 'diff'
    } finally {
      previewing.value = ''
    }
  }

  async function runMatrix() {
    if (!(await validateCopyForm())) return
    if (!normalizedJobCodes.value.length) {
      ElMessage.warning(t('tenantCopyConfigDialog.jobCodesRequiredForMatrix'))
      return
    }
    previewing.value = 'matrix'
    try {
      matrixPreview.value = await compareTenantJobConfigMatrix({
        baselineTenantId: form.sourceTenantId,
        tenantIds: [form.sourceTenantId, ...form.targetTenantIds],
        jobCodes: normalizedJobCodes.value,
      })
      activeResultTab.value = 'matrix'
    } finally {
      previewing.value = ''
    }
  }

  function actionTagType(action: string | undefined): TagProps['type'] {
    if (action === 'ADD') return 'success'
    if (action === 'UPDATE') return 'warning'
    if (action === 'DELETE_CANDIDATE') return 'danger'
    return 'info'
  }

  async function submit(dryRun: boolean) {
    if (!(await validateCopyForm())) return
    saving.value = true
    lastDryRun.value = dryRun
    try {
      const res = await copyTenantConfig({
        sourceTenantId: form.sourceTenantId,
        targetTenantIds: form.targetTenantIds,
        configTypes: form.configTypes.length ? form.configTypes : undefined,
        jobCodes: normalizedJobCodes.value.length ? normalizedJobCodes.value : undefined,
        mode: form.mode,
        dryRun,
      })
      emit('result', res)
      if (!dryRun) {
        ElMessage.success(t('tenantCopyConfigDialog.toastDone'))
        emit('update:modelValue', false)
      }
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .mb-12 {
    margin-bottom: 12px;
  }

  .preview-tabs {
    margin-top: 12px;
  }

  .preview-panel {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    padding: 12px;
  }

  .metric-row {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }

  .metric-item {
    min-width: 0;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    padding: 8px 10px;
    background: var(--el-fill-color-blank);
  }

  .metric-item strong {
    display: block;
    margin-top: 2px;
    font-size: 18px;
    line-height: 1.2;
  }

  .metric-label,
  .text-muted {
    color: var(--el-text-color-secondary);
  }

  .preview-table,
  .preview-collapse {
    margin-top: 8px;
  }

  .u-mr-6 {
    margin-right: 6px;
  }

  @media (max-width: 900px) {
    .metric-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
