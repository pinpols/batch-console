<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
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
              <span v-if="p.policyName" class="quota-card__name">{{ p.policyName }}</span>
              <el-tag size="small" effect="plain" :type="tagTypeForKey(p.fairShareGroup)">
                {{ p.fairShareGroup }}
              </el-tag>
            </div>
            <div class="quota-card__badges">
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
              <div class="kpi__value">{{ num(p.concurrentCap) }}</div>
            </div>
            <div class="kpi">
              <div class="kpi__label">{{ t('quotaPanel.kpiQps') }}</div>
              <div class="kpi__value">{{ num(p.qpsLimit) }}</div>
            </div>
            <div class="kpi">
              <div class="kpi__label">{{ t('quotaPanel.kpiBurst') }}</div>
              <div class="kpi__value">{{ num(p.burstLimit) }}</div>
            </div>
          </div>

          <el-collapse class="details">
            <el-collapse-item :title="t('quotaPanel.moreDetails')" name="more">
              <el-descriptions :column="2" size="small" border>
                <el-descriptions-item label="policyName">
                  {{ p.policyName || '—' }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('quotaPanel.tenantId')">
                  {{ p.tenantId || '—' }}
                </el-descriptions-item>
                <el-descriptions-item label="fairShareWeight">
                  {{ num(p.fairShareWeight) }}
                </el-descriptions-item>
                <el-descriptions-item label="slidingWindowHours">
                  {{ num(p.slidingWindowHours) }}
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
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

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
  const togglingId = ref<number | null>(null)
  const policies = ref<GovernanceQuotaPolicyRow[]>([])
  const kwDraft = ref('')
  const enabledDraft = ref<boolean | undefined>(undefined)
  const kwApplied = ref('')
  const enabledApplied = ref<boolean | undefined>(undefined)

  type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'
  const TAG_TYPES: TagType[] = ['primary', 'success', 'warning', 'danger', 'info']

  function tagTypeForKey(key: string | null | undefined): TagType {
    const s = String(key ?? '').trim()
    if (!s) return 'info'
    let hash = 0
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
    return TAG_TYPES[hash % TAG_TYPES.length]
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
      const matchKeyword = !k
        ? true
        : `${p.policyCode} ${p.policyName} ${p.fairShareGroup}`.toLowerCase().includes(k)
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
