<template>
  <PageContainer>
    <!-- 照设计 proto-nav-发布管理 dump:页头 18/600 + 右侧新增发布 -->
    <PageHeader>
      <template #actions>
        <el-button :icon="Settings2" @click="openGovernance">
          {{ t('configReleaseList.governanceCatalog') }}
        </el-button>
        <el-button
          v-if="canManageSystem"
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          :disabled="writesFrozen"
          @click="openCreate"
        >
          {{ t('configReleaseList.headerCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <ListPageQueryBar
      class="cr-query"
      :filter-busy="queryActionBusy"
      :refresh-busy="loading"
      :disabled="loading"
      @search="onSearch"
      @reset="reset"
      @refresh="() => runRefresh(load)"
    >
      <el-form-item :label="t('configReleaseList.keyLabel')">
        <el-input
          class="query-w-180"
          v-model="filters.key"
          clearable
          :placeholder="t('configReleaseList.keyPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('configReleaseList.nameLabel')">
        <el-input
          class="query-w-180"
          v-model="filters.name"
          clearable
          :placeholder="t('configReleaseList.namePlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('configReleaseList.statusLabel')">
        <MetaSelect
          class="query-w-200"
          v-model="filters.status"
          clearable
          filterable
          enum-key="configStatus"
          :placeholder="t('configReleaseList.statusPlaceholder')"
          :options="configReleaseStatusOptions"
        />
      </el-form-item>
    </ListPageQueryBar>

    <el-alert
      v-if="loadError"
      class="cr-load-error"
      type="error"
      :closable="false"
      :title="t('configReleaseList.loadError')"
    >
      <el-button size="small" @click="load">{{ t('common.retry') }}</el-button>
    </el-alert>

    <!-- 主体:左时间线卡片流 + 右侧 sticky 详情面板(照 dump 双栏结构) -->
    <div class="cr-layout" v-loading="tableBlocking">
      <div class="cr-timeline">
        <EmptyState
          v-if="!tableBlocking && rows.length === 0"
          :description="t('configReleaseList.listEmpty')"
        />
        <div v-for="row in rows" :key="row.id" class="cr-item">
          <div class="cr-rail">
            <span
              class="cr-rail__dot"
              :class="`cr-tone-border--${configReleaseStatusTone(row.configStatus)}`"
            />
            <span class="cr-rail__line" />
          </div>
          <div
            class="cr-card"
            :class="{ 'is-active': selectedRow?.id === row.id }"
            role="button"
            tabindex="0"
            @click="selectRelease(row)"
            @keydown.enter="selectRelease(row)"
          >
            <div class="cr-card__head">
              <span class="cr-card__key">{{ row.configKey }}</span>
              <span
                class="cr-pill"
                :class="`cr-tone--${configReleaseStatusTone(row.configStatus)}`"
              >
                {{ statusLabel(row.configStatus) }}
              </span>
              <span class="cr-card__spacer" />
              <span class="cr-card__time">{{ fmtDatetime(row.publishedAt ?? row.createdAt) }}</span>
            </div>
            <div class="cr-card__name">{{ row.configName || row.configKey }}</div>
            <div class="cr-card__meta">
              <span>
                {{ t('configReleaseList.colVersion') }}
                <span class="cr-card__meta-num">v{{ row.versionNo }}</span>
              </span>
              <span>
                {{ t('configReleaseList.colType') }}
                <span class="cr-card__meta-val">{{ row.configType || '—' }}</span>
              </span>
              <span>
                {{ t('configReleaseList.colCreatedBy') }}
                <span class="cr-card__meta-val">{{ row.createdBy || '—' }}</span>
              </span>
            </div>
          </div>
        </div>
        <div v-if="total > 0" class="cr-pagination">
          <el-pagination
            background
            layout="total, sizes, prev, pager, next"
            :total="total"
            :page-sizes="[15, 30, 50, 100]"
            v-model:current-page="page"
            v-model:page-size="pageSize"
            @current-change="slicePage"
            @size-change="onPageSizeChange"
          />
        </div>
      </div>

      <aside v-if="selectedRow" class="cr-panel">
        <div class="cr-panel__head">
          <span class="cr-panel__key">{{ selectedRow.configKey }}</span>
          <span
            class="cr-pill"
            :class="`cr-tone--${configReleaseStatusTone(selectedRow.configStatus)}`"
          >
            {{ statusLabel(selectedRow.configStatus) }}
          </span>
        </div>
        <div class="cr-panel__name">{{ selectedRow.configName || selectedRow.configKey }}</div>
        <div class="cr-panel__grid">
          <div class="cr-panel__stat">
            <div class="cr-panel__stat-label">{{ t('configReleaseList.colVersion') }}</div>
            <div class="cr-panel__stat-num">v{{ selectedRow.versionNo }}</div>
          </div>
          <div class="cr-panel__stat">
            <div class="cr-panel__stat-label">{{ t('configReleaseList.colCreatedBy') }}</div>
            <div class="cr-panel__stat-text">{{ selectedRow.createdBy || '—' }}</div>
          </div>
        </div>
        <div class="cr-panel__section">{{ t('configReleaseList.panelInfoTitle') }}</div>
        <div class="cr-panel__list">
          <div v-for="item in panelInfoItems" :key="item.label" class="cr-panel__list-item">
            <span class="cr-panel__list-dot">·</span>
            <span class="cr-panel__list-text">{{ item.label }}: {{ item.value }}</span>
          </div>
        </div>
        <div class="cr-panel__actions">
          <el-button
            v-if="canManageSystem && selectedRow.configStatus === 'DRAFT'"
            type="primary"
            class="cr-panel__btn"
            :disabled="writesFrozen"
            @click="doSubmitApproval(selectedRow)"
          >
            {{ t('configReleaseList.actionSubmit') }}
          </el-button>
          <el-button class="cr-panel__btn" @click="viewDetail(selectedRow)">
            {{ t('configReleaseList.actionDetail') }}
          </el-button>
        </div>
        <div class="cr-panel__actions cr-panel__actions--secondary">
          <el-button size="small" plain @click="openDiff(selectedRow)">
            {{ t('configReleaseList.actionDiff') }}
          </el-button>
          <el-button size="small" plain @click="doDeps(selectedRow)">
            {{ t('configReleaseList.actionDeps') }}
          </el-button>
          <el-button
            v-if="canManageSystem && ['PUBLISHED', 'GRAY'].includes(selectedRow.configStatus)"
            size="small"
            plain
            type="danger"
            :disabled="writesFrozen"
            @click="doRollback(selectedRow)"
          >
            {{ t('configReleaseList.actionRollback') }}
          </el-button>
        </div>
      </aside>
    </div>

    <el-drawer
      :append-to-body="true"
      v-model="governanceVisible"
      :title="t('configReleaseList.governanceCatalog')"
      size="760px"
    >
      <el-table v-loading="governanceLoading" :data="governanceItems" height="calc(100vh - 180px)">
        <el-table-column :label="t('configReleaseList.governanceClass')" min-width="210">
          <template #default="{ row }">
            <span class="cr-governance__class">{{ row.className }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="prefix"
          :label="t('configReleaseList.governancePrefix')"
          min-width="240"
        />
        <el-table-column :label="t('configReleaseList.configSource')" width="140">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ configSourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('configReleaseList.activationMode')" min-width="190">
          <template #default="{ row }">
            <el-tag :type="row.restartRequired ? 'warning' : 'success'" size="small" effect="plain">
              {{ activationLabel(row.activation) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('configReleaseList.governanceSensitivity')" width="120">
          <template #default="{ row }">
            <el-tag :type="row.sensitivity === 'SECRET' ? 'danger' : 'info'" size="small">
              {{ sensitivityLabel(row.sensitivity) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="createVisible"
      :title="t('configReleaseList.createTitle')"
      size="520px"
      :before-close="onCreateClose"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        :disabled="createSaving"
        label-width="120px"
        @submit.prevent="submitCreate"
      >
        <el-form-item :label="t('configReleaseList.createKeyLabel')" prop="configKey">
          <el-input
            v-model="createForm.configKey"
            maxlength="128"
            show-word-limit
            :placeholder="t('configReleaseList.createKeyPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('configReleaseList.createTypeLabel')" prop="configType">
          <el-input
            v-model="createForm.configType"
            maxlength="64"
            :placeholder="t('configReleaseList.createTypePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('configReleaseList.createNameLabel')" prop="configName">
          <el-input
            v-model="createForm.configName"
            maxlength="128"
            show-word-limit
            :placeholder="t('configReleaseList.createNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('configReleaseList.createPayloadLabel')" prop="configPayloadJson">
          <el-input
            v-model="createForm.configPayloadJson"
            type="textarea"
            :rows="12"
            maxlength="1048576"
            :placeholder="t('configReleaseList.createPayloadPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('configReleaseList.createNoteLabel')" prop="releaseNote">
          <el-input
            v-model="createForm.releaseNote"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            :placeholder="t('configReleaseList.createNotePlaceholder')"
          />
        </el-form-item>
        <div class="form-action-bar">
          <el-button native-type="button" :disabled="createSaving" @click="closeCreate">
            {{ t('common.cancel') }}
          </el-button>
          <el-button type="primary" native-type="submit" :loading="createSaving">
            {{ t('configReleaseList.createSubmit') }}
          </el-button>
        </div>
      </el-form>
    </el-drawer>

    <el-drawer
      :append-to-body="true"
      v-model="depsVisible"
      :title="t('configReleaseList.depsTitle')"
      size="640px"
    >
      <div v-loading="depsLoading">
        <EmptyState
          v-if="!depsLoading && !depsData"
          :description="t('configReleaseList.depsEmpty')"
        />
        <JsonPreview v-else class="release-json" :data="depsData" />
      </div>
    </el-drawer>

    <el-dialog v-model="diffVisible" :title="t('configReleaseList.diffTitle')" width="800px">
      <el-form :inline="true" class="diff-form">
        <el-form-item :label="t('configReleaseList.diffVersionA')">
          <el-select
            class="query-w-240"
            v-model="diffForm.releaseIdA"
            filterable
            :placeholder="t('configReleaseList.diffPlaceholder')"
          >
            <el-option
              v-for="r in allRows"
              :key="r.id"
              :label="`#${r.id} ${r.configKey} v${r.versionNo}`"
              :value="r.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('configReleaseList.diffVersionB')">
          <el-select
            class="query-w-240"
            v-model="diffForm.releaseIdB"
            filterable
            :placeholder="t('configReleaseList.diffPlaceholder')"
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
            {{ t('configReleaseList.diffButton') }}
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="diffData" class="diff-result">
        <JsonPreview class="release-json" :data="diffData" />
      </div>
    </el-dialog>

    <el-drawer
      :append-to-body="true"
      v-model="detailVisible"
      :title="t('configReleaseList.detailTitle')"
      size="640px"
    >
      <el-descriptions v-if="detail" :column="2" border size="small">
        <el-descriptions-item :label="t('common.id')">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item :label="t('configReleaseList.detailConfigKey')">{{
          detail.configKey
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('configReleaseList.detailConfigName')">{{
          detail.configName
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('configReleaseList.detailConfigStatus')">{{
          detail.configStatus
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('configReleaseList.detailVersion')">{{
          detail.versionNo
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('configReleaseList.detailPublishedAt')">{{
          detail.publishedAt
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('configReleaseList.detailRawResponse')" :span="2">
          <JsonPreview :data="detail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, watch, computed, reactive } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, Settings2 } from '@lucide/vue'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useDirtyForm } from '@/composables/useDirtyForm'
  import { useFormFocus } from '@/composables/useFormFocus'
  import { usePermission } from '@/composables/usePermission'
  import { useWriteAvailability } from '@/composables/useWriteAvailability'
  import {
    createConfigRelease,
    listConfigReleases,
    rollbackRelease,
    getConfigRelease,
    submitReleaseApproval,
    listConfigDependencies,
    diffConfigReleases,
    listConfigGovernance,
  } from '@/api/configReleases'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import { fmtDatetime } from '@/utils/datetime'
  import {
    configReleaseStatusTone,
    createConfigReleaseStatusLabel,
  } from './configReleasePresentation'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import type {
    ConfigGovernanceItemResponse,
    ConsoleConfigReleaseResponse,
  } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })
  const statusLabel = createConfigReleaseStatusLabel(t, te)
  const { canManageSystem } = usePermission()
  const { writesFrozen } = useWriteAvailability()

  const tenant = useTenantStore()
  const auth = useAuthStore()
  const listScope = useTenantRequestScope()
  const detailScope = useTenantRequestScope()
  const depsScope = useTenantRequestScope()
  const diffScope = useTenantRequestScope()
  const actionScope = useTenantRequestScope()
  const createScope = useTenantRequestScope()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
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
  const pageSize = ref(15)

  const filters = reactive({
    key: '',
    name: '',
    status: '',
  })
  const createVisible = ref(false)
  const governanceVisible = ref(false)
  const governanceLoading = ref(false)
  const governanceItems = ref<ConfigGovernanceItemResponse[]>([])
  const createSaving = ref(false)
  const createFormRef = ref<FormInstance>()
  const createForm = reactive({
    configKey: '',
    configType: '',
    configName: '',
    configPayloadJson: '',
    releaseNote: '',
  })
  const createRules: FormRules = {
    configKey: [{ required: true, message: t('configReleaseList.ruleCreateKey'), trigger: 'blur' }],
    configType: [
      { required: true, message: t('configReleaseList.ruleCreateType'), trigger: 'blur' },
    ],
    configName: [
      { required: true, message: t('configReleaseList.ruleCreateName'), trigger: 'blur' },
    ],
    configPayloadJson: [
      { required: true, message: t('configReleaseList.ruleCreatePayload'), trigger: 'blur' },
      {
        validator: (_rule, value: string, callback) => {
          try {
            const parsed = JSON.parse(value)
            if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
              const errorMessage = t('configReleaseList.ruleCreatePayloadObject')
              const validationError = new Error(errorMessage)
              callback(validationError)
              return
            }
            callback()
          } catch {
            const errorMessage = t('configReleaseList.ruleCreatePayloadJson')
            const validationError = new Error(errorMessage)
            callback(validationError)
          }
        },
        trigger: 'blur',
      },
    ],
  }

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const configReleaseStatusOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'configStatus'),
  )

  async function openGovernance() {
    governanceVisible.value = true
    if (governanceItems.value.length > 0) return
    governanceLoading.value = true
    try {
      governanceItems.value = await listConfigGovernance()
    } finally {
      governanceLoading.value = false
    }
  }

  const filtered = computed(() => {
    let r = allRows.value
    const k = filters.key.trim()
    if (k) r = r.filter((x) => String(x.configKey ?? '').includes(k))
    const n = filters.name.trim()
    if (n) r = r.filter((x) => String(x.configName ?? '').includes(n))
    const s = filters.status.trim()
    if (s) {
      r = r.filter((x) => {
        const rowStatusText = String(x.configStatus ?? '')
        const rowStatus = rowStatusText.toUpperCase()
        const filterStatus = s.toUpperCase()
        return rowStatus === filterStatus
      })
    }
    return r
  })

  function slicePage() {
    const list = filtered.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    rows.value = pr.records as ConsoleConfigReleaseResponse[]
    total.value = pr.total
  }

  function onPageSizeChange() {
    page.value = 1
    slicePage()
  }

  // ── 照 dump 双栏结构:左侧时间线卡片选中项驱动右侧 sticky 面板 ────────────
  const selectedId = ref<number | null>(null)
  const selectedRow = computed<ConsoleConfigReleaseResponse | null>(
    () => rows.value.find((r) => r.id === selectedId.value) ?? rows.value[0] ?? null,
  )

  function selectRelease(row: ConsoleConfigReleaseResponse) {
    selectedId.value = row.id
  }

  function enumLabel(group: string, value?: string | null): string {
    const v = String(value ?? '')
    if (!v) return '—'
    const key = `configReleaseList.${group}.${v}`
    return te(key) ? t(key) : v
  }

  function configSourceLabel(value?: string | null): string {
    return enumLabel('configSourceEnum', value)
  }

  function activationLabel(value?: string | null): string {
    return enumLabel('activationEnum', value)
  }

  function sensitivityLabel(value?: string | null): string {
    return enumLabel('sensitivityEnum', value)
  }

  const panelInfoItems = computed(() => {
    const r = selectedRow.value
    if (!r) return []
    return [
      { label: t('configReleaseList.colType'), value: r.configType || '—' },
      { label: t('configReleaseList.configSource'), value: configSourceLabel(r.configSource) },
      { label: t('configReleaseList.activationMode'), value: activationLabel(r.activationMode) },
      {
        label: t('configReleaseList.restartRequired'),
        value: r.restartRequired ? t('common.yes') : t('common.no'),
      },
      {
        label: t('configReleaseList.applyConfirmationStatus'),
        value: r.applyConfirmationStatus || '—',
      },
      { label: t('configReleaseList.colPublishedAt'), value: fmtDatetime(r.publishedAt) },
      { label: t('configReleaseList.colEffectiveFrom'), value: fmtDatetime(r.effectiveFromAt) },
      { label: t('configReleaseList.colEffectiveTo'), value: fmtDatetime(r.effectiveToAt) },
      { label: t('configReleaseList.colRolledBackAt'), value: fmtDatetime(r.rolledBackAt) },
    ]
  })

  async function load() {
    const scope = listScope.begin()
    if (!scope.tenantId) return
    loading.value = true
    loadError.value = null
    try {
      const result = await listConfigReleases(scope.tenantId)
      if (!listScope.isCurrent(scope)) return
      allRows.value = result
      page.value = 1
      slicePage()
    } catch (err) {
      if (!listScope.isCurrent(scope)) return
      loadError.value = err
      throw err
    } finally {
      if (listScope.isCurrent(scope)) loading.value = false
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

  function resetCreateForm() {
    createForm.configKey = ''
    createForm.configType = ''
    createForm.configName = ''
    createForm.configPayloadJson = ''
    createForm.releaseNote = ''
  }

  // 脏数据保护 + autofocus
  const createDirty = useDirtyForm(() => createForm, { enabled: () => createVisible.value })
  useFormFocus(createFormRef, () => createVisible.value)

  function openCreate() {
    if (!canManageSystem.value || writesFrozen.value || !tenant.tenantId) return
    createScope.begin()
    createSaving.value = false
    resetCreateForm()
    createVisible.value = true
    void createFormRef.value?.clearValidate()
    createDirty.markPristine()
  }

  async function closeCreate() {
    if (!(await createDirty.confirmDiscard())) return
    createVisible.value = false
  }

  async function onCreateClose(done: () => void) {
    if (createSaving.value) return
    if (!(await createDirty.confirmDiscard())) return
    done()
  }

  async function submitCreate() {
    if (createSaving.value || !createVisible.value || !canManageSystem.value || writesFrozen.value)
      return
    const scope = createScope.begin()
    if (!scope.tenantId) return
    const body = {
      tenantId: scope.tenantId,
      configType: createForm.configType.trim(),
      configKey: createForm.configKey.trim(),
      configName: createForm.configName.trim(),
      configPayloadJson: createForm.configPayloadJson.trim(),
      reason: createForm.releaseNote.trim() || undefined,
    }
    createSaving.value = true
    try {
      const valid = await createFormRef.value?.validate().catch(() => false)
      if (!valid || !createScope.isCurrent(scope)) return
      await createConfigRelease(body)
      if (!createScope.isCurrent(scope)) return
      ElMessage.success(t('configReleaseList.createSuccess', { key: body.configKey }))
      createDirty.markPristine()
      createVisible.value = false
      filters.key = body.configKey
      await load()
    } finally {
      if (createScope.isCurrent(scope)) createSaving.value = false
    }
  }

  /** 确认与原因输入共享同一操作代次，租户、主体或写权限变化后旧操作失效。 */
  function captureReleaseAction(row: ConsoleConfigReleaseResponse) {
    const scope = actionScope.begin()
    const isCurrent = () =>
      actionScope.isCurrent(scope) &&
      canManageSystem.value &&
      !writesFrozen.value &&
      (!row.tenantId || row.tenantId === scope.tenantId) &&
      allRows.value.some((current) => current.id === row.id && current.versionNo === row.versionNo)
    return { tenantId: scope.tenantId, isCurrent }
  }

  async function doRollback(row: ConsoleConfigReleaseResponse) {
    const context = captureReleaseAction(row)
    if (!context.isCurrent()) return
    try {
      await confirmDanger({
        verb: t('configReleaseList.rollbackConfirmVerb'),
        target: t('configReleaseList.rollbackConfirmTarget', { key: row.configKey }),
        consequence: t('configReleaseList.rollbackConfirmConsequence'),
        confirmButtonText: t('configReleaseList.rollbackConfirmButton'),
      })
      if (!context.isCurrent()) return
      const { value: reason } = await ElMessageBox.prompt(
        t('configReleaseList.rollbackPrompt'),
        t('configReleaseList.rollbackTitle'),
        {
          confirmButtonText: t('configReleaseList.rollbackSubmit'),
          cancelButtonText: t('common.cancel'),
        },
      )
      if (!context.isCurrent()) return
      await rollbackRelease(row.id, {
        tenantId: context.tenantId,
        expectedVersionNo: row.versionNo,
        reason: reason || undefined,
      })
      if (!context.isCurrent()) return
      ElMessage.success(t('configReleaseList.rollbackSuccess', { key: row.configKey }))
      await load()
    } catch {
      /* cancel */
    }
  }

  const detailVisible = ref(false)
  const detail = ref<Record<string, unknown> | null>(null)

  async function viewDetail(row: ConsoleConfigReleaseResponse) {
    const scope = detailScope.begin()
    if (!scope.tenantId || (row.tenantId && row.tenantId !== scope.tenantId)) return
    detail.value = null
    detailVisible.value = false
    const result = await getConfigRelease(row.id, scope.tenantId)
    if (!detailScope.isCurrent(scope)) return
    detail.value = result as unknown as Record<string, unknown>
    detailVisible.value = true
  }

  async function doSubmitApproval(row: ConsoleConfigReleaseResponse) {
    const context = captureReleaseAction(row)
    if (!context.isCurrent()) return
    try {
      const { value: reason } = await ElMessageBox.prompt(
        t('configReleaseList.submitPrompt'),
        t('configReleaseList.submitTitle', { key: row.configKey }),
        {
          confirmButtonText: t('configReleaseList.rollbackSubmit'),
          cancelButtonText: t('common.cancel'),
        },
      )
      if (!context.isCurrent()) return
      await submitReleaseApproval(row.id, {
        tenantId: context.tenantId,
        reason: reason || undefined,
      })
      if (!context.isCurrent()) return
      ElMessage.success(t('configReleaseList.submitSuccess', { key: row.configKey }))
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
    const scope = depsScope.begin()
    if (!scope.tenantId || (row.tenantId && row.tenantId !== scope.tenantId)) return
    depsData.value = null
    depsVisible.value = true
    depsLoading.value = true
    try {
      const result = await listConfigDependencies(
        scope.tenantId,
        String(row.configType ?? ''),
        String(row.configKey ?? ''),
      )
      if (depsScope.isCurrent(scope)) depsData.value = result
    } finally {
      if (depsScope.isCurrent(scope)) depsLoading.value = false
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
    const scope = diffScope.begin()
    const { releaseIdA, releaseIdB } = diffForm
    if (!scope.tenantId || !releaseIdA || !releaseIdB || releaseIdA === releaseIdB) return
    if (![releaseIdA, releaseIdB].every((id) => allRows.value.some((row) => row.id === id))) return
    diffData.value = null
    diffLoading.value = true
    try {
      const result = await diffConfigReleases(scope.tenantId, releaseIdA, releaseIdB)
      if (diffScope.isCurrent(scope)) diffData.value = result
    } finally {
      if (diffScope.isCurrent(scope)) diffLoading.value = false
    }
  }

  watch(
    [() => diffForm.releaseIdA, () => diffForm.releaseIdB, diffVisible],
    () => {
      diffScope.begin()
      diffData.value = null
      diffLoading.value = false
    },
    { flush: 'sync' },
  )
  watch(
    createVisible,
    () => {
      createScope.begin()
      createSaving.value = false
    },
    { flush: 'sync' },
  )
  watch(
    [() => auth.userInfo?.username ?? auth.userInfo?.userId, canManageSystem, writesFrozen],
    () => {
      actionScope.begin()
      createScope.begin()
      createSaving.value = false
    },
    { flush: 'sync' },
  )
  watch(
    () => tenant.tenantId,
    () => {
      listScope.begin()
      detailScope.begin()
      depsScope.begin()
      diffScope.begin()
      actionScope.begin()
      createScope.begin()
      allRows.value = []
      rows.value = []
      total.value = 0
      page.value = 1
      selectedId.value = null
      loading.value = false
      loadError.value = null
      createVisible.value = false
      resetCreateForm()
      createDirty.markPristine()
      createSaving.value = false
      detailVisible.value = false
      detail.value = null
      depsVisible.value = false
      depsData.value = null
      depsLoading.value = false
      diffVisible.value = false
      diffData.value = null
      diffLoading.value = false
      diffForm.releaseIdA = 0
      diffForm.releaseIdB = 0
    },
    { flush: 'sync' },
  )

  useTenantReload(load)
</script>

<style scoped src="./ConfigReleaseList.css"></style>
