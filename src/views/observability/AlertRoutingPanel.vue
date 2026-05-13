<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" @click="openCreate">
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
        <el-table-column prop="routeCode" label="routeCode" min-width="180" />
        <el-table-column prop="routeName" label="routeName" min-width="160" />
        <el-table-column prop="team" label="team" min-width="120" />
        <el-table-column prop="severity" label="severity" width="120" />
        <el-table-column prop="receiver" label="receiver" min-width="180" show-overflow-tooltip />
        <el-table-column prop="groupBy" label="groupBy" min-width="140" show-overflow-tooltip />
        <el-table-column label="enabled" width="120">
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
        <el-table-column prop="updatedAt" label="updatedAt" min-width="180" />
        <el-table-column :label="t('alertRoutingPanel.actions')" width="110" fixed="right">
          <template #default="{ row }">
            <el-tooltip :content="t('alertRoutingPanel.actionEdit')" placement="top">
              <el-button :icon="Edit" circle @click="openEdit(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-dialog
      v-model="dialogVisible"
      :title="
        editingId == null
          ? t('alertRoutingPanel.drawerCreateTitle')
          : t('alertRoutingPanel.drawerEditTitle')
      "
      width="640px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="routeCode" prop="routeCode">
          <el-input v-model="form.routeCode" :disabled="editingId != null" />
        </el-form-item>
        <el-form-item label="routeName">
          <el-input v-model="form.routeName" />
        </el-form-item>
        <el-form-item label="team" prop="team">
          <el-input v-model="form.team" />
        </el-form-item>
        <el-form-item label="alertGroup">
          <el-input v-model="form.alertGroup" />
        </el-form-item>
        <el-form-item label="severity" prop="severity">
          <el-select v-model="form.severity" allow-create filterable>
            <el-option label="CRITICAL" value="CRITICAL" />
            <el-option label="ERROR" value="ERROR" />
            <el-option label="WARN" value="WARN" />
            <el-option label="INFO" value="INFO" />
          </el-select>
        </el-form-item>
        <el-form-item label="receiver" prop="receiver">
          <el-input v-model="form.receiver" />
        </el-form-item>
        <el-form-item label="groupBy">
          <el-input v-model="form.groupBy" placeholder="tenantId,jobCode,severity" />
        </el-form-item>
        <el-form-item label="groupWaitSeconds">
          <el-input-number v-model="form.groupWaitSeconds" :min="0" />
        </el-form-item>
        <el-form-item label="groupIntervalSeconds">
          <el-input-number v-model="form.groupIntervalSeconds" :min="0" />
        </el-form-item>
        <el-form-item label="repeatIntervalSeconds">
          <el-input-number v-model="form.repeatIntervalSeconds" :min="0" />
        </el-form-item>
        <el-form-item label="enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item :label="t('alertRoutingPanel.descriptionLabel')">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="512"
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
    </el-dialog>
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
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

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
