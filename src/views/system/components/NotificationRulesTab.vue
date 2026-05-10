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
    >
      <template #query>
        <ListPageQueryBar
          :filter-busy="filterBusy"
          :refresh-busy="loadingRules"
          @search="applyRuleFilter"
          @reset="resetRuleFilter"
          @refresh="() => runRefresh(loadRules)"
        >
          <template #prepend>
            <el-button
              type="primary"
              :icon="Plus"
              class="pretty-add-button"
              @click="openRuleCreate"
            >
              {{ t('notificationCommon.btnAdd') }}
            </el-button>
          </template>
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
        prop="channelId"
        :label="t('notificationRulesTab.colChannelId')"
        width="100"
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

    <el-dialog
      v-model="ruleFormVisible"
      :title="
        ruleEditingId
          ? t('notificationRulesTab.dialogTitleEdit')
          : t('notificationRulesTab.dialogTitleCreate')
      "
      width="560px"
    >
      <el-form ref="ruleFormRef" :model="ruleForm" :rules="ruleFormRules" label-width="100px">
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
        <el-form-item :label="t('notificationRulesTab.fieldChannelId')" prop="channelId">
          <el-input-number
            v-model="ruleForm.channelId"
            :min="1"
            :placeholder="t('notificationRulesTab.channelIdPlaceholder')"
            class="query-w-full"
          />
        </el-form-item>
        <el-form-item :label="t('notificationCommon.enabledLabel')" prop="enabled">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleFormVisible = false">
          {{ t('notificationCommon.btnCancel') }}
        </el-button>
        <el-button type="primary" :loading="savingRule" @click="saveRule">
          {{ t('notificationCommon.btnSave') }}
        </el-button>
      </template>
    </el-dialog>
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
  import { Plus } from '@element-plus/icons-vue'
  import {
    listNotificationRules,
    createNotificationRule,
    updateNotificationRule,
    deleteNotificationRule,
  } from '@/api/notifications'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ProTable from '@/components/table/ProTable.vue'
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
  const rulePageSize = ref(20)
  const ruleFilterDraft = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const ruleFilterApplied = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const ruleForm = reactive({ ruleName: '', eventTypes: '', channelId: 1, enabled: true })

  const { formRef: ruleFormRef, validate: validateRuleForm } = useFormValidate()
  const ruleFormRules: FormRules = {
    ruleName: [r.required(t('notificationRulesTab.ruleName')), r.maxLength(128)],
    eventTypes: [r.required(t('notificationRulesTab.ruleEventTypes'))],
    channelId: [r.required(t('notificationRulesTab.ruleChannelId'), 'change')],
  }

  async function loadRules() {
    await runLoadingRules(async () => {
      const data = await listNotificationRules(tenant.tenantId)
      rules.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    }).catch(() => {
      rules.value = []
    })
  }

  function openRuleCreate() {
    ruleEditingId.value = null
    ruleForm.ruleName = ''
    ruleForm.eventTypes = ''
    ruleForm.channelId = 1
    ruleForm.enabled = true
    ruleFormVisible.value = true
  }

  function openRuleEdit(row: Record<string, unknown>) {
    ruleEditingId.value = Number(row.ruleId ?? row.id ?? 0) || null
    ruleForm.ruleName = String(row.ruleName ?? '')
    ruleForm.eventTypes = String(row.eventTypes ?? '')
    ruleForm.channelId = Number(row.channelId ?? 1)
    ruleForm.enabled = !!row.enabled
    ruleFormVisible.value = true
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
</script>
