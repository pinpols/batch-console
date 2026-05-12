<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <div class="panel-head">
        <div class="panel-title">
          <span class="dot dot--primary" />
          {{ t('quotaPanel.sectionTitle') }}
        </div>
        <el-button type="primary" :icon="Plus" @click="openCreate">
          {{ t('quotaPanel.actionCreate') }}
        </el-button>
      </div>

      <ListPageQueryBar
        class="quota-query"
        :filter-busy="filterBusy"
        :refresh-busy="loading"
        @search="onQuotaSearch"
        @reset="onQuotaReset"
        @refresh="onQuotaRefresh"
      >
        <el-form-item :label="t('quotaPanel.enabledLabel')">
          <el-select
            v-model="enabledDraft"
            clearable
            :placeholder="t('quotaPanel.enabledPlaceholder')"
            class="quota-query__select"
          >
            <el-option :label="t('quotaPanel.optEnabled')" :value="true" />
            <el-option :label="t('quotaPanel.optDisabled')" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('quotaPanel.keywordLabel')">
          <el-input
            v-model="kwDraft"
            :placeholder="t('quotaPanel.keywordPlaceholder')"
            clearable
            class="quota-query__search"
            @keyup.enter="onQuotaSearch"
          />
        </el-form-item>
      </ListPageQueryBar>

      <el-empty v-if="!loading && filtered.length === 0" :description="t('quotaPanel.empty')" />

      <div v-else class="grid">
        <el-card
          v-for="p in filtered"
          :key="p.id || p.policyCode"
          shadow="never"
          class="quota-card"
        >
          <div class="quota-card__top">
            <div class="quota-card__title">
              <span class="quota-card__code">{{ p.policyCode }}</span>
              <span v-if="p.description" class="quota-card__name">{{ p.description }}</span>
            </div>
            <div class="quota-card__badges">
              <el-tooltip :content="t('quotaPanel.actionEdit')" placement="top">
                <el-button :icon="Edit" circle @click="openEdit(p)" />
              </el-tooltip>
              <el-switch
                :model-value="p.enabled"
                inline-prompt
                :active-text="t('quotaPanel.switchOn')"
                :inactive-text="t('quotaPanel.switchOff')"
                :loading="togglingId === p.id"
                @change="togglePolicy(p)"
              />
              <el-tag size="small" effect="plain" type="info">
                weight: {{ num(p.fairShareWeight) }}
              </el-tag>
            </div>
          </div>

          <div class="kpi-row">
            <div class="kpi">
              <div class="kpi__label">{{ t('quotaPanel.kpiConcurrent') }}</div>
              <div class="kpi__value">{{ num(p.maxRunningJobsPerTenant) }}</div>
            </div>
            <div class="kpi">
              <div class="kpi__label">{{ t('quotaPanel.kpiQps') }}</div>
              <div class="kpi__value">{{ num(p.maxQpsPerTenant) }}</div>
            </div>
            <div class="kpi">
              <div class="kpi__label">{{ t('quotaPanel.kpiPartitions') }}</div>
              <div class="kpi__value">{{ num(p.maxPartitionsPerTenant) }}</div>
            </div>
          </div>

          <el-collapse class="details">
            <el-collapse-item :title="t('quotaPanel.moreDetails')" name="more">
              <el-descriptions :column="2" size="small" border>
                <el-descriptions-item :label="t('quotaPanel.tenantId')">
                  {{ p.tenantId || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="fairShareWeight">
                  {{ num(p.fairShareWeight) }}
                </el-descriptions-item>
                <el-descriptions-item label="maxPartitionsPerTenant">
                  {{ num(p.maxPartitionsPerTenant) }}
                </el-descriptions-item>
                <el-descriptions-item label="updatedAt">
                  {{ p.updatedAt || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="enabled">
                  {{ p.enabled ? 'true' : 'false' }}
                </el-descriptions-item>
              </el-descriptions>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </div>
    </SectionCard>

    <el-dialog
      v-model="dialogVisible"
      :title="
        editingId == null ? t('quotaPanel.drawerCreateTitle') : t('quotaPanel.drawerEditTitle')
      "
      width="560px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="190px">
        <el-form-item label="policyCode" prop="policyCode">
          <el-input v-model="form.policyCode" :disabled="editingId != null" />
        </el-form-item>
        <el-form-item label="maxRunningJobsPerTenant" prop="maxRunningJobsPerTenant">
          <el-input-number v-model="form.maxRunningJobsPerTenant" :min="0" />
        </el-form-item>
        <el-form-item label="maxPartitionsPerTenant" prop="maxPartitionsPerTenant">
          <el-input-number v-model="form.maxPartitionsPerTenant" :min="0" />
        </el-form-item>
        <el-form-item label="maxQpsPerTenant" prop="maxQpsPerTenant">
          <el-input-number v-model="form.maxQpsPerTenant" :min="0" />
        </el-form-item>
        <el-form-item label="fairShareWeight" prop="fairShareWeight">
          <el-input-number v-model="form.fairShareWeight" :min="1" />
        </el-form-item>
        <el-form-item label="enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item :label="t('quotaPanel.descriptionLabel')">
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

  const { t } = useI18n({ useScope: 'global' })
  import { governanceApi, type GovernanceQuotaPolicyRow } from '@/api/governance'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

  const tenant = useTenantStore()
  const listRemote = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(listRemote)
  const loading = ref(false)
  const saving = ref(false)
  const togglingId = ref<number | null>(null)
  const policies = ref<GovernanceQuotaPolicyRow[]>([])
  const kwDraft = ref('')
  const enabledDraft = ref<boolean | undefined>(undefined)
  const kwApplied = ref('')
  const enabledApplied = ref<boolean | undefined>(undefined)

  const dialogVisible = ref(false)
  const editingId = ref<number | null>(null)
  const formRef = ref<FormInstance>()
  const form = reactive({
    policyCode: '',
    maxRunningJobsPerTenant: 0,
    maxPartitionsPerTenant: 0,
    maxQpsPerTenant: 0,
    fairShareWeight: 1,
    enabled: true,
    description: '',
  })

  const rules: FormRules = {
    policyCode: [{ required: true, message: t('quotaPanel.rulePolicyCode'), trigger: 'blur' }],
    fairShareWeight: [
      { required: true, message: t('quotaPanel.ruleFairShareWeight'), trigger: 'blur' },
    ],
  }

  function num(v: unknown): string {
    if (v == null) return '—'
    const n = Number(v)
    return Number.isFinite(n) ? String(n) : '—'
  }

  function onQuotaSearch() {
    return runSearch(() => {
      kwApplied.value = kwDraft.value.trim()
      enabledApplied.value = enabledDraft.value
    })
  }

  function onQuotaReset() {
    return runReset(() => {
      kwDraft.value = ''
      enabledDraft.value = undefined
      kwApplied.value = ''
      enabledApplied.value = undefined
    })
  }

  function onQuotaRefresh() {
    return runRefresh(load)
  }

  const filtered = computed(() => {
    const k = kwApplied.value.trim().toLowerCase()
    return policies.value.filter((p) => {
      const matchKeyword = !k ? true : `${p.policyCode} ${p.description}`.toLowerCase().includes(k)
      const matchEnabled =
        enabledApplied.value === undefined ? true : Boolean(p.enabled) === enabledApplied.value
      return matchKeyword && matchEnabled
    })
  })

  async function load() {
    loading.value = true
    try {
      policies.value = await governanceApi.listQuotaPolicies(tenant.tenantId)
    } catch {
      policies.value = []
    } finally {
      loading.value = false
    }
  }

  function resetForm(row?: GovernanceQuotaPolicyRow) {
    editingId.value = row?.id ?? null
    form.policyCode = row?.policyCode ?? ''
    form.maxRunningJobsPerTenant = row?.maxRunningJobsPerTenant ?? 0
    form.maxPartitionsPerTenant = row?.maxPartitionsPerTenant ?? 0
    form.maxQpsPerTenant = row?.maxQpsPerTenant ?? 0
    form.fairShareWeight = row?.fairShareWeight ?? 1
    form.enabled = row?.enabled ?? true
    form.description = row?.description ?? ''
  }

  function openCreate() {
    resetForm()
    dialogVisible.value = true
  }

  function openEdit(row: GovernanceQuotaPolicyRow) {
    resetForm(row)
    dialogVisible.value = true
  }

  async function submitForm() {
    if (!(await formRef.value?.validate().catch(() => false))) return
    saving.value = true
    try {
      const body = { tenantId: tenant.tenantId, ...form }
      if (editingId.value == null) {
        await governanceApi.createQuotaPolicy(body)
      } else {
        await governanceApi.updateQuotaPolicy(editingId.value, body)
      }
      ElMessage.success(t('quotaPanel.saveSuccess', { code: form.policyCode }))
      dialogVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  async function togglePolicy(row: GovernanceQuotaPolicyRow) {
    if (!row.id) return
    const target = !row.enabled
    try {
      const action = target ? t('quotaPanel.switchOn') : t('quotaPanel.switchOff')
      await ElMessageBox.confirm(
        t('quotaPanel.toggleConfirmText', { code: row.policyCode, action }),
        t('quotaPanel.toggleConfirmTitle'),
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
      // 用 row.tenantId 避免租户切换 race(BE 防跨租户泄漏会返 404)
      await governanceApi.toggleQuotaPolicy(row.id, row.tenantId ?? tenant.tenantId, target)
      row.enabled = target
      const action = target ? t('quotaPanel.switchOn') : t('quotaPanel.switchOff')
      ElMessage.success(t('quotaPanel.toggleSuccess', { action, code: row.policyCode }))
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
  .dot--primary {
    background: var(--color-primary);
  }

  .quota-query {
    margin-bottom: var(--page-block-gap);
  }

  .quota-query__search {
    width: min(360px, 100%);
  }

  .quota-query__select {
    width: 140px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: var(--page-section-gap);
  }

  .quota-card {
    border: 1px solid var(--color-border-light);
  }

  .quota-card__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
    margin-bottom: 10px;
  }

  .quota-card__title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
    min-width: 0;
  }

  .quota-card__code {
    font-size: var(--font-size-lg);
    font-weight: 750;
    letter-spacing: -0.02em;
    color: var(--color-text-primary);
  }

  .quota-card__name {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .quota-card__badges {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .kpi-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-md);
    margin: 6px 0 12px;
  }

  .kpi {
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-card-lg);
    padding: 10px 10px 8px;
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
  }

  .kpi__label {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    line-height: var(--line-height-tight);
  }

  .kpi__value {
    margin-top: 4px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .muted {
    color: var(--color-text-tertiary);
  }

  .details {
    margin-top: 10px;
  }

  @media (max-width: 820px) {
    .grid {
      grid-template-columns: 1fr;
    }
    .kpi-row {
      grid-template-columns: 1fr;
    }
  }
</style>
