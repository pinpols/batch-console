<template>
  <PageContainer>
    <!-- 照设计 proto-nav-发布管理 dump:页头 18/600 + 右侧新增发布 -->
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
        <el-empty
          v-if="!tableBlocking && rows.length === 0"
          :description="t('configReleaseList.listEmpty')"
        />
        <div v-for="row in rows" :key="row.id" class="cr-item">
          <div class="cr-rail">
            <span class="cr-rail__dot" :class="`cr-tone-border--${statusTone(row.configStatus)}`" />
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
              <span class="cr-pill" :class="`cr-tone--${statusTone(row.configStatus)}`">
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
          <span class="cr-pill" :class="`cr-tone--${statusTone(selectedRow.configStatus)}`">
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
          <el-button type="primary" class="cr-panel__btn" @click="doPublish(selectedRow)">
            {{ t('configReleaseList.actionPublish') }}
          </el-button>
          <el-button class="cr-panel__btn" @click="viewDetail(selectedRow)">
            {{ t('configReleaseList.actionDetail') }}
          </el-button>
        </div>
        <div class="cr-panel__actions cr-panel__actions--secondary">
          <el-button size="small" plain @click="doGray(selectedRow)">
            {{ t('configReleaseList.actionGray') }}
          </el-button>
          <el-button size="small" plain @click="openDiff(selectedRow)">
            {{ t('configReleaseList.actionDiff') }}
          </el-button>
          <el-button size="small" plain @click="doDeps(selectedRow)">
            {{ t('configReleaseList.actionDeps') }}
          </el-button>
          <el-button size="small" plain @click="doSubmitApproval(selectedRow)">
            {{ t('configReleaseList.actionSubmit') }}
          </el-button>
          <el-button size="small" plain type="danger" @click="doRollback(selectedRow)">
            {{ t('configReleaseList.actionRollback') }}
          </el-button>
        </div>
      </aside>
    </div>

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
  import { Plus } from 'lucide-vue-next'
  import { confirmDanger } from '@/composables/useDangerConfirm'

  const { t, te } = useI18n({ useScope: 'global' })
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useDirtyForm } from '@/composables/useDirtyForm'
  import { useFormFocus } from '@/composables/useFormFocus'
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
  import { fmtDatetime } from '@/utils/datetime'
  import PageContainer from '@/components/common/PageContainer.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  const { canMutateConfig } = usePermission()
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
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
  const pageSize = ref(15)

  const filters = reactive({
    key: '',
    name: '',
    status: '',
  })
  const createVisible = ref(false)
  const createSaving = ref(false)
  const createFormRef = ref<FormInstance>()
  const createForm = reactive({
    configKey: '',
    configType: '',
    configName: '',
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

  /** 状态→语义色调(时间线圆点描边 + 状态 pill 共用) */
  function statusTone(status?: string | null): 'success' | 'warning' | 'muted' {
    const s = String(status ?? '').toUpperCase()
    if (s === 'PUBLISHED') return 'success'
    if (s === 'DRAFT' || s === 'GRAY' || s === 'ROLLING_BACK') return 'warning'
    return 'muted'
  }

  function statusLabel(status?: string | null): string {
    const s = String(status ?? '')
    if (!s) return '—'
    const key = `enum.configStatus.${s}`
    return te(key) ? t(key) : s
  }

  const panelInfoItems = computed(() => {
    const r = selectedRow.value
    if (!r) return []
    return [
      { label: t('configReleaseList.colType'), value: r.configType || '—' },
      { label: t('configReleaseList.colPublishedAt'), value: fmtDatetime(r.publishedAt) },
      { label: t('configReleaseList.colEffectiveFrom'), value: fmtDatetime(r.effectiveFromAt) },
      { label: t('configReleaseList.colEffectiveTo'), value: fmtDatetime(r.effectiveToAt) },
      { label: t('configReleaseList.colRolledBackAt'), value: fmtDatetime(r.rolledBackAt) },
    ]
  })

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
    createForm.configKey = ''
    createForm.configType = ''
    createForm.configName = ''
    createForm.releaseNote = ''
  }

  // 脏数据保护 + autofocus
  const createDirty = useDirtyForm(() => createForm, { enabled: () => createVisible.value })
  useFormFocus(createFormRef, () => createVisible.value)

  function openCreate() {
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
    const valid = await createFormRef.value?.validate().catch(() => false)
    if (!valid) return
    createSaving.value = true
    try {
      await createConfigRelease({
        tenantId: tenant.tenantId,
        configType: createForm.configType.trim(),
        configKey: createForm.configKey.trim(),
        configName: createForm.configName.trim(),
        reason: createForm.releaseNote.trim() || undefined,
      })
      ElMessage.success(t('configReleaseList.createSuccess', { key: createForm.configKey }))
      createDirty.markPristine()
      createVisible.value = false
      filters.key = createForm.configKey.trim()
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
  /* ── 照设计 proto-nav-发布管理 dump 1:1(数值取 dump 内联值) ── */

  .cr-query {
    margin-bottom: 14px;
  }

  .cr-load-error {
    margin-bottom: 14px;
  }

  /* 双栏:左时间线 flex:1 + 右 352px sticky 面板 */
  .cr-layout {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }

  .cr-timeline {
    flex: 1 1 0%;
    min-width: 0;
    padding-left: 6px;
  }

  .cr-item {
    display: flex;
    gap: 16px;
  }

  /* 时间线轨道:13px 圆点(3px 语义色描边)+ 2px 竖线 */
  .cr-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 14px;
    flex-shrink: 0;
  }

  .cr-rail__dot {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--color-bg-page, var(--color-bg-card));
    border: 3px solid var(--color-border);
    margin-top: 6px;
    z-index: 1;
  }

  .cr-tone-border--success {
    border-color: var(--color-success);
  }

  .cr-tone-border--warning {
    border-color: var(--color-warning);
  }

  .cr-tone-border--muted {
    border-color: var(--color-text-tertiary);
  }

  .cr-rail__line {
    flex: 1 1 0%;
    width: 2px;
    background: var(--color-border);
    margin: 2px 0;
  }

  /* 发布卡片 */
  .cr-card {
    flex: 1 1 0%;
    margin-bottom: 14px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: var(--shadow-card);
    padding: 15px 18px;
    cursor: pointer;
  }

  .cr-card.is-active {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    border-color: var(--color-primary);
  }

  .cr-card__head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cr-card__key {
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-mono, monospace);
    color: var(--color-primary);
  }

  .cr-card__spacer {
    flex: 1 1 0%;
  }

  .cr-card__time {
    font-size: 11px;
    color: var(--color-text-tertiary);
    font-family: var(--font-mono, monospace);
  }

  .cr-card__name {
    margin-top: 9px;
    font-size: 14px;
    color: var(--color-text-primary);
  }

  .cr-card__meta {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .cr-card__meta-num {
    font-family: var(--font-mono, monospace);
    color: var(--color-text-primary);
  }

  .cr-card__meta-val {
    color: var(--color-text-primary);
  }

  /* 状态 pill(11px / 2px 8px / r6,语义软底) */
  .cr-pill {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }

  .cr-tone--success {
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 14%, transparent);
  }

  .cr-tone--warning {
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  }

  .cr-tone--muted {
    color: var(--color-text-tertiary);
    background: var(--color-bg-elevated);
  }

  .cr-pagination {
    display: flex;
    justify-content: flex-end;
    padding: 4px 0 8px;
  }

  /* 右侧 sticky 详情面板(352px / r14 / p20) */
  .cr-panel {
    width: 352px;
    flex-shrink: 0;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    box-shadow: var(--shadow-card);
    padding: 20px;
    position: sticky;
    top: 12px;
  }

  .cr-panel__head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cr-panel__key {
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-mono, monospace);
    color: var(--color-primary);
  }

  .cr-panel__name {
    margin-top: 8px;
    font-size: 14px;
    color: var(--color-text-primary);
  }

  .cr-panel__grid {
    margin-top: 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .cr-panel__stat {
    padding: 10px 12px;
    border: 1px solid var(--color-border);
    border-radius: 9px;
  }

  .cr-panel__stat-label {
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .cr-panel__stat-num {
    font-size: 16px;
    font-weight: 600;
    font-family: var(--font-mono, monospace);
    margin-top: 3px;
    color: var(--color-text-primary);
  }

  .cr-panel__stat-text {
    font-size: 14px;
    margin-top: 5px;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cr-panel__section {
    margin-top: 18px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--color-text-tertiary);
  }

  .cr-panel__list {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .cr-panel__list-item {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 12.5px;
    color: var(--color-text-secondary);
    font-family: var(--font-mono, monospace);
  }

  .cr-panel__list-dot {
    color: var(--color-text-tertiary);
  }

  .cr-panel__list-text {
    min-width: 0;
    word-break: break-all;
  }

  .cr-panel__actions {
    margin-top: 20px;
    display: flex;
    gap: 8px;
  }

  .cr-panel__actions .cr-panel__btn {
    flex: 1 1 0%;
    height: 34px;
    border-radius: 9px;
    margin-left: 0;
  }

  .cr-panel__actions--secondary {
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .cr-panel__actions--secondary .el-button {
    margin-left: 0;
  }

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
