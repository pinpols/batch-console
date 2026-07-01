<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="load">
          {{ t('assetFreshness.refresh') }}
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">
          {{ t('assetFreshness.create') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ListPageQueryBar
        :cols="2"
        :filter-busy="loading"
        :refresh-busy="loading"
        :disabled="loading"
        @search="load"
        @reset="resetFilters"
        @refresh="load"
      >
        <el-form-item :label="t('assetFreshness.assetCode')">
          <el-input
            v-model="query.assetCode"
            clearable
            :placeholder="t('assetFreshness.assetCodePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('assetFreshness.enabled')">
          <el-select
            v-model="query.enabled"
            clearable
            :placeholder="t('assetFreshness.enabledAll')"
          >
            <el-option :label="t('common.yes')" :value="true" />
            <el-option :label="t('common.no')" :value="false" />
          </el-select>
        </el-form-item>
      </ListPageQueryBar>
    </SectionCard>

    <SectionCard class="mt">
      <EmptyState v-if="loadError && rows.length === 0" variant="error" :description="loadError">
        <template #action>
          <el-button type="primary" :icon="Refresh" :loading="loading" @click="load">
            {{ t('assetFreshness.refresh') }}
          </el-button>
        </template>
      </EmptyState>
      <el-table
        v-else
        v-loading="loading"
        :data="rows"
        row-key="id"
        stripe
        border
        size="small"
        class="console-table"
        :empty-text="t('common.noData')"
      >
        <el-table-column prop="assetCode" :label="t('assetFreshness.assetCode')" min-width="180" />
        <el-table-column
          prop="expectedByLocalTime"
          :label="t('assetFreshness.expectedBy')"
          width="150"
        />
        <el-table-column prop="timezone" :label="t('assetFreshness.timezone')" width="160" />
        <el-table-column :label="t('assetFreshness.staleAfter')" width="150" align="right">
          <template #default="{ row }">{{ formatSeconds(row.staleAfterSeconds) }}</template>
        </el-table-column>
        <el-table-column
          prop="lookbackDays"
          :label="t('assetFreshness.lookbackDays')"
          width="120"
        />
        <el-table-column prop="severity" :label="t('assetFreshness.severity')" width="120">
          <template #default="{ row }">
            <el-tag :type="severityTag(row.severity)" effect="plain">{{ row.severity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" :label="t('assetFreshness.enabled')" width="110">
          <template #default="{ row }">
            <el-switch
              :model-value="!!row.enabled"
              :loading="togglingId === row.id"
              @change="(value) => toggle(row, Boolean(value))"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="120" fixed="right">
          <template #default="{ row }">
            <el-tooltip :content="t('common.edit')" placement="top">
              <el-button :icon="Edit" text type="primary" @click="openEdit(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </SectionCard>

    <el-drawer
      v-model="drawerOpen"
      :title="editingId ? t('assetFreshness.editTitle') : t('assetFreshness.createTitle')"
      direction="rtl"
      size="520px"
    >
      <el-form label-width="150px" :model="form" @submit.prevent="save">
        <el-form-item :label="t('assetFreshness.assetCode')" required>
          <el-input
            v-model="form.assetCode"
            :placeholder="t('assetFreshness.assetCodePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('assetFreshness.expectedBy')" required>
          <el-time-picker
            v-model="form.expectedByLocalTime"
            value-format="HH:mm:ss"
            :placeholder="t('assetFreshness.expectedByPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('assetFreshness.timezone')">
          <el-input v-model="form.timezone" placeholder="Asia/Shanghai" />
        </el-form-item>
        <el-form-item :label="t('assetFreshness.staleAfter')">
          <el-input-number v-model="form.staleAfterSeconds" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item :label="t('assetFreshness.lookbackDays')">
          <el-input-number
            v-model="form.lookbackDays"
            :min="1"
            :max="31"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item :label="t('assetFreshness.severity')">
          <el-select v-model="form.severity">
            <el-option label="INFO" value="INFO" />
            <el-option label="WARN" value="WARN" />
            <el-option label="ERROR" value="ERROR" />
            <el-option label="CRITICAL" value="CRITICAL" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('assetFreshness.enabled')">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawerOpen = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Edit, Plus, Refresh } from '@element-plus/icons-vue'
  import {
    createAssetFreshnessPolicy,
    listAssetFreshnessPolicies,
    toggleAssetFreshnessPolicy,
    updateAssetFreshnessPolicy,
    type AssetFreshnessPolicy,
    type AssetFreshnessPolicyUpsertRequest,
  } from '@/api/assetFreshnessPolicies'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const rows = ref<AssetFreshnessPolicy[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const saving = ref(false)
  const togglingId = ref<number | null>(null)
  const drawerOpen = ref(false)
  const editingId = ref<number | null>(null)
  const query = reactive<{ assetCode: string; enabled?: boolean }>({ assetCode: '' })
  const form = reactive<AssetFreshnessPolicyUpsertRequest>({
    assetCode: '',
    assetType: 'JOB',
    expectedByLocalTime: '02:00:00',
    timezone: 'Asia/Shanghai',
    staleAfterSeconds: 0,
    lookbackDays: 1,
    severity: 'WARN',
    enabled: true,
  })

  function resetForm() {
    Object.assign(form, {
      assetCode: '',
      assetType: 'JOB',
      expectedByLocalTime: '02:00:00',
      timezone: 'Asia/Shanghai',
      staleAfterSeconds: 0,
      lookbackDays: 1,
      severity: 'WARN',
      enabled: true,
    })
  }

  function openCreate() {
    editingId.value = null
    resetForm()
    drawerOpen.value = true
  }

  function openEdit(row: AssetFreshnessPolicy) {
    editingId.value = row.id
    Object.assign(form, {
      assetCode: row.assetCode,
      assetType: 'JOB',
      expectedByLocalTime: row.expectedByLocalTime,
      timezone: row.timezone,
      staleAfterSeconds: row.staleAfterSeconds,
      lookbackDays: row.lookbackDays,
      severity: row.severity,
      enabled: row.enabled,
    })
    drawerOpen.value = true
  }

  function formatSeconds(value: unknown): string {
    const seconds = Number(value)
    if (!Number.isFinite(seconds) || seconds <= 0) return '0 s'
    if (seconds < 60) return `${seconds} s`
    return `${Math.round(seconds / 60)} min`
  }

  function severityTag(severity: string | undefined) {
    if (severity === 'CRITICAL' || severity === 'ERROR') return 'danger'
    if (severity === 'WARN') return 'warning'
    return 'info'
  }

  async function load() {
    loading.value = true
    loadError.value = ''
    try {
      rows.value = await listAssetFreshnessPolicies({
        tenantId: tenant.tenantId,
        assetCode: query.assetCode,
        enabled: query.enabled,
        limit: 200,
      })
    } catch (error) {
      rows.value = []
      loadError.value = error instanceof Error ? error.message : t('assetFreshness.loadFailed')
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    query.assetCode = ''
    query.enabled = undefined
    void load()
  }

  async function save() {
    if (!form.assetCode?.trim() || !form.expectedByLocalTime) {
      ElMessage.warning(t('assetFreshness.required'))
      return
    }
    saving.value = true
    try {
      const payload: AssetFreshnessPolicyUpsertRequest = {
        ...form,
        assetCode: form.assetCode.trim(),
      }
      if (editingId.value)
        await updateAssetFreshnessPolicy(editingId.value, tenant.tenantId, payload)
      else await createAssetFreshnessPolicy(tenant.tenantId, payload)
      drawerOpen.value = false
      ElMessage.success(t('assetFreshness.saveOk'))
      await load()
    } finally {
      saving.value = false
    }
  }

  async function toggle(row: AssetFreshnessPolicy, enabled: boolean) {
    togglingId.value = row.id
    try {
      await toggleAssetFreshnessPolicy(row.id, tenant.tenantId, { enabled })
      row.enabled = enabled
      ElMessage.success(t('assetFreshness.toggleOk'))
    } finally {
      togglingId.value = null
    }
  }

  useTenantReload(load)
</script>

<style scoped>
  .mt {
    margin-top: var(--page-block-gap);
  }
</style>
