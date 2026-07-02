<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button v-if="canMutateConfig" type="primary" :icon="Plus" @click="openCreate">
          {{ t('quotaPanel.actionCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <!-- 还原设计:内容直铺底色,无外层卡片壳 -->
    <div>
      <div class="panel-head">
        <div class="panel-title">
          <span class="dot dot--primary" />
          {{ t('quotaPanel.sectionTitle') }}
        </div>
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

      <EmptyState v-if="!loading && filtered.length === 0" :description="t('quotaPanel.empty')" />

      <div v-else class="grid">
        <el-card
          v-for="p in filtered"
          :key="p.id || p.policyCode"
          shadow="never"
          class="quota-card"
          :class="{ 'quota-card--disabled': !p.enabled }"
        >
          <div class="quota-card__head">
            <div class="quota-card__heading">
              <div class="quota-card__heading-row">
                <span class="quota-card__code">{{ p.policyCode }}</span>
                <el-tag
                  :type="p.enabled ? 'success' : 'info'"
                  size="small"
                  effect="light"
                  round
                  class="quota-card__status"
                >
                  {{ p.enabled ? t('quotaPanel.switchOn') : t('quotaPanel.switchOff') }}
                </el-tag>
              </div>
              <div v-if="p.description" class="quota-card__desc">{{ p.description }}</div>
              <div class="quota-card__meta">
                <span class="quota-card__chip">
                  <span class="quota-card__chip-label">weight</span>
                  <span class="quota-card__chip-value">{{ num(p.fairShareWeight) }}</span>
                </span>
                <span v-if="p.tenantId" class="quota-card__chip">
                  <span class="quota-card__chip-label">tenant</span>
                  <span class="quota-card__chip-value">{{ p.tenantId }}</span>
                </span>
              </div>
            </div>
            <div class="quota-card__actions">
              <el-switch
                :model-value="p.enabled"
                :loading="togglingId === p.id"
                @change="togglePolicy(p)"
              />
              <el-button size="small" :icon="Edit" :disabled="!p?.policyCode" @click="openEdit(p)">
                {{ t('quotaPanel.actionEdit') }}
              </el-button>
            </div>
          </div>

          <div class="kpi-row">
            <div class="kpi kpi--primary">
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
                <el-descriptions-item :label="t('quotaPanel.fieldFairShareWeight')">
                  {{ num(p.fairShareWeight) }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('quotaPanel.fieldMaxPartitionsPerTenant')">
                  {{ num(p.maxPartitionsPerTenant) }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('quotaPanel.descUpdatedAt')">
                  {{ p.updatedAt || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('quotaPanel.fieldEnabled')">
                  {{ p.enabled ? 'true' : 'false' }}
                </el-descriptions-item>
              </el-descriptions>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </div>
    </div>

    <el-drawer
      :append-to-body="true"
      v-model="dialogVisible"
      :title="
        editingId == null ? t('quotaPanel.drawerCreateTitle') : t('quotaPanel.drawerEditTitle')
      "
      direction="rtl"
      size="640px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="190px">
        <el-form-item :label="t('quotaPanel.fieldPolicyCode')" prop="policyCode">
          <el-input v-model="form.policyCode" :disabled="editingId != null" maxlength="128" />
        </el-form-item>
        <el-form-item
          :label="t('quotaPanel.fieldMaxRunningJobsPerTenant')"
          prop="maxRunningJobsPerTenant"
        >
          <el-input-number v-model="form.maxRunningJobsPerTenant" :min="0" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item
          :label="t('quotaPanel.fieldMaxPartitionsPerTenant')"
          prop="maxPartitionsPerTenant"
        >
          <el-input-number v-model="form.maxPartitionsPerTenant" :min="0" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item :label="t('quotaPanel.fieldMaxQpsPerTenant')" prop="maxQpsPerTenant">
          <el-input-number v-model="form.maxQpsPerTenant" :min="0" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item :label="t('quotaPanel.fieldFairShareWeight')" prop="fairShareWeight">
          <el-input-number v-model="form.fairShareWeight" :min="1" :max="INT32_MAX" />
        </el-form-item>
        <el-form-item :label="t('quotaPanel.fieldEnabled')">
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
        <el-button type="primary" :loading="submitAction.loading.value" @click="submitForm">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Pencil as Edit, Plus } from 'lucide-vue-next'
  import { ElMessage } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import { governanceApi, type GovernanceQuotaPolicyRow } from '@/api/governance'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useAsyncAction } from '@/composables/useAsyncAction'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

  const tenant = useTenantStore()
  const listRemote = ref(false)
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(listRemote)
  import { usePermission } from '@/composables/usePermission'

  const { canMutateConfig } = usePermission()
  const INT32_MAX = 2147483647
  const loading = ref(false)
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

  // BE @Min(0) / @Min(1) — null 也会 400,前端拦截可减 BE 4xx
  const nonNegativeRule = (msgKey: string) => [
    { required: true, message: t(msgKey), trigger: 'change' as const },
    { type: 'number' as const, min: 0, message: t(msgKey), trigger: 'change' as const },
  ]
  const rules: FormRules = {
    policyCode: [{ required: true, message: t('quotaPanel.rulePolicyCode'), trigger: 'blur' }],
    maxRunningJobsPerTenant: nonNegativeRule('quotaPanel.ruleNonNegative'),
    maxPartitionsPerTenant: nonNegativeRule('quotaPanel.ruleNonNegative'),
    maxQpsPerTenant: nonNegativeRule('quotaPanel.ruleNonNegative'),
    fairShareWeight: [
      { required: true, message: t('quotaPanel.ruleFairShareWeight'), trigger: 'change' },
      {
        type: 'number',
        min: 1,
        message: t('quotaPanel.ruleFairShareWeight'),
        trigger: 'change',
      },
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

  // useAsyncAction:连点抗抖,300ms cooldown 防关弹窗动画期间二次提交
  const submitAction = useAsyncAction(
    async () => {
      const body = { tenantId: tenant.tenantId, ...form }
      if (editingId.value == null) {
        await governanceApi.createQuotaPolicy(body)
      } else {
        await governanceApi.updateQuotaPolicy(editingId.value, body)
      }
      ElMessage.success(t('quotaPanel.saveSuccess', { code: form.policyCode }))
      dialogVisible.value = false
      await load()
    },
    { cooldownMs: 300 },
  )

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
    await submitAction.run()
  }

  async function togglePolicy(row: GovernanceQuotaPolicyRow) {
    if (!row.id) return
    const target = !row.enabled
    try {
      const action = target ? t('quotaPanel.switchOn') : t('quotaPanel.switchOff')
      await confirmDanger({
        verb: t('quotaPanel.toggleConfirmTitle'),
        target: '',
        consequence: t('quotaPanel.toggleConfirmText', { code: row.policyCode, action }),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
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
    border-radius: var(--radius-content);
    position: relative;
    overflow: hidden;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .quota-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--color-success);
  }

  .quota-card--disabled::before {
    background: var(--color-text-tertiary);
    opacity: 0.5;
  }

  .quota-card--disabled {
    opacity: 0.78;
  }

  .quota-card:hover {
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border-light));
    box-shadow: 0 4px 14px color-mix(in srgb, var(--color-primary) 8%, transparent);
  }

  .quota-card__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .quota-card__heading {
    min-width: 0;
    flex: 1;
  }

  .quota-card__heading-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .quota-card__code {
    font-size: 16px;
    font-weight: 750;
    letter-spacing: -0.01em;
    color: var(--color-text-primary);
  }

  .quota-card__status {
    margin-left: 2px;
  }

  .quota-card__desc {
    color: var(--color-text-secondary);
    font-size: 12.5px;
    line-height: 1.5;
    margin-bottom: 6px;
  }

  .quota-card__meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .quota-card__chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    background: var(--color-bg-subtle);
    border-radius: 10px;
    font-size: 11.5px;
    line-height: 18px;
  }

  .quota-card__chip-label {
    color: var(--color-text-tertiary);
  }

  .quota-card__chip-value {
    color: var(--color-text-primary);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .quota-card__actions {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .kpi-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0 0 12px;
  }

  .kpi {
    border: 1px solid var(--color-border-light);
    border-radius: 8px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kpi--primary {
    background: color-mix(in srgb, var(--color-primary) 6%, var(--color-bg-card));
    border-color: color-mix(in srgb, var(--color-primary) 25%, var(--color-border-light));
  }

  .kpi--primary .kpi__value {
    color: var(--color-primary);
  }

  .kpi__label {
    font-size: 11.5px;
    color: var(--color-text-tertiary);
    line-height: 1;
    letter-spacing: 0.02em;
  }

  .kpi__value {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-primary);
  }

  .muted {
    color: var(--color-text-tertiary);
  }

  .details {
    margin-top: 4px;
    border-top: 1px solid var(--color-border-light);
  }

  .details :deep(.el-collapse-item__header) {
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 12.5px;
    height: 36px;
    line-height: 36px;
    border-bottom: none;
  }

  .details :deep(.el-collapse-item__wrap) {
    border-bottom: none;
  }

  .details :deep(.el-collapse-item__content) {
    padding-bottom: 8px;
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
