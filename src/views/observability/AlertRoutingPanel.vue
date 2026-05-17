<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button v-if="canMutateConfig" type="primary" :icon="Plus" @click="openCreate">
          {{ t('alertRoutingPanel.actionCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
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
            @keyup.enter="onSearch"
          />
        </el-form-item>
      </ListPageQueryBar>

      <el-table v-loading="loading" :data="filtered" class="routing-table">
        <el-table-column
          prop="routeCode"
          :label="t('alertRoutingPanel.colRouteCode')"
          min-width="180"
        />
        <el-table-column
          prop="routeName"
          :label="t('alertRoutingPanel.colRouteName')"
          min-width="160"
        />
        <el-table-column prop="team" :label="t('alertRoutingPanel.fieldTeam')" min-width="120" />
        <el-table-column
          prop="severity"
          :label="t('alertRoutingPanel.fieldSeverity')"
          width="120"
        />
        <el-table-column
          prop="receiver"
          :label="t('alertRoutingPanel.fieldReceiver')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="groupBy"
          :label="t('alertRoutingPanel.colGroupBy')"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column :label="t('alertRoutingPanel.fieldEnabled')" width="120">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              inline-prompt
              :active-text="t('alertRoutingPanel.switchOn')"
              :inactive-text="t('alertRoutingPanel.switchOff')"
              :loading="togglingId === row.id"
              @change="toggleRouting(row)"
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
              :disabled="!row?.routeCode"
              @click="openEdit(row)"
            >
              {{ t('alertRoutingPanel.actionEdit') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="dialogVisible"
      :title="
        editingId == null
          ? t('alertRoutingPanel.drawerCreateTitle')
          : t('alertRoutingPanel.drawerEditTitle')
      "
      direction="rtl"
      size="640px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item :label="t('alertRoutingPanel.fieldRouteCode')" prop="routeCode">
          <el-input v-model="form.routeCode" :disabled="editingId != null" maxlength="128" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldRouteName')">
          <el-input v-model="form.routeName" maxlength="256" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldTeam')" prop="team">
          <el-input v-model="form.team" maxlength="128" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldAlertGroup')">
          <el-input v-model="form.alertGroup" maxlength="128" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldSeverity')" prop="severity">
          <MetaSelect v-model="form.severity" enum-key="severity" class="query-w-full" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldReceiver')" prop="receiver">
          <el-input v-model="form.receiver" maxlength="256" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldGroupBy')">
          <el-input
            v-model="form.groupBy"
            :placeholder="t('alertRoutingPanel.fieldGroupByPlaceholder')"
            maxlength="512"
          />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldGroupWaitSeconds')">
          <el-input-number v-model="form.groupWaitSeconds" :min="0" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldGroupIntervalSeconds')">
          <el-input-number v-model="form.groupIntervalSeconds" :min="0" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldRepeatIntervalSeconds')">
          <el-input-number v-model="form.repeatIntervalSeconds" :min="0" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.fieldEnabled')">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.descriptionLabel')">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="1024"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Edit, Plus } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import {
    governanceApi,
    type GovernanceAlertRoutingRow,
    type GovernanceAlertRoutingSavePayload,
  } from '@/api/governance'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import { usePermission } from '@/composables/usePermission'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

  const { canMutateConfig } = usePermission()
  const INT32_MAX = 2147483647
  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const listRemote = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(listRemote)
  const loading = ref(false)
  const saving = ref(false)
  const togglingId = ref<number | null>(null)
  const rows = ref<GovernanceAlertRoutingRow[]>([])
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
  const rules: FormRules = {
    routeCode: [{ required: true, message: t('alertRoutingPanel.ruleRouteCode'), trigger: 'blur' }],
    team: [{ required: true, message: t('alertRoutingPanel.ruleTeam'), trigger: 'blur' }],
    severity: [{ required: true, message: t('alertRoutingPanel.ruleSeverity'), trigger: 'change' }],
    receiver: [{ required: true, message: t('alertRoutingPanel.ruleReceiver'), trigger: 'blur' }],
  }

  const filtered = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    return rows.value.filter((row) => {
      const matchKeyword = !k
        ? true
        : `${row.routeCode} ${row.routeName} ${row.team} ${row.receiver} ${row.severity}`
            .toLowerCase()
            .includes(k)
      const matchEnabled =
        enabledApplied.value === undefined ? true : Boolean(row.enabled) === enabledApplied.value
      return matchKeyword && matchEnabled
    })
  })

  function onSearch() {
    return runSearch(() => {
      kwApplied.value = kwDraft.value.trim()
      enabledApplied.value = enabledDraft.value
    })
  }

  function onReset() {
    return runReset(() => {
      kwDraft.value = ''
      enabledDraft.value = undefined
      kwApplied.value = ''
      enabledApplied.value = undefined
    })
  }

  function onRefresh() {
    return runRefresh(load)
  }

  async function load() {
    loading.value = true
    try {
      rows.value = await governanceApi.listAlertRoutings(tenant.tenantId)
    } catch {
      rows.value = []
    } finally {
      loading.value = false
    }
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

  function openCreate() {
    resetForm()
    dialogVisible.value = true
  }

  function openEdit(row: GovernanceAlertRoutingRow) {
    resetForm(row)
    dialogVisible.value = true
  }

  async function submitForm() {
    const valid = await formRef.value
      ?.validate()
      .catch((errors: Record<string, Array<{ message?: string }>> | unknown) => {
        const firstField =
          errors && typeof errors === 'object' ? Object.keys(errors as object)[0] : null
        if (firstField) formRef.value?.scrollToField(firstField)
        return false
      })
    if (!valid) return
    saving.value = true
    try {
      const body: GovernanceAlertRoutingSavePayload = { tenantId: tenant.tenantId, ...form }
      if (editingId.value == null) {
        await governanceApi.createAlertRouting(body)
      } else {
        await governanceApi.updateAlertRouting(editingId.value, body)
      }
      ElMessage.success(t('alertRoutingPanel.saveSuccess', { code: form.routeCode }))
      dialogVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  async function toggleRouting(row: GovernanceAlertRoutingRow) {
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
  .panel-head {
    margin-bottom: var(--space-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
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
