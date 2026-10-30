<template>
  <PageContainer>
    <PageHeader
      :title="t('jobDefinitionWizard.pageTitle')"
      :description="t('jobDefinitionWizard.pageDescription')"
      back-to="/jobs/definitions"
    >
      <template #actions>
        <el-button @click="bundlePrefillVisible = !bundlePrefillVisible">
          {{ t('jobDefinitionWizard.importBundleJson') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <div class="wizard-layout">
        <el-dialog
          v-model="bundlePrefillVisible"
          :title="t('jobDefinitionWizard.prefillDialogTitle')"
          width="640px"
          append-to-body
          :close-on-click-modal="false"
        >
          <el-alert type="info" :closable="false" show-icon class="prefill-dialog__hint">
            <template #title>
              <div class="prefill-hint">
                <div>
                  {{ t('jobDefinitionWizard.prefillSourcePrefix') }}
                  <el-link type="primary" underline="never" @click="goExportSource">
                    {{ t('jobDefinitionWizard.prefillSourceJobList') }}
                  </el-link>
                  {{ t('jobDefinitionWizard.prefillSourceMiddle') }}
                  <strong>{{ t('jobDefinitionWizard.prefillExportBundle') }}</strong>
                  {{ t('jobDefinitionWizard.prefillSourceSuffix') }}
                  <code>job-bundle-&lt;jobCode&gt;.json</code>
                </div>
                <div class="prefill-hint__sub">
                  {{ t('jobDefinitionWizard.prefillSourceHint') }}
                </div>
              </div>
            </template>
          </el-alert>
          <JsonTextareaInput
            v-model="bundlePrefillJson"
            :rows="10"
            expect="object"
            :placeholder="t('jobDefinitionWizard.bundlePrefillJsonPlaceholder')"
          />
          <template #footer>
            <el-button @click="bundlePrefillVisible = false">{{ t('common.cancel') }}</el-button>
            <el-button
              type="primary"
              :disabled="!bundlePrefillJson.trim()"
              @click="applyBundlePrefill"
            >
              {{ t('jobDefinitionWizard.prefillConfirm') }}
            </el-button>
          </template>
        </el-dialog>

        <div class="wizard-steps">
          <el-steps :active="step" finish-status="success" align-center>
            <el-step v-for="item in steps" :key="item.key" :title="item.title" />
          </el-steps>
        </div>

        <div class="wizard-step-banner">
          <div class="wizard-step-banner__idx">{{ step + 1 }} / {{ steps.length }}</div>
          <div class="wizard-step-banner__text">
            <div class="wizard-step-banner__title">{{ current.title }}</div>
            <div class="wizard-step-banner__desc">{{ current.desc }}</div>
          </div>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="128px"
          class="wizard-form"
          @submit.prevent
        >
          <JobConfigBasicForm
            v-if="current.key === 'basic'"
            :model="form"
            :tenant-id="tenant.tenantId"
            :readonly-identity="false"
            :execution-mode-options="executionModeOptions"
            :schedule-type-options="scheduleTypeOptions"
            :queue-options="queueOptions"
            :can-configure-routing="canManageSystem && !writesFrozen"
            :sections="['basic']"
          />
          <JobConfigBasicForm
            v-else-if="current.key === 'schedule'"
            :model="form"
            :tenant-id="tenant.tenantId"
            :execution-mode-options="executionModeOptions"
            :schedule-type-options="scheduleTypeOptions"
            :queue-options="queueOptions"
            :can-configure-routing="canManageSystem && !writesFrozen"
            :sections="['schedule']"
          >
            <template #before>
              <el-alert
                :title="t('jobDefinitionWizard.workflowScheduleBootstrapHint')"
                type="info"
                :closable="false"
                show-icon
              />
            </template>
          </JobConfigBasicForm>
          <JobConfigBasicForm
            v-else-if="current.key === 'resource'"
            :model="form"
            :tenant-id="tenant.tenantId"
            :execution-mode-options="executionModeOptions"
            :schedule-type-options="scheduleTypeOptions"
            :queue-options="queueOptions"
            :can-configure-routing="canManageSystem && !writesFrozen"
            :sections="['resource', 'retry']"
          />
          <JobConfigBasicForm
            v-else-if="current.key === 'trigger'"
            :model="form"
            :tenant-id="tenant.tenantId"
            :execution-mode-options="executionModeOptions"
            :schedule-type-options="scheduleTypeOptions"
            :queue-options="queueOptions"
            :sections="['params']"
          />

          <div v-else-if="current.key === 'associations'" class="association-step">
            <el-alert
              :title="t('jobDefinitionWizard.associationsHint')"
              type="info"
              :closable="false"
            />
            <section class="association-section">
              <h3>{{ t('jobDefinitionWizard.stepFilesTitle') }}</h3>
              <div class="json-step">
                <el-alert
                  :title="t('jobDefinitionWizard.filesHint')"
                  type="info"
                  :closable="false"
                />
                <el-form-item :label="t('jobDefinitionWizard.selectChannelLabel')">
                  <el-select
                    v-model="selectedChannelIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    clearable
                    :loading="associationsLoading"
                    :placeholder="t('jobDefinitionWizard.selectChannelPlaceholder')"
                    class="query-w-full"
                  >
                    <el-option
                      v-for="ch in channelOptions"
                      :key="ch.id"
                      :label="
                        ch.channelName ? `${ch.channelCode} / ${ch.channelName}` : ch.channelCode
                      "
                      :value="ch.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item :label="t('jobDefinitionWizard.selectTemplateLabel')">
                  <el-select
                    v-model="selectedTemplateIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    clearable
                    :loading="associationsLoading"
                    :placeholder="t('jobDefinitionWizard.selectTemplatePlaceholder')"
                    class="query-w-full"
                  >
                    <el-option
                      v-for="tpl in templateOptions"
                      :key="tpl.id"
                      :label="
                        tpl.templateName
                          ? `${tpl.templateCode} / ${tpl.templateName}`
                          : tpl.templateCode
                      "
                      :value="tpl.id"
                    />
                  </el-select>
                </el-form-item>
                <el-collapse>
                  <el-collapse-item
                    :title="t('jobDefinitionWizard.advancedJsonConfig')"
                    name="file-json"
                  >
                    <el-form-item :label="t('jobDefinitionWizard.newChannelsJsonLabel')">
                      <JsonTextareaInput
                        v-model="fileChannelsJson"
                        :rows="4"
                        expect="array"
                        :placeholder="t('jobDefinitionWizard.newChannelsJsonPlaceholder')"
                      />
                    </el-form-item>
                    <el-form-item :label="t('jobDefinitionWizard.newTemplatesJsonLabel')">
                      <JsonTextareaInput
                        v-model="fileTemplatesJson"
                        :rows="4"
                        expect="array"
                        :placeholder="t('jobDefinitionWizard.newTemplatesJsonPlaceholder')"
                      />
                    </el-form-item>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </section>

            <section class="association-section">
              <h3>{{ t('jobDefinitionWizard.stepWorkflowTitle') }}</h3>
              <div class="json-step">
                <el-alert
                  :title="t('jobDefinitionWizard.workflowHint')"
                  type="info"
                  :closable="false"
                />
                <el-form-item :label="t('jobDefinitionWizard.selectWorkflowLabel')">
                  <el-select
                    v-model="selectedWorkflowIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    clearable
                    :loading="associationsLoading"
                    :placeholder="t('jobDefinitionWizard.selectWorkflowPlaceholder')"
                    class="query-w-full"
                  >
                    <el-option
                      v-for="wf in workflowOptions"
                      :key="wf.id"
                      :label="
                        wf.workflowName
                          ? `${wf.workflowCode} / ${wf.workflowName}`
                          : wf.workflowCode
                      "
                      :value="wf.id"
                    />
                  </el-select>
                </el-form-item>
                <el-collapse>
                  <el-collapse-item
                    :title="t('jobDefinitionWizard.advancedJsonConfig')"
                    name="workflow-json"
                  >
                    <el-form-item :label="t('jobDefinitionWizard.newWorkflowsJsonLabel')">
                      <JsonTextareaInput
                        v-model="workflowDefinitionsJson"
                        :rows="8"
                        expect="array"
                        :placeholder="t('jobDefinitionWizard.newWorkflowsJsonPlaceholder')"
                      />
                    </el-form-item>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </section>

            <section class="association-section">
              <h3>{{ t('jobDefinitionWizard.stepAlertsTitle') }}</h3>
              <div class="json-step">
                <el-alert
                  :title="t('jobDefinitionWizard.alertsHint')"
                  type="info"
                  :closable="false"
                />
                <el-form-item :label="t('jobDefinitionWizard.selectAlertRoutingLabel')">
                  <el-select
                    v-model="selectedAlertRoutingIds"
                    multiple
                    filterable
                    collapse-tags
                    collapse-tags-tooltip
                    clearable
                    :loading="associationsLoading"
                    :placeholder="t('jobDefinitionWizard.selectAlertRoutingPlaceholder')"
                    class="query-w-full"
                  >
                    <el-option
                      v-for="ar in alertRoutingOptions"
                      :key="ar.id"
                      :label="ar.team ? `${ar.routeCode} / ${ar.team}` : ar.routeCode"
                      :value="ar.id"
                    />
                  </el-select>
                </el-form-item>
                <el-collapse>
                  <el-collapse-item
                    :title="t('jobDefinitionWizard.advancedJsonConfig')"
                    name="alert-json"
                  >
                    <el-form-item :label="t('jobDefinitionWizard.newAlertRoutingsJsonLabel')">
                      <JsonTextareaInput
                        v-model="alertRoutingsJson"
                        :rows="8"
                        expect="array"
                        :placeholder="t('jobDefinitionWizard.newAlertRoutingsJsonPlaceholder')"
                      />
                    </el-form-item>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </section>
          </div>

          <div v-else class="review-step">
            <JobConfigBasicSection :job="reviewJob" :execution-mode-label="form.executionMode" />
            <el-descriptions :column="2" border size="small" class="bundle-summary">
              <el-descriptions-item label="fileChannels">
                {{ summarizeCount(selectedChannelIds.length, fileChannelsJson) }}
              </el-descriptions-item>
              <el-descriptions-item label="fileTemplates">
                {{ summarizeCount(selectedTemplateIds.length, fileTemplatesJson) }}
              </el-descriptions-item>
              <el-descriptions-item label="workflowDefinitions">
                {{ summarizeCount(selectedWorkflowIds.length, workflowDefinitionsJson) }}
              </el-descriptions-item>
              <el-descriptions-item label="alertRoutings">
                {{ summarizeCount(selectedAlertRoutingIds.length, alertRoutingsJson) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-form>

        <div class="wizard-footer">
          <el-button :disabled="step === 0 || saving" @click="step--">
            {{ t('jobDefinitionWizard.prevStep') }}
          </el-button>
          <el-button
            v-if="step < steps.length - 1"
            type="primary"
            :loading="advancing"
            :disabled="saving"
            @click="next"
          >
            {{ t('jobDefinitionWizard.nextStep') }}
          </el-button>
          <el-button
            v-else
            type="primary"
            :loading="saving"
            :disabled="!canWriteSystem"
            @click="submit"
          >
            {{ t('jobDefinitionWizard.submitCreate') }}
          </el-button>
        </div>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import type { FormInstance, FormRules } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import JsonTextareaInput from '@/components/common/JsonTextareaInput.vue'
  import { jobApi, type JobBundlePayload } from '@/api/job'
  import { assessBatchInitOutcome } from '@/utils/batchInitOutcome'
  import { getMetaEnums, getMetaQueues, type MetaOption } from '@/api/meta'
  import { queryFileChannels } from '@/api/fileChannelsQuery'
  import { queryFileTemplates } from '@/api/system'
  import { workflowApi } from '@/api/workflow'
  import { governanceApi, type GovernanceAlertRoutingRow } from '@/api/governance'
  import { useTenantStore } from '@/stores/tenant'
  import { usePermission } from '@/composables/usePermission'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useAuthStore } from '@/stores/auth'
  import { logError } from '@/utils/logger'
  import type {
    ConsoleFileChannelResponse,
    ConsoleFileTemplateResponse,
    ConsoleWorkflowDefinitionResponse,
  } from '@/types/console-api'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import JobConfigBasicForm from './components/JobConfigBasicForm.vue'
  import JobConfigBasicSection from './components/JobConfigBasicSection.vue'
  import { createEmptyJobEditForm } from './jobEditFormTypes'

  const { t } = useI18n({ useScope: 'global' })
  const steps = computed(
    () =>
      [
        {
          key: 'basic',
          title: t('jobDefinitionWizard.stepBasicTitle'),
          desc: t('jobDefinitionWizard.stepBasicDesc'),
        },
        {
          key: 'schedule',
          title: t('jobDefinitionWizard.stepScheduleTitle'),
          desc: t('jobDefinitionWizard.stepScheduleDesc'),
        },
        {
          key: 'resource',
          title: t('jobDefinitionWizard.stepResourceTitle'),
          desc: t('jobDefinitionWizard.stepResourceDesc'),
        },
        {
          key: 'trigger',
          title: t('jobDefinitionWizard.stepTriggerTitle'),
          desc: t('jobDefinitionWizard.stepTriggerDesc'),
        },
        {
          key: 'associations',
          title: t('jobDefinitionWizard.stepAssociationsTitle'),
          desc: t('jobDefinitionWizard.stepAssociationsDesc'),
        },
        {
          key: 'review',
          title: t('jobDefinitionWizard.stepReviewTitle'),
          desc: t('jobDefinitionWizard.stepReviewDesc'),
        },
      ] as const,
  )
  const router = useRouter()
  const tenant = useTenantStore()
  const { canManageSystem, canWriteSystem } = usePermission()
  const { writesFrozen } = useWriteAvailability()
  const formRef = ref<FormInstance>()
  const step = ref(0)
  const current = computed(() => steps.value[step.value])
  const form = reactive(createEmptyJobEditForm())
  const saving = ref(false)
  const advancing = ref(false)
  const executionModeOptions = ref<MetaOption[]>([])
  const scheduleTypeOptions = ref<MetaOption[]>([])
  const queueOptions = ref<MetaOption[]>([])
  const fileChannelsJson = ref('')
  const fileTemplatesJson = ref('')
  const workflowDefinitionsJson = ref('')
  const alertRoutingsJson = ref('')
  const bundlePrefillVisible = ref(false)
  const bundlePrefillJson = ref('')
  // 拖拽 / 粘贴 / 选文件能力已下沉到 <JsonTextareaInput>,wizard 自身不再维护这些 state
  const channelOptions = ref<(ConsoleFileChannelResponse & { id: number })[]>([])
  const templateOptions = ref<ConsoleFileTemplateResponse[]>([])
  const workflowOptions = ref<ConsoleWorkflowDefinitionResponse[]>([])
  const alertRoutingOptions = ref<GovernanceAlertRoutingRow[]>([])
  const associationsLoading = ref(false)
  const selectedChannelIds = ref<number[]>([])
  const selectedTemplateIds = ref<number[]>([])
  const selectedWorkflowIds = ref<number[]>([])
  const selectedAlertRoutingIds = ref<number[]>([])

  // JobType 由 BE /meta/enums 提供，GENERAL 是默认通用任务。
  form.jobType = 'GENERAL'
  form.scheduleType = 'MANUAL'
  form.executionMode = 'FULL'
  // 新建定义默认禁用:CRON 一旦启用就会按表达式持续触发,
  // 强制创建者先在列表页 dry-run / 校验后再 enable,避免脏数据(参考 e2e-job-* 历史)
  form.enabled = false
  const submissionScope = useTenantRequestScope()
  const navigationScope = useTenantRequestScope()
  const optionsScope = useTenantRequestScope()
  const auth = useAuthStore()
  const actor = computed(() => auth.userInfo?.userId ?? auth.userInfo?.username)
  let submissionRevision = 0
  watch(
    [
      () => form,
      fileChannelsJson,
      fileTemplatesJson,
      workflowDefinitionsJson,
      alertRoutingsJson,
      selectedChannelIds,
      selectedTemplateIds,
      selectedWorkflowIds,
      selectedAlertRoutingIds,
      actor,
      canWriteSystem,
      step,
    ],
    () => {
      submissionRevision += 1
    },
    { deep: true, flush: 'sync' },
  )

  // 表单校验:与编辑 drawer (JobDefinitionList) 一致的口径,避免向导提交后 BE 才报错
  const jobCodePattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/
  const watermarkPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  const jsonValidator = (
    _rule: unknown,
    value: string | undefined,
    callback: (err?: Error) => void,
  ) => {
    if (!value || !value.trim()) return callback()
    try {
      JSON.parse(value)
      callback()
    } catch {
      const errorMessage = t('jobDefinitionWizard.errJsonInvalid')
      const validationError = new Error(errorMessage)
      callback(validationError)
    }
  }
  const watermarkValidator = (_rule: unknown, value: unknown, callback: (err?: Error) => void) => {
    if (form.executionMode !== 'INCREMENTAL') return callback()
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v) {
      const errorMessage = t('jobDefinitionWizard.errWatermarkRequired')
      const validationError = new Error(errorMessage)
      return callback(validationError)
    }
    if (!watermarkPattern.test(v)) {
      const errorMessage = t('jobDefinitionWizard.errWatermarkPattern')
      const validationError = new Error(errorMessage)
      return callback(validationError)
    }
    return callback()
  }
  const jobCodeRefValidator = (_rule: unknown, value: unknown, callback: (err?: Error) => void) => {
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v) return callback()
    if (jobCodePattern.test(v)) return callback()
    const errorMessage = t('jobDefinitionWizard.errJobCodePattern')
    const validationError = new Error(errorMessage)
    return callback(validationError)
  }
  const scheduleExprValidator = (
    _rule: unknown,
    value: unknown,
    callback: (err?: Error) => void,
  ) => {
    if (form.scheduleType === 'MANUAL') return callback()
    const v = typeof value === 'string' ? value.trim() : ''
    if (!v) {
      const errorMessage = t('jobDefinitionWizard.errScheduleExprRequired')
      const validationError = new Error(errorMessage)
      return callback(validationError)
    }
    return callback()
  }
  const rules: FormRules = {
    jobCode: [
      { required: true, message: t('jobDefinitionWizard.errJobCodeRequired'), trigger: 'blur' },
      {
        validator: (_r, v, cb) => {
          if (!v) return cb()
          const candidateJobCode = String(v)
          if (jobCodePattern.test(candidateJobCode)) return cb()
          const errorMessage = t('jobDefinitionWizard.errJobCodePattern')
          const validationError = new Error(errorMessage)
          return cb(validationError)
        },
        trigger: 'blur',
      },
    ],
    jobName: [
      { required: true, message: t('jobDefinitionWizard.errJobNameRequired'), trigger: 'blur' },
    ],
    jobType: [
      { required: true, message: t('jobDefinitionWizard.errJobTypeRequired'), trigger: 'change' },
    ],
    scheduleType: [
      {
        required: true,
        message: t('jobDefinitionWizard.errScheduleTypeRequired'),
        trigger: 'change',
      },
    ],
    executionMode: [
      {
        required: true,
        message: t('jobDefinitionWizard.errExecutionModeRequired'),
        trigger: 'change',
      },
    ],
    watermarkField: [{ validator: watermarkValidator, trigger: 'blur' }],
    dependsOnJobCode: [{ validator: jobCodeRefValidator, trigger: 'blur' }],
    scheduleExpr: [{ validator: scheduleExprValidator, trigger: 'blur' }],
    paramSchema: [{ validator: jsonValidator, trigger: 'blur' }],
    defaultParams: [{ validator: jsonValidator, trigger: 'blur' }],
  }

  // 切非 INCREMENTAL 时自动清空 watermarkField,避免脏数据被 build 进 bundle
  watch(
    () => form.executionMode,
    (mode) => {
      if (mode !== 'INCREMENTAL') form.watermarkField = ''
    },
  )
  // 切 MANUAL 时自动清空 scheduleExpr / calendar / window
  watch(
    () => form.scheduleType,
    (type) => {
      if (type === 'MANUAL') {
        form.scheduleExpr = ''
        form.dependsOnJobCode = ''
        form.calendarCode = ''
        form.windowCode = ''
      }
    },
  )

  const reviewJob = computed(() => ({
    ...form,
    id: 0,
    tenantId: tenant.tenantId,
    createdAt: '',
    updatedAt: '',
  }))

  function clearAssociationOptions() {
    queueOptions.value = []
    channelOptions.value = []
    templateOptions.value = []
    workflowOptions.value = []
    alertRoutingOptions.value = []
    selectedChannelIds.value = []
    selectedTemplateIds.value = []
    selectedWorkflowIds.value = []
    selectedAlertRoutingIds.value = []
  }

  watch(
    [() => tenant.tenantId, actor],
    () => {
      optionsScope.begin()
      clearAssociationOptions()
      associationsLoading.value = false
    },
    { flush: 'sync' },
  )
  useTenantReload(loadWizardOptions)
  watch(actor, () => {
    if (!tenant.tenantId) return
    void loadWizardOptions().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      logError(`Job wizard options reload failed: ${message}`, { kind: 'jobWizardOptions' })
    })
  })

  async function loadWizardOptions() {
    const scope = optionsScope.begin()
    associationsLoading.value = true
    try {
      const [enums, queues] = await Promise.all([getMetaEnums(), getMetaQueues(scope.tenantId)])
      if (!optionsScope.isCurrent(scope)) return
      executionModeOptions.value = enums.executionMode ?? []
      scheduleTypeOptions.value = enums.scheduleType ?? []
      queueOptions.value = queues
      await loadAssociations(scope)
    } finally {
      if (optionsScope.isCurrent(scope)) associationsLoading.value = false
    }
  }

  async function loadAssociations(scope: ReturnType<typeof optionsScope.begin>) {
    const tid = scope.tenantId
    const [channels, templates, workflows, alerts] = await Promise.all([
      queryFileChannels(tid).catch(() => [] as ConsoleFileChannelResponse[]),
      queryFileTemplates(tid, 1, 200)
        .then((p) => p.items ?? [])
        .catch(() => [] as ConsoleFileTemplateResponse[]),
      workflowApi
        .listDefinitions({ tenantId: tid, page: 1, pageSize: 200 })
        .then((r) => r.records ?? [])
        .catch(() => [] as ConsoleWorkflowDefinitionResponse[]),
      governanceApi.listAlertRoutings(tid).catch(() => [] as GovernanceAlertRoutingRow[]),
    ])
    // 同一代次覆盖元数据与关联读取，旧租户回包不能恢复选项或解除新读取状态。
    if (!optionsScope.isCurrent(scope)) return
    channelOptions.value = channels.flatMap((channel) =>
      typeof channel.id === 'number' ? [{ ...channel, id: channel.id }] : [],
    )
    templateOptions.value = templates
    workflowOptions.value = workflows
    alertRoutingOptions.value = alerts
  }

  async function next() {
    if (advancing.value || saving.value || step.value >= steps.value.length - 1) return
    const scope = navigationScope.begin()
    const revision = submissionRevision
    const initialStep = step.value
    advancing.value = true
    try {
      if (initialStep <= 3) {
        const valid = await formRef.value?.validate().catch(() => false)
        if (!valid) return
      }
      // 异步校验只推进发起时的同一步，输入或主体变化后必须重新校验。
      if (
        !navigationScope.isCurrent(scope) ||
        revision !== submissionRevision ||
        step.value !== initialStep
      )
        return
      step.value = initialStep + 1
    } finally {
      advancing.value = false
    }
  }

  function parseArray(raw: string): Array<Record<string, unknown>> {
    if (!raw.trim()) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error(t('jobDefinitionWizard.errJsonMustBeArray'))
    return parsed as Array<Record<string, unknown>>
  }

  function countArray(raw: string) {
    try {
      return parseArray(raw).length
    } catch {
      return t('jobDefinitionWizard.countFormatError')
    }
  }

  function summarizeCount(refCount: number, json: string) {
    const newCount = countArray(json)
    if (typeof newCount === 'string') return newCount
    if (refCount === 0 && newCount === 0) return 0
    if (refCount === 0) return t('jobDefinitionWizard.countCreate', { n: newCount })
    if (newCount === 0) return t('jobDefinitionWizard.countRef', { n: refCount })
    return t('jobDefinitionWizard.countRefAndCreate', { ref: refCount, create: newCount })
  }

  function stringifyArray(value: unknown) {
    return Array.isArray(value) && value.length ? JSON.stringify(value, null, 2) : ''
  }

  function goExportSource() {
    bundlePrefillVisible.value = false
    void router.push('/jobs/definitions')
  }

  function applyBundlePrefill() {
    try {
      const parsed = JSON.parse(bundlePrefillJson.value)
      const payload = parsed?.bundle ?? parsed?.data?.bundle ?? parsed
      const job = Array.isArray(payload?.jobDefinitions) ? payload.jobDefinitions[0] : null
      if (job && typeof job === 'object') {
        Object.assign(form, createEmptyJobEditForm(), job)
        form.jobType = form.jobType || 'GENERAL'
        form.scheduleType = form.scheduleType || 'MANUAL'
        form.executionMode = form.executionMode || 'FULL'
        form.enabled = form.enabled !== false
      }
      fileChannelsJson.value = stringifyArray(payload?.fileChannels)
      fileTemplatesJson.value = stringifyArray(payload?.fileTemplates)
      workflowDefinitionsJson.value = stringifyArray(payload?.workflowDefinitions)
      alertRoutingsJson.value = stringifyArray(payload?.alertRoutings)
      // 预填 bundle 没有显式 ref 概念,统一走 JSON 路径
      selectedChannelIds.value = []
      selectedTemplateIds.value = []
      selectedWorkflowIds.value = []
      selectedAlertRoutingIds.value = []
      bundlePrefillVisible.value = false
      ElMessage.success(t('jobDefinitionWizard.prefillSuccess'))
      bundlePrefillJson.value = ''
    } catch {
      ElMessage.error(t('jobDefinitionWizard.prefillBadJson'))
    }
  }

  function buildBundle(): JobBundlePayload {
    // 引用现有实体: 必须送完整 spec 字段(channelType/channelName/templateType/... 等),
    // 不能只送 {id, code} —— TenantConfigInitApplyHandlers.fileChannelSpec/fileTemplateSpec/...
    // 走 SpecHandler.upsertable() 路径,会读全字段做 upsert,缺字段直接 NPE / 持久化错列。
    // 这里把下拉里选中的整条 response 透传(展开为 Record<string, unknown>),
    // 由后端按 spec 字段名取用,缺失字段保留 null/undefined 不写。
    const channelRefs = selectedChannelIds.value.flatMap((id) => {
      const channel = channelOptions.value.find((candidate) => candidate.id === id)
      return channel ? [{ ...channel } as Record<string, unknown>] : []
    })
    const selectedTemplates = selectedTemplateIds.value.map((id) =>
      templateOptions.value.find((template) => template.id === id),
    )
    const existingTemplates = selectedTemplates.filter(
      (template): template is ConsoleFileTemplateResponse => !!template,
    )
    const templateRefs = existingTemplates.map(
      (template) =>
        ({
          ...template,
        }) as Record<string, unknown>,
    )
    const selectedWorkflows = selectedWorkflowIds.value.map((id) =>
      workflowOptions.value.find((workflow) => workflow.id === id),
    )
    const existingWorkflows = selectedWorkflows.filter(
      (workflow): workflow is ConsoleWorkflowDefinitionResponse => !!workflow,
    )
    const workflowRefs = existingWorkflows.map(
      (workflow) =>
        ({
          ...workflow,
        }) as Record<string, unknown>,
    )
    const selectedAlertRoutings = selectedAlertRoutingIds.value.map((id) =>
      alertRoutingOptions.value.find((routing) => routing.id === id),
    )
    const existingAlertRoutings = selectedAlertRoutings.filter(
      (routing): routing is GovernanceAlertRoutingRow => !!routing,
    )
    const alertRoutingRefs = existingAlertRoutings.map(
      (routing) =>
        ({
          ...routing,
        }) as Record<string, unknown>,
    )

    return {
      jobDefinitions: [
        {
          jobCode: form.jobCode.trim(),
          jobName: form.jobName.trim(),
          jobType: form.jobType,
          bizType: form.bizType.trim() || undefined,
          scheduleType: form.scheduleType,
          scheduleExpr: form.scheduleExpr.trim() || undefined,
          dependsOnJobCode:
            form.scheduleType === 'MANUAL' ? '' : form.dependsOnJobCode.trim() || undefined,
          timezone: form.timezone.trim() || undefined,
          triggerMode: form.triggerMode.trim() || undefined,
          ...(canManageSystem.value
            ? {
                workerGroup: form.workerGroup.trim() || undefined,
                queueCode: form.queueCode || undefined,
              }
            : {}),
          calendarCode: form.calendarCode.trim() || undefined,
          windowCode: form.windowCode.trim() || undefined,
          dagEnabled: form.dagEnabled,
          shardStrategy: form.shardStrategy.trim() || undefined,
          executionMode: form.executionMode,
          watermarkField:
            form.executionMode === 'INCREMENTAL' ? form.watermarkField.trim() : undefined,
          retryPolicy: form.retryPolicy.trim() || undefined,
          retryMaxCount: form.retryMaxCount,
          timeoutSeconds: form.timeoutSeconds,
          executionHandler: form.executionHandler.trim() || undefined,
          paramSchema: form.paramSchema.trim() || undefined,
          defaultParams: form.defaultParams.trim() || undefined,
          priority: form.priority,
          enabled: form.enabled,
          description: form.description.trim() || undefined,
        },
      ],
      fileChannels: [...channelRefs, ...parseArray(fileChannelsJson.value)],
      fileTemplates: [...templateRefs, ...parseArray(fileTemplatesJson.value)],
      workflowDefinitions: [...workflowRefs, ...parseArray(workflowDefinitionsJson.value)],
      alertRoutings: [...alertRoutingRefs, ...parseArray(alertRoutingsJson.value)],
    }
  }

  async function submit() {
    if (saving.value || !canWriteSystem.value) return
    const scope = submissionScope.begin()
    const revision = submissionRevision
    const submittedJobCode = form.jobCode.trim()
    saving.value = true
    try {
      const tenantId = tenant.tenantId
      const bundle = buildBundle()
      const response = await jobApi.createBundle({
        tenantId,
        mode: 'SKIP_EXISTING',
        dryRun: false,
        bundle,
      })
      if (!submissionScope.isCurrent(scope) || revision !== submissionRevision) return
      const outcome = assessBatchInitOutcome(response.result)
      if (!outcome.fullySuccessful) {
        const failedTenantNames = outcome.failedTenantIds.join(', ')
        const tenantSummary = failedTenantNames || tenant.tenantId
        ElMessage.error(
          t('jobDefinitionWizard.createBundleFailed', {
            tenants: tenantSummary,
          }),
        )
        return
      }
      ElMessage.success(t('jobDefinitionWizard.createBundleSuccess'))
      await router.push({ path: '/jobs/definitions', query: { jobCode: submittedJobCode } })
    } catch (error) {
      if (error instanceof SyntaxError) {
        ElMessage.error(t('jobDefinitionWizard.relatedJsonInvalid'))
      } else {
        throw error
      }
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .wizard-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: stretch;
    width: 100%;
    max-width: 1120px;
    margin: 0 auto;
  }

  .wizard-steps {
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
  }

  .wizard-form {
    max-width: 920px;
    margin: 0 auto;
    width: 100%;
  }

  .wizard-form :deep(.el-form-item) {
    width: 100%;
    max-width: none;
  }

  .wizard-form :deep(.el-input),
  .wizard-form :deep(.el-select),
  .wizard-form :deep(.el-input-number) {
    width: 100%;
    max-width: none;
  }

  .wizard-form :deep(.el-form-item__content) {
    min-width: 0;
  }

  .wizard-form :deep(.el-textarea),
  .wizard-form :deep(.el-form-item.query-w-full .el-input),
  .wizard-form :deep(.el-form-item.query-w-full .el-select) {
    width: 100%;
    max-width: none;
  }

  .wizard-form :deep(.code-name-builder),
  .wizard-form :deep(.cnb-row) {
    width: 100%;
  }

  .wizard-form :deep(.cnb-row) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 8px;
  }

  .wizard-form :deep(.cnb-domain),
  .wizard-form :deep(.cnb-biz),
  .wizard-form :deep(.cnb-version) {
    width: 100%;
    min-width: 0;
  }

  .wizard-form :deep(.inline-create-wrapper .inline-create-input) {
    width: auto;
    min-width: 0;
  }

  .wizard-step-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    border-left: 3px solid var(--el-color-primary);
    background: var(--color-bg-subtle, rgba(64, 158, 255, 0.06));
    border-radius: var(--radius-md, 6px);
    max-width: 920px;
    margin: 0 auto;
    width: 100%;
  }

  .wizard-step-banner__idx {
    flex: 0 0 auto;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-color-primary);
    padding: 4px 10px;
    background: var(--el-color-primary-light-9, rgba(64, 158, 255, 0.12));
    border-radius: 12px;
    font-variant-numeric: tabular-nums;
  }

  .wizard-step-banner__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    line-height: 1.4;
  }

  .wizard-step-banner__desc {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 2px;
  }

  .json-step {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .association-step {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .association-section {
    padding-bottom: 20px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .association-section:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }

  .association-section h3 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }

  .prefill-dialog__hint {
    margin-bottom: 12px;
  }

  .prefill-hint {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 400;
    line-height: 1.5;
  }
  .prefill-hint code {
    background: var(--color-bg-page);
    padding: 0 4px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 12px;
  }
  .prefill-hint__sub {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .prefill-dialog__textarea :deep(.el-textarea__inner) {
    font-family: var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 12px;
    line-height: 1.55;
  }

  .review-step {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .bundle-summary {
    width: 100%;
    max-width: 920px;
  }

  .wizard-footer {
    display: flex;
    justify-content: center;
    gap: 12px;
    border-top: 1px solid var(--color-border-light);
    padding-top: 16px;
    width: 100%;
    max-width: 920px;
    margin: 0 auto;
  }

  @media (max-width: 768px) {
    .wizard-layout {
      gap: 18px;
    }

    .wizard-steps :deep(.el-step__title) {
      font-size: 11px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .wizard-steps :deep(.el-step__description) {
      display: none;
    }

    .wizard-form :deep(.el-form-item__label) {
      justify-content: flex-start;
    }

    .wizard-form :deep(.cnb-row) {
      grid-template-columns: minmax(0, 1fr);
    }

    .wizard-form :deep(.cnb-sep) {
      display: none;
    }

    .wizard-footer {
      padding-top: 12px;
    }
  }
</style>
