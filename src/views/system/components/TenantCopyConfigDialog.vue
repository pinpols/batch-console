<template>
  <el-drawer
    :append-to-body="true"
    :model-value="modelValue"
    :title="t('tenantCopyConfigDialog.title')"
    direction="rtl"
    size="860px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
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

    <section v-if="recoveries.length || recoveryStorageBlocked" class="recovery-panel">
      <h3>{{ t('tenantCopyConfigDialog.recoveryTitle') }}</h3>
      <el-alert v-if="recoveryStorageBlocked" type="warning" :closable="false" show-icon>
        <template #title>
          {{ t(recoveryScopeMismatch ? 'tenantCopyConfigDialog.recoveryTenantMismatch' : 'tenantCopyConfigDialog.recoveryStorageUnavailable') }}
        </template>
      </el-alert>
      <div v-for="command in recoveries" :key="command.key" class="recovery-entry">
        <span>{{ command.auditTenantId }} · {{ new Date(command.createdAt).toLocaleString() }}</span>
        <el-button size="small" :disabled="recoveryLoading" @click="queryRecovery(command)">
          {{ t('tenantCopyConfigDialog.recoveryQuery') }}
        </el-button>
        <el-button
          v-if="selectedRecovery?.key === command.key && recoveryResult?.status === 'COMPLETE'"
          size="small"
          @click="clearRecovery(command)"
        >
          {{ t('tenantCopyConfigDialog.recoveryClear') }}
        </el-button>
        <el-button
          v-if="selectedRecovery?.key === command.key && recoveryUnknown"
          size="small"
          @click="stopTrackingRecovery(command)"
        >
          {{ t('tenantCopyConfigDialog.recoveryStopTracking') }}
        </el-button>
      </div>
      <div v-if="selectedRecovery" aria-live="polite">
        <el-alert v-if="recoveryUnknown" type="warning" :closable="false" show-icon>
          <template #title>{{ t('tenantCopyConfigDialog.recoveryUnknown') }}</template>
        </el-alert>
        <template v-if="recoveryResult">
          <p>{{ t('tenantCopyConfigDialog.recoveryOperation') }}: {{ recoveryResult.operationId }}</p>
          <p>
            {{ t('tenantCopyConfigDialog.recoveryReceiptStatus') }}:
            {{ recoveryResult.status === 'COMPLETE' ? t('tenantCopyConfigDialog.recoveryComplete') : t('tenantCopyConfigDialog.recoveryUnknown') }}
          </p>
          <div v-for="target in recoveryResult.targets" :key="target.ordinal" class="recovery-target">
            <strong>{{ target.ordinal + 1 }}. {{ target.tenantId }}</strong>
            <el-tag v-if="target.result" :type="target.result.success ? 'success' : 'danger'">
              {{ target.result.success ? t('tenantCopyConfigDialog.recoverySucceeded') : t('tenantCopyConfigDialog.recoveryFailed') }}
            </el-tag>
            <el-tag v-else type="warning">{{ t('tenantCopyConfigDialog.recoveryUnknown') }}</el-tag>
            <pre v-if="target.result">{{ JSON.stringify(target.result, null, 2) }}</pre>
          </div>
        </template>
      </div>
    </section>

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
        </el-table>
      </el-tab-pane>
    </el-tabs>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">
        {{ t('tenantConfigShared.cancel') }}
      </el-button>
      <el-button
        plain
        :loading="previewing === 'copy'"
        :disabled="busy || !canWriteSystem"
        @click="runCopyPreview"
      >
        {{ t('tenantCopyConfigDialog.btnCopyPreview') }}
      </el-button>
      <el-button
        plain
        :loading="previewing === 'overlay'"
        :disabled="busy || !canWriteSystem"
        @click="runOverlayPreview"
      >
        {{ t('tenantCopyConfigDialog.btnOverlayPreview') }}
      </el-button>
      <el-button
        plain
        :loading="previewing === 'matrix'"
        :disabled="busy || !canWriteSystem"
        @click="runMatrix"
      >
        {{ t('tenantCopyConfigDialog.btnMatrix') }}
      </el-button>
      <el-button
        plain
        :loading="saving && lastDryRun"
        :disabled="busy || !canWriteSystem"
        @click="submit(true)"
      >
        {{ t('tenantConfigShared.dryRunPreviewDiff') }}
      </el-button>
      <el-button
        type="danger"
        :loading="saving && !lastDryRun"
        :disabled="busy || !canWriteSystem"
        @click="submit(false)"
      >
        {{ t('tenantCopyConfigDialog.btnRunFormal') }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
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
  import { assessBatchInitOutcome } from '@/utils/batchInitOutcome'
  import { getConfigBatchOperation, type ConfigBatchRecoveryResponse } from '@/api/configBatchRecovery'
  import {
    canReadConfigBatchRecovery,
    clearConfigBatchRecovery,
    createConfigBatchRecovery,
    listConfigBatchRecoveries,
    saveConfigBatchRecovery,
    type ConfigBatchRecovery,
  } from '@/utils/configBatchRecovery'
  import { isConsoleServiceUnavailable } from '@/utils/serviceAvailability'
  import type { Tenant } from '@/api/tenants'
  import { ALL_CONFIG_TYPES, isReservedTenant, isTemplateTenant } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import { usePermission } from '@/composables/usePermission'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { STORAGE_KEYS } from '@/constants/storageKeys'

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
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const { canManageSystem, canWriteSystem } = usePermission()
  const actor = computed(() => String(auth.userInfo?.userId ?? auth.userInfo?.username ?? ''))
  let revision = 0
  let writeRevision = 0
  let previewAttempt = 0
  let disposed = false
  const previewing = ref<'' | 'copy' | 'overlay' | 'matrix'>('')
  const lastDryRun = ref(true)
  const activeResultTab = ref<'diff' | 'matrix'>('diff')
  const diffPreview = ref<TenantConfigDiffPreviewResponse | null>(null)
  const matrixPreview = ref<TenantConfigMatrixResponse | null>(null)
  const recoveries = ref<ConfigBatchRecovery[]>([])
  const recoveryStorageBlocked = ref(false)
  const recoveryScopeMismatch = ref(false)
  const selectedRecovery = ref<ConfigBatchRecovery | null>(null)
  const recoveryResult = ref<ConfigBatchRecoveryResponse | null>(null)
  const recoveryUnknown = ref(false)
  const recoveryLoading = ref(false)
  let recoveryAttempt = 0
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
        validator: (_r, v: unknown[], cb) => {
          if (Array.isArray(v) && v.length > 0) return cb()
          const errorMessage = t('tenantCopyConfigDialog.ruleTargets')
          const validationError = new Error(errorMessage)
          return cb(validationError)
        },
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
  const normalizedJobCodes = computed(() => {
    const trimmedJobCodes = form.jobCodes.map((jobCode) => jobCode.trim())
    return trimmedJobCodes.filter(
      (jobCode, index, candidates) => jobCode && candidates.indexOf(jobCode) === index,
    )
  })
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
      invalidatePreview()
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
    { immediate: true, flush: 'sync' },
  )
  function invalidatePreview() {
    revision += 1
    previewAttempt += 1
    previewing.value = ''
    diffPreview.value = null
    matrixPreview.value = null
  }
  watch(form, invalidatePreview, { flush: 'sync' })
  watch(
    () => form.sourceTenantId,
    (sourceTenantId) => {
      if (form.targetTenantIds.includes(sourceTenantId)) {
        form.targetTenantIds = form.targetTenantIds.filter(
          (tenantId) => tenantId !== sourceTenantId,
        )
      }
    },
    { flush: 'sync' },
  )
  watch([actor, () => tenant.tenantId, canManageSystem], invalidatePreview, { flush: 'sync' })
  watch(
    [() => props.modelValue, actor, () => tenant.tenantId, canManageSystem],
    () => {
      recoveryAttempt += 1
      recoveryLoading.value = false
      selectedRecovery.value = null
      recoveryResult.value = null
      recoveryUnknown.value = false
      recoveries.value = []
      recoveryStorageBlocked.value = false
      recoveryScopeMismatch.value = false
    },
    { immediate: true, flush: 'sync' },
  )
  // 租户 store 先更新响应式值再写入 localStorage，等同步切换结束后读取请求身份。
  watch(
    [() => props.modelValue, actor, () => tenant.tenantId, canManageSystem],
    refreshRecoveries,
    { immediate: true },
  )
  watch(
    canWriteSystem,
    () => {
      writeRevision += 1
      invalidatePreview()
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    recoveryAttempt += 1
    invalidatePreview()
  })

  function refreshRecoveries() {
    if (!props.modelValue || !canManageSystem.value || !actor.value) {
      recoveries.value = []
      recoveryStorageBlocked.value = false
      recoveryScopeMismatch.value = false
      return
    }
    const header = headerTenant()
    if (header === null || header !== tenant.tenantId) {
      recoveries.value = []
      recoveryStorageBlocked.value = true
      recoveryScopeMismatch.value = true
      return
    }
    const stored = listConfigBatchRecoveries(actor.value, header)
    recoveries.value = stored.commands.filter((command) => command.operationKind === 'TENANT_COPY')
    recoveryStorageBlocked.value = stored.blocked
    recoveryScopeMismatch.value = false
  }

  function headerTenant(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.tenantId) ?? ''
    } catch {
      return null
    }
  }

  function currentRecovery(command: ConfigBatchRecovery, attempt: number) {
    return !disposed && props.modelValue && canManageSystem.value && recoveryAttempt === attempt &&
      headerTenant() === command.headerTenant &&
      canReadConfigBatchRecovery(command, actor.value, tenant.tenantId)
  }

  async function queryRecovery(command: ConfigBatchRecovery) {
    if (!props.modelValue || !canManageSystem.value || headerTenant() !== command.headerTenant ||
        !canReadConfigBatchRecovery(command, actor.value, tenant.tenantId)) return
    const attempt = ++recoveryAttempt
    selectedRecovery.value = command
    recoveryResult.value = null
    recoveryUnknown.value = false
    recoveryLoading.value = true
    try {
      const result = await getConfigBatchOperation(command, actor.value, tenant.tenantId)
      if (!currentRecovery(command, attempt)) return
      recoveryResult.value = result
      recoveryUnknown.value = result.status !== 'COMPLETE'
    } catch {
      if (currentRecovery(command, attempt)) recoveryUnknown.value = true
    } finally {
      if (recoveryAttempt === attempt) recoveryLoading.value = false
    }
  }

  function clearRecovery(command: ConfigBatchRecovery) {
    if (!selectedRecovery.value || selectedRecovery.value.key !== command.key ||
        recoveryResult.value?.status !== 'COMPLETE' || headerTenant() !== command.headerTenant ||
        !canReadConfigBatchRecovery(command, actor.value, tenant.tenantId)) return
    if (!clearConfigBatchRecovery(command)) {
      ElMessage.warning(t('tenantCopyConfigDialog.recoveryStorageUnavailable'))
      return
    }
    selectedRecovery.value = null
    recoveryResult.value = null
    recoveryUnknown.value = false
    refreshRecoveries()
  }

  async function stopTrackingRecovery(command: ConfigBatchRecovery) {
    const attempt = recoveryAttempt
    if (!currentRecovery(command, attempt) || selectedRecovery.value?.key !== command.key ||
        !recoveryUnknown.value) return
    try {
      await ElMessageBox.confirm(
        t('tenantCopyConfigDialog.recoveryStopConfirm'),
        t('tenantCopyConfigDialog.recoveryStopTitle'),
        { type: 'warning' },
      )
    } catch {
      return
    }
    if (!currentRecovery(command, attempt) || selectedRecovery.value?.key !== command.key ||
        !recoveryUnknown.value) return
    if (!clearConfigBatchRecovery(command)) {
      ElMessage.warning(t('tenantCopyConfigDialog.recoveryStorageUnavailable'))
      return
    }
    selectedRecovery.value = null
    recoveryResult.value = null
    recoveryUnknown.value = false
    refreshRecoveries()
  }

  function canPreview() {
    // 服务端维护策略按HTTP方法冻结POST，业务只读的预览同样受此边界约束。
    return !disposed && props.modelValue && canWriteSystem.value && !!actor.value
  }

  function currentPreview(inputRevision: number, attempt: number) {
    return canPreview() && revision === inputRevision && previewAttempt === attempt
  }

  function previewPayload() {
    return {
      sourceTenantId: form.sourceTenantId,
      targetTenantIds: [...form.targetTenantIds],
      configTypes: form.configTypes.length ? [...form.configTypes] : undefined,
      jobCodes: normalizedJobCodes.value.length ? [...normalizedJobCodes.value] : undefined,
      includeUnchanged: form.includeUnchanged,
      includeDeleteCandidates: form.includeDeleteCandidates,
    }
  }

  async function runCopyPreview() {
    if (busy.value || !canPreview()) return
    const inputRevision = revision
    const attempt = ++previewAttempt
    previewing.value = 'copy'
    try {
      if (!(await validateCopyForm()) || !currentPreview(inputRevision, attempt)) return
      const payload = previewPayload()
      const response = await previewTenantConfigCopy(payload)
      if (!currentPreview(inputRevision, attempt)) return
      diffPreview.value = response
      activeResultTab.value = 'diff'
    } finally {
      if (previewAttempt === attempt) previewing.value = ''
    }
  }

  async function runOverlayPreview() {
    if (busy.value || !canPreview()) return
    const inputRevision = revision
    const attempt = ++previewAttempt
    previewing.value = 'overlay'
    try {
      if (!(await validateCopyForm()) || !currentPreview(inputRevision, attempt)) return
      const payload = previewPayload()
      const response = await previewTenantConfigOverlay(payload)
      if (!currentPreview(inputRevision, attempt)) return
      diffPreview.value = response
      activeResultTab.value = 'diff'
    } finally {
      if (previewAttempt === attempt) previewing.value = ''
    }
  }

  async function runMatrix() {
    if (busy.value || !canPreview()) return
    const inputRevision = revision
    const attempt = ++previewAttempt
    previewing.value = 'matrix'
    try {
      if (!(await validateCopyForm()) || !currentPreview(inputRevision, attempt)) return
      if (!normalizedJobCodes.value.length) {
        ElMessage.warning(t('tenantCopyConfigDialog.jobCodesRequiredForMatrix'))
        return
      }
      const response = await compareTenantJobConfigMatrix({
        baselineTenantId: form.sourceTenantId,
        tenantIds: [form.sourceTenantId, ...form.targetTenantIds],
        jobCodes: [...normalizedJobCodes.value],
      })
      if (!currentPreview(inputRevision, attempt)) return
      matrixPreview.value = response
      activeResultTab.value = 'matrix'
    } finally {
      if (previewAttempt === attempt) previewing.value = ''
    }
  }

  function actionTagType(action: string | undefined): TagProps['type'] {
    if (action === 'ADD') return 'success'
    if (action === 'UPDATE') return 'warning'
    if (action === 'DELETE_CANDIDATE') return 'danger'
    return 'info'
  }

  async function submit(dryRun: boolean) {
    if (busy.value || !canPreview() || !canWriteSystem.value) return
    const inputRevision = revision
    const permissionRevision = writeRevision
    const isCurrent = () =>
      canPreview() &&
      canWriteSystem.value &&
      revision === inputRevision &&
      writeRevision === permissionRevision
    saving.value = true
    lastDryRun.value = dryRun
    let sent = false
    try {
      if (!(await validateCopyForm()) || !isCurrent()) return
      if (form.targetTenantIds.includes(form.sourceTenantId)) {
        ElMessage.warning(t('tenantCopyConfigDialog.sourceTargetOverlap'))
        return
      }
      const payload = {
        sourceTenantId: form.sourceTenantId,
        targetTenantIds: [...form.targetTenantIds],
        configTypes: form.configTypes.length ? [...form.configTypes] : undefined,
        jobCodes: normalizedJobCodes.value.length ? [...normalizedJobCodes.value] : undefined,
        mode: form.mode,
        dryRun,
      }
      let command: ConfigBatchRecovery | null = null
      if (!dryRun) {
        const header = headerTenant()
        if (header === null || header !== tenant.tenantId) {
          ElMessage.warning(t('tenantCopyConfigDialog.recoveryTenantMismatch'))
          refreshRecoveries()
          return
        }
        try {
          command = createConfigBatchRecovery({
            actor: actor.value,
            headerTenant: header,
            auditTenantId: form.sourceTenantId,
            operationKind: 'TENANT_COPY',
          })
          if (!saveConfigBatchRecovery(command)) throw new Error('storage unavailable')
        } catch {
          ElMessage.warning(t('tenantCopyConfigDialog.recoveryStorageUnavailable'))
          refreshRecoveries()
          return
        }
        refreshRecoveries()
      }
      sent = true
      const res = command ? await copyTenantConfig(payload, command.key) : await copyTenantConfig(payload)
      if (!isCurrent() || (command && headerTenant() !== command.headerTenant)) return
      emit('result', res)
      if (!dryRun) {
        const outcome = res ? assessBatchInitOutcome(res) : null
        if (!outcome?.fullySuccessful) {
          const failedTenants = outcome?.failedTenantIds.length
            ? outcome.failedTenantIds.join(', ')
            : form.targetTenantIds.join(', ')
          ElMessage.warning(t('tenantCopyConfigDialog.toastFailed', { tenants: failedTenants }))
          return
        }
        ElMessage.success(t('tenantCopyConfigDialog.toastDone'))
        if (command && !clearConfigBatchRecovery(command)) {
          ElMessage.warning(t('tenantCopyConfigDialog.recoveryStorageUnavailable'))
          return
        }
        refreshRecoveries()
        emit('update:modelValue', false)
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (
        !dryRun &&
        sent &&
        isCurrent() &&
        (isConsoleServiceUnavailable(error) || status === 409)
      ) {
        ElMessage.warning(t('tenantCopyConfigDialog.unknownOutcome'))
      }
      throw error
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .recovery-panel {
    margin: 12px 0;
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }

  .recovery-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
  }

  .recovery-target pre {
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

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
