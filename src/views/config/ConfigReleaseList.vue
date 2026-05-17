<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          v-if="canMutateConfig"
          type="primary"
          :icon="Plus"
          class="pretty-add-button"
          @click="openCreate"
        >
          {{ t('configReleaseList.headerCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ProTable
        :data="rows"
        :loading="tableBlocking"
        :total="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        @change="slicePage"
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
        </template>
        <el-table-column
          prop="configKey"
          :label="t('configReleaseList.colKey')"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="configName"
          :label="t('configReleaseList.colName')"
          min-width="140"
        />
        <el-table-column prop="configType" :label="t('configReleaseList.colType')" width="120" />
        <el-table-column prop="configStatus" :label="t('configReleaseList.colStatus')" width="120">
          <template #default="{ row }">
            <StatusTag :value="String(row.configStatus ?? '')" category="configStatus" />
          </template>
        </el-table-column>
        <el-table-column
          prop="versionNo"
          :label="t('configReleaseList.colVersion')"
          width="80"
          align="right"
        />
        <DatetimeColumn
          prop="publishedAt"
          :label="t('configReleaseList.colPublishedAt')"
          width="160"
        />
        <DatetimeColumn
          prop="effectiveFromAt"
          :label="t('configReleaseList.colEffectiveFrom')"
          width="160"
        />
        <DatetimeColumn
          prop="effectiveToAt"
          :label="t('configReleaseList.colEffectiveTo')"
          width="160"
        />
        <DatetimeColumn
          prop="rolledBackAt"
          :label="t('configReleaseList.colRolledBackAt')"
          width="160"
        />
        <el-table-column
          prop="createdBy"
          :label="t('configReleaseList.colCreatedBy')"
          width="120"
          show-overflow-tooltip
        />
        <el-table-column :label="t('configReleaseList.colActions')" width="240" fixed="right">
          <template #default="{ row }">
            <RowActions :actions="rowActions(row)" :inline-limit="2" />
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

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
        label-width="120px"
        @submit.prevent
      >
        <el-form-item :label="t('configReleaseList.createKeyLabel')" prop="configCode">
          <el-input
            v-model="createForm.configCode"
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
        <div class="drawer-actions">
          <el-button @click="closeCreate">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" :loading="createSaving" @click="submitCreate">
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
        <el-empty
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
        <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
        <el-descriptions-item label="configKey">{{ detail.configKey }}</el-descriptions-item>
        <el-descriptions-item label="configName">{{ detail.configName }}</el-descriptions-item>
        <el-descriptions-item label="configStatus">{{ detail.configStatus }}</el-descriptions-item>
        <el-descriptions-item label="versionNo">{{ detail.versionNo }}</el-descriptions-item>
        <el-descriptions-item label="publishedAt">{{ detail.publishedAt }}</el-descriptions-item>
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
  import { Plus } from '@element-plus/icons-vue'
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { usePermission } from '@/composables/usePermission'
  import {
    grayRelease,
    createConfigRelease,
    listConfigReleases,
    publishRelease,
    rollbackRelease,
    getConfigRelease,
    submitReleaseApproval,
    listConfigDependencies,
    diffConfigReleases,
  } from '@/api/configReleases'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { toPageResult } from '@/api/adapters'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  const { canMutateConfig } = usePermission()
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import type { FormInstance, FormRules } from 'element-plus'
  import type { ConsoleConfigReleaseResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const auth = useAuthStore()
  // 配置发布所有写操作的 BE DTO 都 @NotBlank operatorId — 不传会 400 "不能为空"
  const operatorId = () => auth.userInfo?.username ?? auth.userInfo?.userId ?? ''
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
  const pageSize = ref(20)

  const filters = reactive({
    key: '',
    name: '',
    status: '',
  })
  const createVisible = ref(false)
  const createSaving = ref(false)
  const createFormRef = ref<FormInstance>()
  const createForm = reactive({
    configCode: '',
    configType: '',
    releaseNote: '',
  })
  const createRules: FormRules = {
    configCode: [
      { required: true, message: t('configReleaseList.ruleCreateKey'), trigger: 'blur' },
    ],
    configType: [
      { required: true, message: t('configReleaseList.ruleCreateType'), trigger: 'blur' },
    ],
  }

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const configReleaseStatusOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'configStatus'),
  )

  const filtered = computed(() => {
    let r = allRows.value
    const k = filters.key.trim()
    if (k) r = r.filter((x) => String(x.configKey ?? '').includes(k))
    const n = filters.name.trim()
    if (n) r = r.filter((x) => String(x.configName ?? '').includes(n))
    const s = filters.status.trim()
    if (s) r = r.filter((x) => String(x.configStatus ?? '').toUpperCase() === s.toUpperCase())
    return r
  })

  function slicePage() {
    const list = filtered.value
    total.value = list.length
    const pr = toPageResult(list, page.value, pageSize.value)
    rows.value = pr.records as ConsoleConfigReleaseResponse[]
    total.value = pr.total
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      allRows.value = await listConfigReleases(tenant.tenantId)
      page.value = 1
      slicePage()
    } catch (err) {
      loadError.value = err
      throw err
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
    createForm.configCode = ''
    createForm.configType = ''
    createForm.releaseNote = ''
  }

  function openCreate() {
    resetCreateForm()
    createVisible.value = true
    void createFormRef.value?.clearValidate()
  }

  function closeCreate() {
    createVisible.value = false
  }

  function onCreateClose(done: () => void) {
    if (createSaving.value) return
    done()
  }

  async function submitCreate() {
    const valid = await createFormRef.value?.validate().catch(() => false)
    if (!valid) return
    createSaving.value = true
    try {
      await createConfigRelease({
        tenantId: tenant.tenantId,
        configCode: createForm.configCode.trim(),
        configType: createForm.configType.trim(),
        releaseNote: createForm.releaseNote.trim() || undefined,
      })
      ElMessage.success(t('configReleaseList.createSuccess', { key: createForm.configCode }))
      createVisible.value = false
      filters.key = createForm.configCode.trim()
      await load()
    } finally {
      createSaving.value = false
    }
  }

  async function doPublish(row: ConsoleConfigReleaseResponse) {
    try {
      const { value: reason } = await ElMessageBox.prompt(
        t('configReleaseList.publishPrompt'),
        t('configReleaseList.publishTitle', { key: row.configKey }),
        {
          confirmButtonText: t('configReleaseList.publishConfirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await publishRelease(row.id, {
        tenantId: row.tenantId ?? tenant.tenantId,
        operatorId: operatorId(),
        reason: reason || undefined,
      })
      ElMessage.success(t('configReleaseList.publishSuccess', { key: row.configKey }))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doGray(row: ConsoleConfigReleaseResponse) {
    try {
      const { value: grayScopeJson } = await ElMessageBox.prompt(
        t('configReleaseList.grayPrompt'),
        t('configReleaseList.grayTitle', { key: row.configKey }),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputType: 'textarea',
        },
      )
      await grayRelease(row.id, {
        tenantId: row.tenantId ?? tenant.tenantId,
        operatorId: operatorId(),
        grayScopeJson: grayScopeJson || undefined,
      })
      ElMessage.success(t('configReleaseList.graySuccess', { key: row.configKey }))
      await load()
    } catch {
      /* cancel */
    }
  }

  async function doRollback(row: ConsoleConfigReleaseResponse) {
    try {
      await confirmDanger({
        verb: '回滚',
        target: `配置「${row.configKey}」`,
        consequence:
          '当前生效配置将被回滚到上一版本,所有正在读取该配置的应用会在下次拉取时获取旧值。请确认旧版本可正常工作。',
        confirmButtonText: '我已确认,继续回滚',
      })
      const { value: reason } = await ElMessageBox.prompt(
        t('configReleaseList.rollbackPrompt'),
        t('configReleaseList.rollbackTitle'),
        {
          confirmButtonText: t('configReleaseList.rollbackSubmit'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await rollbackRelease(row.id, {
        tenantId: row.tenantId ?? tenant.tenantId,
        operatorId: operatorId(),
        reason: reason || undefined,
      })
      ElMessage.success(t('configReleaseList.rollbackSuccess', { key: row.configKey }))
      await load()
    } catch {
      /* cancel */
    }
  }

  const detailVisible = ref(false)
  const detail = ref<Record<string, unknown> | null>(null)

  async function viewDetail(row: ConsoleConfigReleaseResponse) {
    detail.value = (await getConfigRelease(
      row.id,
      row.tenantId ?? tenant.tenantId,
    )) as unknown as Record<string, unknown>
    detailVisible.value = true
  }

  async function doSubmitApproval(row: ConsoleConfigReleaseResponse) {
    try {
      const { value: reason } = await ElMessageBox.prompt(
        t('configReleaseList.submitPrompt'),
        t('configReleaseList.submitTitle', { key: row.configKey }),
        {
          confirmButtonText: t('configReleaseList.rollbackSubmit'),
          cancelButtonText: t('common.cancel'),
        },
      )
      await submitReleaseApproval(row.id, {
        tenantId: row.tenantId ?? tenant.tenantId,
        operatorId: operatorId(),
        reason: reason || undefined,
      })
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
    depsData.value = null
    depsVisible.value = true
    depsLoading.value = true
    try {
      depsData.value = await listConfigDependencies(
        row.tenantId ?? tenant.tenantId,
        String(row.configType ?? ''),
        String(row.configKey ?? ''),
      )
    } finally {
      depsLoading.value = false
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

  function rowActions(row: ConsoleConfigReleaseResponse): RowAction[] {
    return [
      { key: 'detail', label: t('configReleaseList.actionDetail'), onClick: () => viewDetail(row) },
      {
        key: 'publish',
        label: t('configReleaseList.actionPublish'),
        primary: true,
        onClick: () => doPublish(row),
      },
      { key: 'gray', label: t('configReleaseList.actionGray'), onClick: () => doGray(row) },
      { key: 'diff', label: t('configReleaseList.actionDiff'), onClick: () => openDiff(row) },
      { key: 'deps', label: t('configReleaseList.actionDeps'), onClick: () => doDeps(row) },
      {
        key: 'submit',
        label: t('configReleaseList.actionSubmit'),
        divided: true,
        onClick: () => doSubmitApproval(row),
      },
      {
        key: 'rollback',
        label: t('configReleaseList.actionRollback'),
        danger: true,
        divided: true,
        onClick: () => doRollback(row),
      },
    ]
  }

  async function doDiff() {
    diffLoading.value = true
    try {
      diffData.value = await diffConfigReleases(
        tenant.tenantId,
        diffForm.releaseIdA,
        diffForm.releaseIdB,
      )
    } finally {
      diffLoading.value = false
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .release-json {
    margin: 0;
    padding: var(--card-inner-padding);
    max-height: 400px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: var(--font-family-mono, monospace);
    font-size: 12px;
    line-height: 1.5;
    border-radius: var(--radius-input, 4px);
    background: var(--el-fill-color-light);
    border: 1px solid var(--color-border-light);
  }

  .diff-form {
    margin-bottom: var(--card-inner-padding);
  }

  .diff-result {
    margin-top: var(--card-inner-padding);
  }

  .drawer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }
</style>
