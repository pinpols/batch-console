<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="load">
          {{ t('common.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <AtomicRuntimePanel />

    <SectionCard>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="atc__intro"
        :title="t('atomicTaskTypeCenter.introTitle')"
      >
        <template #default>
          {{ t('atomicTaskTypeCenter.introBody') }}
        </template>
      </el-alert>

      <div v-if="loadError" class="atc__error">
        <el-alert
          type="error"
          show-icon
          :closable="false"
          :title="t('atomicTaskTypeCenter.loadError')"
        >
          <template #default>
            <el-button type="primary" link @click="load">{{ t('common.retry') }}</el-button>
          </template>
        </el-alert>
      </div>

      <el-skeleton v-else-if="loading && schemas.length === 0" :rows="5" animated />

      <EmptyState
        v-else-if="!loading && schemas.length === 0"
        :description="t('atomicTaskTypeCenter.empty')"
        :image-size="80"
      />

      <el-tabs v-else v-model="activeType" class="atc__tabs">
        <el-tab-pane v-for="schema in schemas" :key="schema.taskType" :name="schema.taskType">
          <template #label>
            <div class="atc__tab-label">
              <span>{{
                tOr(`atomicTaskTypeCenter.typeLabel.${schema.taskType}`, schema.displayName)
              }}</span>
              <el-tag
                v-if="!schema.enabledByDefault"
                size="small"
                type="warning"
                effect="plain"
                class="atc__tab-tag"
              >
                {{ t('atomicTaskTypeCenter.tagDefaultDisabled') }}
              </el-tag>
            </div>
          </template>

          <div class="atc__pane">
            <el-alert
              v-if="!schema.enabledByDefault"
              type="warning"
              :closable="false"
              show-icon
              class="atc__pane-alert"
              :title="t('atomicTaskTypeCenter.warnDefaultDisabledTitle', { type: schema.taskType })"
            >
              <template #default>
                {{ t('atomicTaskTypeCenter.warnDefaultDisabledBody') }}
              </template>
            </el-alert>

            <h3 class="atc__section-title">
              <HelpLabel :tip="t('atomicTaskTypeCenter.atomicTermTip')">
                {{ t('atomicTaskTypeCenter.sectionParameters') }}
              </HelpLabel>
            </h3>
            <el-table
              :data="schema.parameters"
              border
              stripe
              size="small"
              :empty-text="t('atomicTaskTypeCenter.parametersEmpty')"
              class="atc__table"
            >
              <el-table-column
                prop="name"
                :label="t('atomicTaskTypeCenter.colParamName')"
                width="200"
              />
              <el-table-column
                prop="type"
                :label="t('atomicTaskTypeCenter.colParamType')"
                width="120"
              >
                <template #default="{ row }">
                  <el-tag size="small" effect="plain">{{ row.type }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column
                :label="t('atomicTaskTypeCenter.colParamRequired')"
                width="100"
                align="center"
              >
                <template #default="{ row }">
                  <el-tag v-if="row.required" size="small" type="danger" effect="plain">
                    {{ t('atomicTaskTypeCenter.requiredYes') }}
                  </el-tag>
                  <span v-else class="muted">{{ t('atomicTaskTypeCenter.requiredNo') }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="description"
                :label="t('atomicTaskTypeCenter.colParamDescription')"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{
                    tOr(
                      `atomicTaskTypeCenter.paramDesc.${schema.taskType}.${row.name}`,
                      row.description,
                    )
                  }}
                </template>
              </el-table-column>
            </el-table>

            <h3 class="atc__section-title">
              {{ t('atomicTaskTypeCenter.sectionTryForm') }}
            </h3>
            <el-alert
              type="info"
              :closable="false"
              show-icon
              class="atc__pane-alert"
              :title="t('atomicTaskTypeCenter.tryFormHintTitle')"
            >
              <template #default>
                {{ t('atomicTaskTypeCenter.tryFormHintBody') }}
              </template>
            </el-alert>
            <SensitiveFieldAlert
              :value="getDraftDebounced(schema.taskType)"
              :exempt-paths="schema.taskType === 'http' ? ['auth'] : []"
            />
            <el-form
              :model="getDraft(schema.taskType)"
              label-width="160px"
              size="small"
              class="atc__form"
            >
              <el-form-item v-for="p in schema.parameters" :key="p.name" :label="p.name">
                <el-switch
                  v-if="p.type === 'boolean'"
                  :model-value="getDraftBoolean(schema.taskType, p.name)"
                  @update:model-value="
                    (value: unknown) => setDraftValue(schema.taskType, p.name, value)
                  "
                />
                <el-input-number
                  v-else-if="p.type === 'integer' || p.type === 'number'"
                  :model-value="getDraftNumber(schema.taskType, p.name)"
                  controls-position="right"
                  class="atc__num"
                  @update:model-value="
                    (value: unknown) => setDraftValue(schema.taskType, p.name, value)
                  "
                />
                <el-input
                  v-else
                  :model-value="getDraftText(schema.taskType, p.name)"
                  :type="p.type === 'list' || p.type === 'map' ? 'textarea' : 'text'"
                  :placeholder="
                    p.type === 'list'
                      ? '[]'
                      : p.type === 'map'
                        ? '{}'
                        : p.required
                          ? t('common.required')
                          : t('common.optional')
                  "
                  @update:model-value="
                    (value: unknown) => setDraftValue(schema.taskType, p.name, value)
                  "
                />
                <div v-if="p.description" class="atc__field-hint">
                  {{
                    tOr(
                      `atomicTaskTypeCenter.paramDesc.${schema.taskType}.${p.name}`,
                      p.description,
                    )
                  }}
                </div>
              </el-form-item>
            </el-form>
            <div class="atc__form-actions">
              <el-button :icon="DocumentCopy" @click="copyJson(schema.taskType)">
                {{ t('atomicTaskTypeCenter.btnCopyJson') }}
              </el-button>
              <el-button @click="resetDraft(schema.taskType)">
                {{ t('common.reset') }}
              </el-button>
            </div>
            <JsonPreview :data="getDraft(schema.taskType)" />

            <section v-if="canManageSavedConfigs" class="atc__saved-config">
              <h3 class="atc__section-title">
                {{ t('atomicTaskTypeCenter.sectionSavedConfigs') }}
              </h3>
              <p class="atc__saved-config-hint">
                {{ t('atomicTaskTypeCenter.savedConfigHint') }}
              </p>
              <el-alert
                v-if="!tenant.tenantId"
                type="info"
                :closable="false"
                :title="t('atomicTaskTypeCenter.savedConfigTenantRequired')"
              />
              <template v-else>
                <el-alert
                  v-if="savedConfigLoadError"
                  type="error"
                  show-icon
                  :closable="false"
                  :title="t('atomicTaskTypeCenter.savedConfigLoadError')"
                >
                  <template #default>
                    <el-button type="primary" link @click="loadSavedConfigs()">
                      {{ t('common.retry') }}
                    </el-button>
                  </template>
                </el-alert>
                <div class="atc__saved-config-row">
                  <el-select
                    v-model="selectedSavedConfigId"
                    :loading="savedConfigLoading"
                    :placeholder="t('atomicTaskTypeCenter.savedConfigSelectPlaceholder')"
                    clearable
                    class="atc__saved-config-select"
                  >
                    <el-option
                      v-for="item in savedConfigs"
                      :key="String(item.id)"
                      :label="item.name"
                      :value="String(item.id)"
                    />
                  </el-select>
                  <el-button
                    :disabled="!selectedSavedConfigId"
                    @click="applySavedConfig(schema.taskType)"
                  >
                    {{ t('atomicTaskTypeCenter.savedConfigApply') }}
                  </el-button>
                </div>
                <el-form label-width="120px" size="small" class="atc__saved-config-form">
                  <el-form-item :label="t('atomicTaskTypeCenter.savedConfigName')">
                    <el-input
                      v-model="savedConfigName"
                      maxlength="128"
                      show-word-limit
                      :placeholder="t('atomicTaskTypeCenter.savedConfigNamePlaceholder')"
                    />
                  </el-form-item>
                </el-form>
                <el-button
                  type="primary"
                  :loading="savedConfigSaving"
                  :disabled="!canSaveCurrentConfig"
                  @click="saveCurrentConfig(schema.taskType)"
                >
                  {{ t('atomicTaskTypeCenter.savedConfigSave') }}
                </el-button>
              </template>
            </section>

            <h3 class="atc__section-title">{{ t('atomicTaskTypeCenter.sectionSecurity') }}</h3>
            <el-table
              :data="schema.securityGates"
              border
              stripe
              size="small"
              :empty-text="t('atomicTaskTypeCenter.securityEmpty')"
              class="atc__table"
            >
              <el-table-column
                prop="field"
                :label="t('atomicTaskTypeCenter.colSecurityField')"
                width="260"
              >
                <template #default="{ row }">
                  <code>{{ row.field }}</code>
                </template>
              </el-table-column>
              <el-table-column
                prop="meaning"
                :label="t('atomicTaskTypeCenter.colSecurityMeaning')"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  {{
                    tOr(
                      `atomicTaskTypeCenter.gateMeaning.${schema.taskType}.${row.field}`,
                      row.meaning,
                    )
                  }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import AtomicRuntimePanel from './components/AtomicRuntimePanel.vue'
  import { ref, reactive, computed, watch, onUnmounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { RefreshCw as Refresh, Copy as DocumentCopy } from '@lucide/vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import HelpLabel from '@/components/common/HelpLabel.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import SensitiveFieldAlert from '@/components/common/SensitiveFieldAlert.vue'
  import { listAtomicTaskTypeSchemas, type AtomicTaskTypeSchema } from '@/api/atomicTaskTypes'
  import { atomicTaskConfigsApi, type AtomicTaskConfig } from '@/api/atomicTaskConfigs'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { detectSensitiveKeys } from '@/utils/sensitiveKeys'
  import { prepareAtomicTaskConfig } from './atomicTaskConfigDraft'

  const { t, te } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const tenant = useTenantStore()

  // 后端 schema 字段为中文字面量;若 FE 存在对应 i18n 覆盖 key 则用之,否则回退原始 BE 值。
  function tOr(key: string, fallback: string): string {
    return te(key) ? t(key) : fallback
  }

  const schemas = ref<AtomicTaskTypeSchema[]>([])
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const activeType = ref<string>('')
  const savedConfigs = ref<AtomicTaskConfig[]>([])
  const savedConfigLoading = ref(false)
  const savedConfigLoadError = ref(false)
  const savedConfigSaving = ref(false)
  const savedConfigName = ref('')
  const selectedSavedConfigId = ref('')
  let savedConfigRequestId = 0
  // 每个 taskType 维护一份独立 draft;切 tab 不丢
  const drafts = reactive<Record<string, Record<string, unknown>>>({})
  const canManageSavedConfigs = computed(
    () => auth.hasPermission('ROLE_ADMIN') || auth.hasPermission('ROLE_TENANT_ADMIN'),
  )
  const currentSensitivePaths = computed(() => {
    const taskType = activeType.value
    return detectSensitiveKeys(getDraft(taskType), {
      exemptPaths: taskType === 'http' ? ['auth'] : [],
    })
  })
  const canSaveCurrentConfig = computed(
    () =>
      canManageSavedConfigs.value &&
      Boolean(tenant.tenantId.trim()) &&
      Boolean(savedConfigName.value.trim()) &&
      currentSensitivePaths.value.length === 0 &&
      !savedConfigSaving.value,
  )

  function getDraft(taskType: string) {
    if (!drafts[taskType]) drafts[taskType] = {}
    return drafts[taskType]
  }

  function getDraftBoolean(taskType: string, name: string): boolean | undefined {
    const value = getDraft(taskType)[name]
    return typeof value === 'boolean' ? value : undefined
  }

  function getDraftNumber(taskType: string, name: string): number | null | undefined {
    const value = getDraft(taskType)[name]
    return typeof value === 'number' || value === null ? value : undefined
  }

  function getDraftText(taskType: string, name: string): string | undefined {
    const value = getDraft(taskType)[name]
    if (typeof value === 'string') return value
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return JSON.stringify(value)
    }
    return undefined
  }

  function setDraftValue(taskType: string, name: string, value: unknown) {
    const isDraftScalarValue =
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    if (isDraftScalarValue) {
      getDraft(taskType)[name] = value
    }
  }

  // Debounced snapshot for SensitiveFieldAlert(避免每字符触发递归扫描)。
  // 200ms 内多次改动只跑最后一次。snapshot 是 plain object,scan 端只 read,不会 触发 reactivity 反复重算。
  const draftSnapshots = reactive<Record<string, Record<string, unknown>>>({})
  const snapshotTimers: Record<string, ReturnType<typeof setTimeout>> = {}

  function getDraftDebounced(taskType: string): Record<string, unknown> {
    if (!draftSnapshots[taskType]) draftSnapshots[taskType] = {}
    // 触发对应 draft 的 reactivity 读取,使 effect 在 draft 改动时重跑(被 caller computed 包裹)
    const live = getDraft(taskType)
    if (snapshotTimers[taskType]) clearTimeout(snapshotTimers[taskType])
    snapshotTimers[taskType] = setTimeout(() => {
      // 浅拷贝 + JSON 序列化往返,确保 snapshot 是纯净对象(去 proxy)
      try {
        const serializedSnapshot = JSON.stringify(live)
        const plainSnapshot = JSON.parse(serializedSnapshot)
        draftSnapshots[taskType] = plainSnapshot
      } catch {
        draftSnapshots[taskType] = { ...live }
      }
    }, 200)
    return draftSnapshots[taskType]
  }

  onUnmounted(() => {
    for (const k of Object.keys(snapshotTimers)) clearTimeout(snapshotTimers[k])
  })

  function resetDraft(taskType: string) {
    drafts[taskType] = {}
  }

  async function copyJson(taskType: string) {
    const draft = getDraft(taskType)
    const text = JSON.stringify(draft, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success(t('atomicTaskTypeCenter.copySuccess'))
    } catch {
      ElMessage.warning(t('atomicTaskTypeCenter.copyFailed'))
    }
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const list = await listAtomicTaskTypeSchemas()
      schemas.value = list
      if (list.length > 0 && !activeType.value) {
        activeType.value = list[0].taskType
      }
      if (activeType.value) await loadSavedConfigs(activeType.value)
    } catch (err) {
      loadError.value = err
    } finally {
      loading.value = false
    }
  }

  async function loadSavedConfigs(taskType = activeType.value, tenantId = tenant.tenantId) {
    const requestId = ++savedConfigRequestId
    selectedSavedConfigId.value = ''
    savedConfigs.value = []
    savedConfigLoadError.value = false
    if (!tenantId || !taskType || !canManageSavedConfigs.value) {
      savedConfigLoading.value = false
      return
    }
    savedConfigLoading.value = true
    try {
      const result = await atomicTaskConfigsApi.list(tenantId, taskType)
      if (
        requestId !== savedConfigRequestId ||
        tenant.tenantId !== tenantId ||
        activeType.value !== taskType
      ) {
        return
      }
      savedConfigs.value = result ?? []
    } catch {
      if (
        requestId === savedConfigRequestId &&
        tenant.tenantId === tenantId &&
        activeType.value === taskType
      ) {
        savedConfigLoadError.value = true
      }
    } finally {
      if (requestId === savedConfigRequestId) savedConfigLoading.value = false
    }
  }

  function applySavedConfig(taskType: string) {
    const selected = savedConfigs.value.find(
      (item) => String(item.id) === selectedSavedConfigId.value,
    )
    if (!selected || selected.taskType !== taskType || selected.tenantId !== tenant.tenantId) return
    try {
      const parsed: unknown = JSON.parse(selected.parameters)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid parameters')
      }
      const sensitivePaths = detectSensitiveKeys(parsed, {
        exemptPaths: taskType === 'http' ? ['auth'] : [],
      })
      if (sensitivePaths.length > 0) {
        ElMessage.error(t('atomicTaskTypeCenter.savedConfigContainsSensitiveFields'))
        return
      }
      const schema = schemas.value.find((item) => item.taskType === taskType)
      if (!schema) throw new Error('unknown task type')
      const prepared = prepareAtomicTaskConfig(schema, parsed as Record<string, unknown>)
      if (prepared.invalidFields.length > 0) throw new Error('invalid parameters')
      if (prepared.inlineCredentialFields.length > 0) {
        ElMessage.error(t('atomicTaskTypeCenter.savedConfigContainsSensitiveFields'))
        return
      }
      drafts[taskType] = prepared.parameters
      ElMessage.success(t('atomicTaskTypeCenter.savedConfigApplied'))
    } catch {
      ElMessage.error(t('atomicTaskTypeCenter.savedConfigInvalid'))
    }
  }

  async function saveCurrentConfig(taskType: string) {
    const tenantId = tenant.tenantId.trim()
    const name = savedConfigName.value.trim()
    if (!tenantId || !name || !canSaveCurrentConfig.value) return
    const schema = schemas.value.find((item) => item.taskType === taskType)
    if (!schema) return
    const prepared = prepareAtomicTaskConfig(schema, getDraft(taskType))
    if (prepared.invalidFields.length > 0) {
      ElMessage.error(
        t('atomicTaskTypeCenter.savedConfigInvalidParameterTypes', {
          fields: prepared.invalidFields.join(', '),
        }),
      )
      return
    }
    if (prepared.inlineCredentialFields.length > 0) {
      ElMessage.error(t('atomicTaskTypeCenter.savedConfigContainsSensitiveFields'))
      return
    }
    const parameters = prepared.parameters
    if (
      detectSensitiveKeys(parameters, {
        exemptPaths: taskType === 'http' ? ['auth'] : [],
      }).length > 0
    ) {
      ElMessage.error(t('atomicTaskTypeCenter.savedConfigContainsSensitiveFields'))
      return
    }
    savedConfigSaving.value = true
    try {
      await atomicTaskConfigsApi.create({ tenantId, taskType, name, parameters })
      if (tenant.tenantId !== tenantId || activeType.value !== taskType) return
      savedConfigName.value = ''
      ElMessage.success(t('atomicTaskTypeCenter.savedConfigCreated'))
      await loadSavedConfigs(taskType, tenantId)
    } catch {
      if (tenant.tenantId === tenantId && activeType.value === taskType) {
        ElMessage.error(t('atomicTaskTypeCenter.savedConfigCreateError'))
      }
    } finally {
      savedConfigSaving.value = false
    }
  }

  watch(activeType, (taskType) => {
    if (taskType) void loadSavedConfigs(taskType)
  })
  watch(
    () => tenant.tenantId,
    (tenantId) => {
      if (tenantId) return
      savedConfigRequestId += 1
      savedConfigs.value = []
      selectedSavedConfigId.value = ''
      savedConfigLoadError.value = false
      savedConfigLoading.value = false
    },
  )
  useTenantReload(() => loadSavedConfigs())

  void load()
</script>

<style scoped>
  .atc__intro {
    margin-bottom: var(--space-md, 16px);
  }

  .atc__error {
    margin: var(--space-md, 16px) 0;
  }

  .atc__tabs {
    margin-top: var(--space-sm, 12px);
  }

  .atc__tab-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .atc__tab-tag {
    margin-left: 4px;
  }

  .atc__pane {
    padding-top: 4px;
    display: flex;
    flex-direction: column;
    gap: var(--space-md, 16px);
  }

  .atc__pane-alert {
    font-size: 12px;
  }

  .atc__section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: var(--space-sm, 12px) 0 0;
  }

  .atc__table {
    width: 100%;
  }

  .atc__form {
    background: var(--color-bg-subtle, #f7f8fa);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content, 8px);
    padding: 16px;
  }

  .atc__form-actions {
    display: flex;
    gap: 8px;
  }

  .atc__saved-config {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm, 12px);
    padding: 16px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content, 8px);
  }

  .atc__saved-config-hint {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .atc__saved-config-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .atc__saved-config-select {
    min-width: min(320px, 100%);
  }

  .atc__saved-config-form {
    max-width: 640px;
    margin-bottom: -18px;
  }

  .atc__field-hint {
    font-size: 12px;
    color: var(--color-text-tertiary);
    margin-top: 2px;
    line-height: 1.5;
  }

  .atc__num {
    width: 200px;
  }

  .muted {
    color: var(--color-text-tertiary);
  }
</style>
