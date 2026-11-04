<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button
          v-if="canMutateConfig && routingRuntimeEnabled"
          type="primary"
          :icon="Plus"
          @click="openCreate"
        >
          {{ t('alertRoutingPanel.actionCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <el-alert
        class="reserved-alert"
        type="warning"
        show-icon
        :closable="false"
        :title="t('alertRoutingPanel.reservedTitle')"
        :description="t('alertRoutingPanel.reservedDescription')"
      />

      <div class="panel-head">
        <div class="panel-title">
          <span class="dot dot--warning" />
          {{ t('alertRoutingPanel.sectionTitle') }}
        </div>
      </div>

      <ListPageQueryBar
        class="query"
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="onSearch"
        @reset="onReset"
        @refresh="onRefresh"
      >
        <el-form-item :label="t('alertRoutingPanel.enabledLabel')">
          <el-select v-model="enabledDraft" clearable class="query__select">
            <el-option :label="t('alertRoutingPanel.optEnabled')" :value="true" />
            <el-option :label="t('alertRoutingPanel.optDisabled')" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.keywordLabel')">
          <el-input
            v-model="kwDraft"
            :placeholder="t('alertRoutingPanel.keywordPlaceholder')"
            clearable
            class="query__search"
          />
        </el-form-item>
      </ListPageQueryBar>

      <el-table v-loading="loading" :data="rows" class="routing-table">
        <template #empty>
          <EmptyState
            variant="tenant-empty"
            :title="t('alertRoutingPanel.emptyTitle')"
            :description="t('alertRoutingPanel.emptyDescription')"
            :image-size="80"
          >
            <template v-if="canMutateConfig && routingRuntimeEnabled" #action>
              <el-button type="primary" :icon="Plus" @click="openCreate">
                {{ t('alertRoutingPanel.actionCreate') }}
              </el-button>
            </template>
          </EmptyState>
        </template>
        <el-table-column
          prop="routeCode"
          :label="t('alertRoutingPanel.colRouteCode')"
          min-width="180"
        >
          <template #default="{ row }"
            ><CopyableText v-if="row.routeCode" :text="row.routeCode"
          /></template>
        </el-table-column>
        <el-table-column
          prop="routeName"
          :label="t('alertRoutingPanel.colRouteName')"
          min-width="160"
        >
          <template #default="{ row }"
            ><CopyableText v-if="row.routeName" :text="row.routeName"
          /></template>
        </el-table-column>
        <el-table-column prop="team" :label="t('alertRoutingPanel.fieldTeam')" min-width="120">
          <template #default="{ row }"
            ><CopyableText v-if="row.team" :text="row.team" :copyable="false"
          /></template>
        </el-table-column>
        <el-table-column
          prop="severity"
          :label="t('alertRoutingPanel.fieldSeverity')"
          width="120"
        />
        <el-table-column
          prop="receiver"
          :label="t('alertRoutingPanel.fieldReceiver')"
          min-width="180"
        >
          <template #default="{ row }"
            ><CopyableText v-if="row.receiver" :text="row.receiver" :copyable="false"
          /></template>
        </el-table-column>
        <el-table-column prop="groupBy" :label="t('alertRoutingPanel.colGroupBy')" min-width="140">
          <template #default="{ row }"
            ><CopyableText v-if="row.groupBy" :text="row.groupBy" :copyable="false"
          /></template>
        </el-table-column>
        <el-table-column :label="t('alertRoutingPanel.fieldEnabled')" width="120">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              inline-prompt
              :active-text="t('alertRoutingPanel.switchOn')"
              :inactive-text="t('alertRoutingPanel.switchOff')"
              :loading="togglingId === row.id"
              :disabled="!routingRuntimeEnabled"
              @change="toggleRouting(row as GovernanceAlertRoutingRow)"
            />
          </template>
        </el-table-column>
        <el-table-column
          prop="updatedAt"
          :label="t('alertRoutingPanel.colUpdatedAt')"
          min-width="180"
        />
        <el-table-column :label="t('alertRoutingPanel.actions')" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              plain
              size="small"
              :icon="Edit"
              :disabled="!routingRuntimeEnabled || !row?.routeCode"
              @click="openEdit(row as GovernanceAlertRoutingRow)"
            >
              {{ t('alertRoutingPanel.actionEdit') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <TablePagerBar
        :page="pageNo"
        :page-size="pageSize"
        :total="total"
        :disabled="loading"
        @update:page="onPageChange"
        @update:page-size="onPageSizeChange"
      />
    </SectionCard>

    <FormDrawer
      v-model:visible="dialogVisible"
      :title="
        editingId == null
          ? t('alertRoutingPanel.drawerCreateTitle')
          : t('alertRoutingPanel.drawerEditTitle')
      "
      destroy-on-close
      :before-close="onDialogClose"
      :saving="submitAction.loading.value"
      @submit="submitForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <FormSection :title="t('alertRoutingPanel.sectionBasic')" :columns="2">
          <el-form-item :label="t('alertRoutingPanel.fieldRouteCode')" prop="routeCode">
            <el-input v-model="form.routeCode" :disabled="editingId != null" maxlength="128" />
          </el-form-item>
          <el-form-item :label="t('alertRoutingPanel.fieldRouteName')" prop="routeName">
            <el-input v-model="form.routeName" maxlength="128" />
          </el-form-item>
          <el-form-item :label="t('alertRoutingPanel.fieldEnabled')">
            <el-switch v-model="form.enabled" />
          </el-form-item>
          <el-form-item
            class="form-block__full"
            :label="t('alertRoutingPanel.descriptionLabel')"
            prop="description"
          >
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              maxlength="512"
              show-word-limit
            />
          </el-form-item>
        </FormSection>
        <FormSection
          :title="t('alertRoutingPanel.sectionMatch')"
          :description="t('alertRoutingPanel.sectionMatchDesc')"
          :columns="2"
        >
          <el-form-item :label="t('alertRoutingPanel.fieldTeam')" prop="team">
            <el-input v-model="form.team" maxlength="64" />
          </el-form-item>
          <el-form-item :label="t('alertRoutingPanel.fieldAlertGroup')" prop="alertGroup">
            <el-input v-model="form.alertGroup" maxlength="64" />
          </el-form-item>
          <el-form-item :label="t('alertRoutingPanel.fieldSeverity')" prop="severity">
            <MetaSelect v-model="form.severity" enum-key="severity" class="query-w-full" />
          </el-form-item>
        </FormSection>
        <FormSection
          :title="t('alertRoutingPanel.sectionDelivery')"
          :description="t('alertRoutingPanel.sectionDeliveryDesc')"
          :columns="2"
        >
          <el-form-item
            class="form-block__full"
            :label="t('alertRoutingPanel.fieldReceiver')"
            prop="receiver"
          >
            <el-input v-model="form.receiver" maxlength="256" />
          </el-form-item>
          <el-form-item
            class="form-block__full"
            :label="t('alertRoutingPanel.fieldGroupBy')"
            prop="groupBy"
          >
            <el-input
              v-model="form.groupBy"
              :placeholder="t('alertRoutingPanel.fieldGroupByPlaceholder')"
              maxlength="128"
            />
          </el-form-item>
          <div class="route-timing form-block__full">
            <el-form-item :label="t('alertRoutingPanel.fieldGroupWaitSeconds')">
              <el-input-number v-model="form.groupWaitSeconds" :min="0" :max="INT32_MAX" />
            </el-form-item>
            <el-form-item :label="t('alertRoutingPanel.fieldGroupIntervalSeconds')">
              <el-input-number v-model="form.groupIntervalSeconds" :min="0" :max="INT32_MAX" />
            </el-form-item>
            <el-form-item :label="t('alertRoutingPanel.fieldRepeatIntervalSeconds')">
              <el-input-number v-model="form.repeatIntervalSeconds" :min="0" :max="INT32_MAX" />
            </el-form-item>
          </div>
        </FormSection>
      </el-form>
    </FormDrawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import FormSection from '@/components/common/FormSection.vue'
  import FormDrawer from '@/components/common/FormDrawer.vue'
  import { reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Pencil as Edit, Plus } from '@lucide/vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormItemRule, FormRules } from 'element-plus'
  import {
    governanceApi,
    type GovernanceAlertRoutingRow,
    type GovernanceAlertRoutingSavePayload,
  } from '@/api/governance'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAsyncAction } from '@/composables/useAsyncAction'
  import { useDirtyForm } from '@/composables/useDirtyForm'
  import { useFormFocus } from '@/composables/useFormFocus'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import { usePermission } from '@/composables/usePermission'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'

  const { canMutateConfig } = usePermission()
  // 运行时消费者尚未落地；保留只读列表用于审计历史配置，避免产生“保存即生效”的错误预期。
  const routingRuntimeEnabled = false
  const INT32_MAX = 2147483647
  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const listRemote = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(listRemote)
  const loading = ref(false)
  const togglingId = ref<number | null>(null)
  const rows = ref<GovernanceAlertRoutingRow[]>([])
  const pageNo = ref(1)
  const pageSize = ref(15)
  const total = ref(0)
  const kwDraft = ref('')
  const enabledDraft = ref<boolean | undefined>(undefined)
  const kwApplied = ref('')
  const enabledApplied = ref<boolean | undefined>(undefined)
  const dialogVisible = ref(false)
  const editingId = ref<number | null>(null)
  const formRef = ref<FormInstance>()
  const form = reactive({
    routeCode: '',
    routeName: '',
    team: '',
    alertGroup: '',
    severity: 'ERROR',
    receiver: '',
    groupBy: '',
    groupWaitSeconds: 0,
    groupIntervalSeconds: 300,
    repeatIntervalSeconds: 3600,
    enabled: true,
    description: '',
  })
  function utf16MaxLength(max: number): FormItemRule {
    return {
      validator: (_rule, value: string | undefined, callback) => {
        if (value && value.length > max) callback(new Error(t('form.maxLength', { max })))
        else callback()
      },
      trigger: 'blur',
    }
  }

  const rules: FormRules = {
    routeCode: [{ required: true, message: t('alertRoutingPanel.ruleRouteCode'), trigger: 'blur' }],
    routeName: [utf16MaxLength(128)],
    team: [
      {
        required: true,
        whitespace: true,
        message: t('alertRoutingPanel.ruleTeam'),
        trigger: 'blur',
      },
      utf16MaxLength(64),
    ],
    alertGroup: [
      {
        required: true,
        whitespace: true,
        message: t('alertRoutingPanel.ruleAlertGroup'),
        trigger: 'blur',
      },
      utf16MaxLength(64),
    ],
    severity: [{ required: true, message: t('alertRoutingPanel.ruleSeverity'), trigger: 'change' }],
    receiver: [
      {
        required: true,
        whitespace: true,
        message: t('alertRoutingPanel.ruleReceiver'),
        trigger: 'blur',
      },
    ],
    groupBy: [utf16MaxLength(128)],
    description: [utf16MaxLength(512)],
  }

  function onSearch() {
    return runSearch(async () => {
      kwApplied.value = kwDraft.value.trim()
      enabledApplied.value = enabledDraft.value
      pageNo.value = 1
      await load()
    })
  }

  function onReset() {
    return runReset(async () => {
      kwDraft.value = ''
      enabledDraft.value = undefined
      kwApplied.value = ''
      enabledApplied.value = undefined
      pageNo.value = 1
      await load()
    })
  }

  function onRefresh() {
    return runRefresh(load)
  }

  async function load() {
    loading.value = true
    try {
      const page = await governanceApi.listAlertRoutingsPage(tenant.tenantId, {
        keyword: kwApplied.value,
        enabled: enabledApplied.value,
        pageNo: pageNo.value,
        pageSize: pageSize.value,
      })
      rows.value = page.items
      total.value = page.total
    } catch {
      rows.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  function onPageChange(value: number) {
    pageNo.value = value
    void load()
  }

  function onPageSizeChange(value: number) {
    pageSize.value = value
    pageNo.value = 1
    void load()
  }

  function resetForm(row?: GovernanceAlertRoutingRow) {
    editingId.value = row?.id ?? null
    form.routeCode = row?.routeCode ?? ''
    form.routeName = row?.routeName ?? ''
    form.team = row?.team ?? ''
    form.alertGroup = row?.alertGroup ?? ''
    form.severity = row?.severity ?? 'ERROR'
    form.receiver = row?.receiver ?? ''
    form.groupBy = row?.groupBy ?? ''
    form.groupWaitSeconds = row?.groupWaitSeconds ?? 0
    form.groupIntervalSeconds = row?.groupIntervalSeconds ?? 300
    form.repeatIntervalSeconds = row?.repeatIntervalSeconds ?? 3600
    form.enabled = row?.enabled ?? true
    form.description = row?.description ?? ''
  }

  // 脏数据保护
  const dirty = useDirtyForm(() => form, { enabled: () => dialogVisible.value })
  useFormFocus(formRef, () => dialogVisible.value)

  function openCreate() {
    if (!routingRuntimeEnabled) return
    resetForm()
    dialogVisible.value = true
    dirty.markPristine()
  }

  function openEdit(row: GovernanceAlertRoutingRow) {
    if (!routingRuntimeEnabled) return
    resetForm(row)
    dialogVisible.value = true
    dirty.markPristine()
  }

  // 保存中的关闭拦截由 FormDrawer 统一处理
  function onDialogClose() {
    return dirty.confirmDiscard()
  }

  // useAsyncAction:连点抗抖,300ms cooldown 防关弹窗动画期间二次提交
  const submitAction = useAsyncAction(
    async () => {
      const body: GovernanceAlertRoutingSavePayload = { tenantId: tenant.tenantId, ...form }
      if (editingId.value == null) {
        await governanceApi.createAlertRouting(body)
      } else {
        await governanceApi.updateAlertRouting(editingId.value, body)
      }
      ElMessage.success(t('alertRoutingPanel.saveSuccess', { code: form.routeCode }))
      dirty.markPristine()
      dialogVisible.value = false
      await load()
    },
    { cooldownMs: 300 },
  )

  async function submitForm() {
    if (!routingRuntimeEnabled) return
    const valid = await formRef.value
      ?.validate()
      .catch((errors: Record<string, Array<{ message?: string }>> | unknown) => {
        const firstField =
          errors && typeof errors === 'object' ? Object.keys(errors as object)[0] : null
        if (firstField) formRef.value?.scrollToField(firstField)
        return false
      })
    if (!valid) return
    await submitAction.run()
  }

  async function toggleRouting(row: GovernanceAlertRoutingRow) {
    if (!routingRuntimeEnabled) return
    if (!row.id) return
    const target = !row.enabled
    try {
      const action = target ? t('alertRoutingPanel.switchOn') : t('alertRoutingPanel.switchOff')
      await ElMessageBox.confirm(
        t('alertRoutingPanel.toggleConfirmText', { code: row.routeCode, action }),
        t('alertRoutingPanel.toggleConfirmTitle'),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
    togglingId.value = row.id
    try {
      await governanceApi.toggleAlertRouting(row.id, row.tenantId || tenant.tenantId, target)
      row.enabled = target
      ElMessage.success(t('alertRoutingPanel.toggleSuccess', { code: row.routeCode }))
    } finally {
      togglingId.value = null
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  /* 三个以秒计的合并/重复间隔同排 */
  .route-timing {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0 var(--space-md);
  }

  .route-timing :deep(.el-input-number) {
    width: 100%;
  }

  .panel-head {
    margin-bottom: var(--space-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .reserved-alert {
    margin-bottom: var(--page-block-gap);
  }

  .panel-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: var(--line-height-tight);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-content);
  }

  .dot--warning {
    background: var(--color-warning);
  }

  .query {
    margin-bottom: var(--page-block-gap);
  }

  .query__search {
    width: min(360px, 100%);
  }

  .query__select {
    width: 140px;
  }

  .routing-table {
    width: 100%;
  }
</style>
