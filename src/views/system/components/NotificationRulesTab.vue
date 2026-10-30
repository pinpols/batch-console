<template>
  <div>
    <ProTable
      :data="pagedRules"
      :loading="loadingRules"
      :error="loadRulesError"
      :on-retry="loadRules"
      :total="filteredRules.length"
      v-model:page="rulePage"
      v-model:page-size="rulePageSize"
      @change="() => {}"
      :has-active-filters="hasActiveRuleFilters"
    >
      <template v-if="!hasActiveRuleFilters" #empty>
        <EmptyState :description="t('notificationRulesTab.emptyDescription')" :image-size="80">
          <template #action>
            <el-button type="primary" :icon="Plus" @click="openRuleCreate">
              {{ t('notificationCommon.btnAdd') }}
            </el-button>
          </template>
        </EmptyState>
      </template>
      <template #query>
        <ListPageQueryBar
          :filter-busy="filterBusy"
          :refresh-busy="loadingRules"
          @search="applyRuleFilter"
          @reset="resetRuleFilter"
          @refresh="() => runRefresh(loadRules)"
        >
          <el-form-item :label="t('notificationCommon.keywordLabel')">
            <el-input
              class="query-w-240"
              v-model="ruleFilterDraft.keyword"
              clearable
              :placeholder="t('notificationRulesTab.kwPlaceholder')"
              @keyup.enter="applyRuleFilter"
            />
          </el-form-item>
          <el-form-item :label="t('notificationCommon.enabledLabel')">
            <EnabledStatusFilter
              v-model="ruleFilterDraft.enabled"
              :ariaLabel="t('notificationCommon.enabledLabel')"
            />
          </el-form-item>
        </ListPageQueryBar>
      </template>
      <el-table-column prop="ruleId" :label="t('notificationRulesTab.colId')" width="80" />
      <el-table-column
        prop="ruleName"
        :label="t('notificationRulesTab.colName')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column
        prop="eventTypes"
        :label="t('notificationRulesTab.colEventTypes')"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column
        prop="channelCode"
        :label="t('notificationRulesTab.colChannelId')"
        width="120"
      />
      <el-table-column prop="enabled" :label="t('notificationCommon.colEnabled')" width="80">
        <template #default="{ row }">
          <StatusTag :value="String(row.enabled)" category="yn" />
        </template>
      </el-table-column>
      <el-table-column :label="t('notificationCommon.colActions')" width="160" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <RowActions :actions="ruleRowActions(row)" :inline-limit="1" />
          </div>
        </template>
      </el-table-column>
    </ProTable>

    <el-drawer
      :append-to-body="true"
      v-model="ruleFormVisible"
      :title="
        ruleEditingId
          ? t('notificationRulesTab.dialogTitleEdit')
          : t('notificationRulesTab.dialogTitleCreate')
      "
      direction="rtl"
      size="640px"
      :close-on-click-modal="false"
      :before-close="onRuleFormClose"
    >
      <el-form ref="ruleFormRef" :model="ruleForm" :rules="ruleFormRules" label-width="88px">
        <el-form-item :label="t('notificationRulesTab.fieldName')" prop="ruleName">
          <el-input
            v-model="ruleForm.ruleName"
            :placeholder="t('notificationRulesTab.namePlaceholder')"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('notificationRulesTab.fieldEventTypes')" prop="eventTypes">
          <el-input
            v-model="ruleForm.eventTypes"
            :placeholder="t('notificationRulesTab.eventTypesPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('notificationRulesTab.fieldChannelId')" prop="channelCode">
          <el-select
            v-model="ruleForm.channelCode"
            class="query-w-full"
            filterable
            :placeholder="t('notificationRulesTab.channelIdPlaceholder')"
          >
            <el-option
              v-for="c in channelOptions"
              :key="c.code"
              :label="`${c.code}${c.name ? ' / ' + c.name : ''}`"
              :value="c.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('notificationCommon.enabledLabel')" prop="enabled">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeRuleForm">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="savingRule" @click="saveRule">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import type { FormRules } from 'element-plus'
  import { useFormValidate, rules as r } from '@/composables/useFormValidate'
  import { useDirtyForm } from '@/composables/useDirtyForm'
  import { useFormFocus } from '@/composables/useFormFocus'
  import { Plus } from '@lucide/vue'
  import {
    listNotificationChannels,
    listNotificationRules,
    createNotificationRule,
    updateNotificationRule,
    deleteNotificationRule,
  } from '@/api/notifications'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import EnabledStatusFilter from '@/components/table/EnabledStatusFilter.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'

  const tenant = useTenantStore()
  const { loading: loadingRules, error: loadRulesError, run: runLoadingRules } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingRules)
  const savingRule = ref(false)
  const ruleFormVisible = ref(false)
  const ruleEditingId = ref<number | null>(null)
  const rules = ref<Record<string, unknown>[]>([])
  const rulePage = ref(1)
  const rulePageSize = ref(15)
  const ruleFilterDraft = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const ruleFilterApplied = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const hasActiveRuleFilters = computed(
    () => !!(ruleFilterApplied.keyword.trim() || ruleFilterApplied.enabled !== undefined),
  )
  const ruleForm = reactive({ ruleName: '', eventTypes: '', channelCode: '', enabled: true })
  // 通知渠道下拉源:避免手输不存在的 channelCode 形成悬挂引用
  const channelOptions = ref<Array<{ id: number; code: string; name: string }>>([])
  const channelScope = useTenantRequestScope()
  const listScope = useTenantRequestScope()
  const formScope = useTenantRequestScope()
  const deleteScope = useTenantRequestScope()
  let openedForm: ReturnType<typeof formScope.begin> | null = null
  async function loadChannelOptions() {
    const request = channelScope.begin()
    if (!tenant.tenantId) {
      channelOptions.value = []
      return
    }
    try {
      const data = await listNotificationChannels(request.tenantId)
      if (!channelScope.isCurrent(request)) return
      const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
      const normalizedOptions = list.map((channel) => ({
        id: Number(channel.id ?? 0),
        code: String(channel.channelCode ?? ''),
        name: String(channel.channelName ?? ''),
      }))
      channelOptions.value = normalizedOptions.filter((option) => !!option.code)
    } catch {
      if (!channelScope.isCurrent(request)) return
      channelOptions.value = []
    }
  }
  loadChannelOptions()

  const { formRef: ruleFormRef, validate: validateRuleForm } = useFormValidate()
  const ruleFormRules: FormRules = {
    ruleName: [r.required(t('notificationRulesTab.ruleName')), r.maxLength(128)],
    eventTypes: [r.required(t('notificationRulesTab.ruleEventTypes'))],
    channelCode: [r.required(t('notificationRulesTab.ruleChannelId'), 'change')],
  }

  async function loadRules() {
    const request = listScope.begin()
    if (!tenant.tenantId) {
      rules.value = []
      return
    }
    await runLoadingRules(
      async () => {
        const data = await listNotificationRules(request.tenantId)
        if (!listScope.isCurrent(request)) return
        rules.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
      },
      () => listScope.isCurrent(request),
    ).catch(() => {
      if (!listScope.isCurrent(request)) return
      rules.value = []
    })
  }

  // 脏数据保护
  const ruleDirty = useDirtyForm(() => ruleForm, { enabled: () => ruleFormVisible.value })
  useFormFocus(ruleFormRef, () => ruleFormVisible.value)

  async function openRuleCreate() {
    if (!tenant.tenantId) return
    const request = formScope.begin()
    // 通道可在相邻标签页创建；打开选择器前刷新列表，确保新建通道能立即用于规则。
    await loadChannelOptions()
    if (!formScope.isCurrent(request)) return
    openedForm = request
    ruleEditingId.value = null
    ruleForm.ruleName = ''
    ruleForm.eventTypes = ''
    ruleForm.channelCode = ''
    ruleForm.enabled = true
    ruleFormVisible.value = true
    ruleDirty.markPristine()
  }

  function openRuleEdit(row: Record<string, unknown>) {
    if (!tenant.tenantId || (row.tenantId && row.tenantId !== tenant.tenantId)) return
    openedForm = formScope.begin()
    ruleEditingId.value = Number(row.ruleId ?? row.id ?? 0) || null
    ruleForm.ruleName = String(row.ruleName ?? '')
    ruleForm.eventTypes = String(row.eventTypes ?? '')
    ruleForm.channelCode = String(row.channelCode ?? '')
    ruleForm.enabled = !!row.enabled
    ruleFormVisible.value = true
    ruleDirty.markPristine()
  }

  function ruleRowActions(row: Record<string, unknown>): RowAction[] {
    return [
      {
        key: 'edit',
        label: t('notificationCommon.btnEdit'),
        primary: true,
        onClick: () => openRuleEdit(row),
      },
      {
        key: 'delete',
        label: t('notificationCommon.btnDelete'),
        danger: true,
        divided: true,
        onClick: () => confirmDeleteRule(row),
      },
    ]
  }

  async function closeRuleForm() {
    if (!(await ruleDirty.confirmDiscard())) return
    ruleFormVisible.value = false
  }

  async function onRuleFormClose(done: () => void) {
    if (savingRule.value) return
    if (!(await ruleDirty.confirmDiscard())) return
    done()
  }

  async function saveRule() {
    const request = openedForm
    if (savingRule.value || !request || !formScope.isCurrent(request)) return
    if (!(await validateRuleForm()) || !formScope.isCurrent(request)) return
    savingRule.value = true
    try {
      const body = { ...ruleForm }
      if (ruleEditingId.value) {
        await updateNotificationRule(ruleEditingId.value, request.tenantId, body)
      } else {
        await createNotificationRule(request.tenantId, body)
      }
      if (!formScope.isCurrent(request)) return
      ElMessage.success(t('notificationCommon.savedToast'))
      ruleDirty.markPristine()
      ruleFormVisible.value = false
      await loadRules()
    } finally {
      if (formScope.isCurrent(request)) savingRule.value = false
    }
  }

  async function confirmDeleteRule(row: Record<string, unknown>) {
    if (!tenant.tenantId || (row.tenantId && row.tenantId !== tenant.tenantId)) return
    const request = deleteScope.begin()
    const ruleId = Number(row.ruleId ?? row.id ?? 0)
    try {
      await confirmDanger({
        verb: t('notificationCommon.deleteVerb'),
        target: t('notificationRulesTab.deleteTarget', { name: row.ruleName }),
        consequence: t('notificationRulesTab.deleteConsequence'),
        irreversible: false,
      })
      if (!deleteScope.isCurrent(request)) return
      await deleteNotificationRule(ruleId, request.tenantId)
      if (!deleteScope.isCurrent(request)) return
      ElMessage.success(t('notificationCommon.deletedToast'))
      await loadRules()
    } catch {
      /* cancel */
    }
  }

  function normalize(s: unknown) {
    return String(s ?? '')
      .trim()
      .toLowerCase()
  }

  const filteredRules = computed(() => {
    const k = normalize(ruleFilterApplied.keyword)
    const en = ruleFilterApplied.enabled
    return rules.value.filter((row) => {
      const okEnabled = en === undefined ? true : !!row.enabled === en
      if (!okEnabled) return false
      if (!k) return true
      const hay = `${row.ruleName ?? ''} ${row.eventTypes ?? ''}`.toLowerCase()
      return hay.includes(k)
    })
  })

  const pagedRules = computed(
    () => toPageResult(filteredRules.value, rulePage.value, rulePageSize.value).records,
  )

  function applyRuleFilter() {
    return runSearch(() => {
      ruleFilterApplied.keyword = ruleFilterDraft.keyword.trim()
      ruleFilterApplied.enabled = ruleFilterDraft.enabled
      rulePage.value = 1
    })
  }

  function resetRuleFilter() {
    return runReset(() => {
      ruleFilterDraft.keyword = ''
      ruleFilterDraft.enabled = undefined
      ruleFilterApplied.keyword = ''
      ruleFilterApplied.enabled = undefined
      rulePage.value = 1
    })
  }

  watch(
    () => tenant.tenantId,
    () => {
      ruleFormVisible.value = false
      openedForm = null
      savingRule.value = false
      rules.value = []
      channelOptions.value = []
      loadingRules.value = false
      loadRulesError.value = null
    },
    { flush: 'sync' },
  )
  useTenantReload(() => {
    void loadChannelOptions()
    rulePage.value = 1
    void loadRules()
  })

  defineExpose({ openRuleCreate })
</script>
