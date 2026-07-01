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
            <el-select
              class="query-w-140"
              v-model="ruleFilterDraft.enabled"
              clearable
              :placeholder="t('notificationCommon.allPlaceholder')"
            >
              <el-option :label="t('notificationCommon.optEnabled')" :value="true" />
              <el-option :label="t('notificationCommon.optDisabled')" :value="false" />
            </el-select>
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
            <el-button size="small" plain type="primary" @click="openRuleEdit(row)">
              {{ t('notificationCommon.btnEdit') }}
            </el-button>
            <el-button size="small" plain type="danger" @click="confirmDeleteRule(row)">
              {{ t('notificationCommon.btnDelete') }}
            </el-button>
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
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import type { FormRules } from 'element-plus'
  import { useFormValidate, rules as r } from '@/composables/useFormValidate'
  import { useDirtyForm } from '@/composables/useDirtyForm'
  import { useFormFocus } from '@/composables/useFormFocus'
  import { Plus } from '@element-plus/icons-vue'
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
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
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
  async function loadChannelOptions() {
    try {
      const data = await listNotificationChannels(tenant.tenantId)
      const list = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
      channelOptions.value = list
        .map((c) => ({
          id: Number(c.id ?? 0),
          code: String(c.channelCode ?? ''),
          name: String(c.channelName ?? ''),
        }))
        .filter((c) => !!c.code)
    } catch {
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
    await runLoadingRules(async () => {
      const data = await listNotificationRules(tenant.tenantId)
      rules.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    }).catch(() => {
      rules.value = []
    })
  }

  // 脏数据保护
  const ruleDirty = useDirtyForm(() => ruleForm, { enabled: () => ruleFormVisible.value })
  useFormFocus(ruleFormRef, () => ruleFormVisible.value)

  function openRuleCreate() {
    ruleEditingId.value = null
    ruleForm.ruleName = ''
    ruleForm.eventTypes = ''
    ruleForm.channelCode = ''
    ruleForm.enabled = true
    ruleFormVisible.value = true
    ruleDirty.markPristine()
  }

  function openRuleEdit(row: Record<string, unknown>) {
    ruleEditingId.value = Number(row.ruleId ?? row.id ?? 0) || null
    ruleForm.ruleName = String(row.ruleName ?? '')
    ruleForm.eventTypes = String(row.eventTypes ?? '')
    ruleForm.channelCode = String(row.channelCode ?? '')
    ruleForm.enabled = !!row.enabled
    ruleFormVisible.value = true
    ruleDirty.markPristine()
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
    if (!(await validateRuleForm())) return
    savingRule.value = true
    try {
      const body = { ...ruleForm }
      if (ruleEditingId.value) {
        await updateNotificationRule(ruleEditingId.value, tenant.tenantId, body)
      } else {
        await createNotificationRule(tenant.tenantId, body)
      }
      ElMessage.success(t('notificationCommon.savedToast'))
      ruleDirty.markPristine()
      ruleFormVisible.value = false
      await loadRules()
    } finally {
      savingRule.value = false
    }
  }

  async function confirmDeleteRule(row: Record<string, unknown>) {
    const ruleId = Number(row.ruleId ?? row.id ?? 0)
    try {
      await confirmDanger({
        verb: t('notificationCommon.deleteVerb'),
        target: t('notificationRulesTab.deleteTarget', { name: row.ruleName }),
        consequence: t('notificationRulesTab.deleteConsequence'),
        irreversible: false,
      })
      await deleteNotificationRule(ruleId, tenant.tenantId)
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

  useTenantReload(() => {
    rulePage.value = 1
    void loadRules()
  })

  defineExpose({ openRuleCreate })
</script>
