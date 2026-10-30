<template>
  <SectionCard class="result-version-governance">
    <template #header>
      <div class="result-version-governance__header">
        <span>{{ t('batchDayReplay.resultGovernanceTitle') }}</span>
        <el-button :loading="loading" @click="refresh">
          {{ t('common.refresh') }}
        </el-button>
      </div>
    </template>

    <p class="result-version-governance__hint">
      {{ t('batchDayReplay.resultGovernanceHint') }}
    </p>

    <el-alert
      v-if="!tenant.tenantId"
      :title="t('batchDayReplay.resultGovernanceSelectTenant')"
      type="info"
      :closable="false"
    />
    <template v-else>
      <el-form inline @submit.prevent="search">
        <el-form-item :label="t('batchDayReplay.resultGovernanceBusinessKey')">
          <el-input
            v-model="businessKey"
            class="result-version-governance__business-key"
            maxlength="512"
            clearable
            :disabled="Boolean(actionVersionId)"
            :placeholder="t('batchDayReplay.resultGovernanceBusinessKeyPlaceholder')"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-button type="primary" :loading="loading" @click="search">
          {{ t('batchDayReplay.resultGovernanceSearch') }}
        </el-button>
      </el-form>

      <el-alert
        v-if="loadError"
        :title="t('batchDayReplay.resultGovernanceLoadError')"
        type="error"
        :closable="false"
        show-icon
      />

      <el-alert
        v-else-if="businessKey.trim() && effectiveError"
        :title="t('batchDayReplay.resultGovernanceLoadError')"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-alert
        v-else-if="businessKey.trim() && effectiveVersion"
        type="success"
        :closable="false"
        class="result-version-governance__effective"
      >
        {{
          t('batchDayReplay.resultGovernanceEffective', {
            version: effectiveVersion.versionNo,
            id: effectiveVersion.id,
          })
        }}
      </el-alert>
      <el-alert
        v-else-if="businessKey.trim() && queried && versions.length > 0 && !effectiveError"
        :title="t('batchDayReplay.resultGovernanceNoEffective')"
        type="info"
        :closable="false"
      />

      <el-table
        v-loading="loading"
        :data="versions"
        row-key="id"
        :empty-text="emptyText"
        :aria-label="t('batchDayReplay.resultGovernanceTitle')"
      >
        <el-table-column
          prop="versionNo"
          :label="t('batchDayReplay.resultGovernanceColumns.version')"
          width="100"
        >
          <template #default="{ row }">v{{ row.versionNo }}</template>
        </el-table-column>
        <el-table-column :label="t('batchDayReplay.resultGovernanceStatus')" width="125">
          <template #default="{ row }">
            <el-tag :type="statusTone(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="jobInstanceId"
          :label="t('batchDayReplay.resultGovernanceColumns.jobInstance')"
          min-width="125"
        />
        <el-table-column
          prop="generatedAt"
          :label="t('batchDayReplay.resultGovernanceColumns.generatedAt')"
          min-width="175"
        >
          <template #default="{ row }">{{ fmtDatetime(row.generatedAt) }}</template>
        </el-table-column>
        <el-table-column
          prop="promotionPolicy"
          :label="t('batchDayReplay.resultGovernanceColumns.policy')"
          min-width="150"
        />
        <el-table-column
          prop="dqGateStatus"
          :label="t('batchDayReplay.resultGovernanceColumns.dqGate')"
          min-width="125"
        />
        <el-table-column
          :label="t('batchDayReplay.resultGovernanceColumns.actions')"
          width="235"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openDetail(row as ResultVersion)">
              {{ t('common.detail') }}
            </el-button>
            <el-button
              v-if="canMutateConfig && row.status === 'PENDING'"
              link
              type="success"
              :disabled="Boolean(actionVersionId)"
              :loading="actionVersionId === `${row.id}:promote`"
              @click.stop="actOnVersion(row as ResultVersion, 'promote')"
            >
              {{ t('batchDayReplay.resultGovernancePromote') }}
            </el-button>
            <el-button
              v-if="canMutateConfig && row.status === 'PENDING'"
              link
              type="danger"
              :disabled="Boolean(actionVersionId)"
              :loading="actionVersionId === `${row.id}:reject`"
              @click.stop="actOnVersion(row as ResultVersion, 'reject')"
            >
              {{ t('batchDayReplay.resultGovernanceReject') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <p v-if="!canMutateConfig && versions.length" class="result-version-governance__hint">
        {{ t('batchDayReplay.resultGovernanceReadOnly') }}
      </p>
    </template>
  </SectionCard>

  <el-drawer
    v-model="detailOpen"
    :title="t('batchDayReplay.resultGovernanceDetail')"
    direction="rtl"
    size="min(520px, 92vw)"
  >
    <el-skeleton v-if="detailLoading" animated :rows="5" />
    <el-alert
      v-else-if="detailError"
      :title="t('batchDayReplay.resultGovernanceLoadError')"
      type="error"
      :closable="false"
    />
    <template v-else-if="detail">
      <el-descriptions :column="1" border>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceId')">
          {{ detail.id }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceNumber')">
          v{{ detail.versionNo }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceStatus')">
          {{ statusLabel(detail.status) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceJobInstance')">
          {{ detail.jobInstanceId ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceGeneratedAt')">
          {{ fmtDatetime(detail.generatedAt) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceGeneratedBy')">
          {{ detail.generatedBy || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernancePolicy')">
          {{ detail.promotionPolicy || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceDqGate')">
          {{ detail.dqGateStatus || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceEffectiveAt')">
          {{ fmtDatetime(detail.effectiveAt) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceDeactivatedAt')">
          {{ fmtDatetime(detail.deactivatedAt) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('batchDayReplay.resultGovernanceApprovalId')">
          {{ detail.approvalId ?? '—' }}
        </el-descriptions-item>
      </el-descriptions>
      <el-alert
        :title="t('batchDayReplay.resultGovernancePayloadOmitted')"
        type="info"
        :closable="false"
        class="result-version-governance__payload-note"
      />
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import SectionCard from '@/components/common/SectionCard.vue'
  import { batchDayReplayApi, type ResultVersion } from '@/api/batchDayReplay'
  import { usePermission } from '@/composables/usePermission'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantStore } from '@/stores/tenant'
  import { fmtDatetime } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const { canMutateConfig } = usePermission()
  const businessKey = ref('')
  const versions = ref<ResultVersion[]>([])
  const effectiveVersion = ref<ResultVersion | null>(null)
  const loading = ref(false)
  const loadError = ref(false)
  const effectiveError = ref(false)
  const queried = ref(false)
  const actionVersionId = ref('')
  const detailOpen = ref(false)
  const detailLoading = ref(false)
  const detailError = ref(false)
  const detail = ref<ResultVersion | null>(null)
  const emptyText = computed(() =>
    queried.value
      ? t('batchDayReplay.resultGovernanceNoVersions')
      : t('batchDayReplay.resultGovernanceEmpty'),
  )
  let requestId = 0
  let detailRequestId = 0

  function refresh() {
    void load()
  }

  watch(
    () => tenant.tenantId,
    () => {
      ++requestId
      ++detailRequestId
      businessKey.value = ''
      versions.value = []
      effectiveVersion.value = null
      queried.value = false
      loadError.value = false
      effectiveError.value = false
      detailOpen.value = false
      detail.value = null
      loading.value = false
      detailLoading.value = false
      actionVersionId.value = ''
    },
  )

  watch(businessKey, () => {
    ++requestId
    versions.value = []
    effectiveVersion.value = null
    queried.value = false
    loadError.value = false
    effectiveError.value = false
    loading.value = false
  })

  async function search() {
    const key = businessKey.value.trim()
    if (!key || !tenant.tenantId) {
      if (!key) ElMessage.warning(t('batchDayReplay.resultGovernanceEmpty'))
      return
    }
    await load(key)
  }

  async function load(key = businessKey.value.trim()) {
    const currentRequest = ++requestId
    const tenantId = tenant.tenantId
    if (!key || !tenantId) {
      versions.value = []
      effectiveVersion.value = null
      queried.value = false
      return
    }
    loading.value = true
    loadError.value = false
    effectiveError.value = false
    queried.value = false
    try {
      const [listResult, effectiveResult] = await Promise.allSettled([
        batchDayReplayApi.resultVersions(tenantId, key),
        batchDayReplayApi.effectiveResultVersion(tenantId, key),
      ])
      if (currentRequest !== requestId || tenantId !== tenant.tenantId) return
      if (listResult.status === 'rejected') {
        loadError.value = true
        versions.value = []
        effectiveVersion.value = null
        return
      }
      versions.value = listResult.value
      if (effectiveResult.status === 'fulfilled') {
        effectiveVersion.value = effectiveResult.value
      } else if (isNotFound(effectiveResult.reason)) {
        effectiveVersion.value = null
      } else {
        effectiveError.value = true
        effectiveVersion.value = null
      }
      queried.value = true
    } catch {
      if (currentRequest === requestId && tenantId === tenant.tenantId) loadError.value = true
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  async function openDetail(row: ResultVersion) {
    const tenantId = tenant.tenantId
    if (!tenantId) return
    const currentRequest = ++detailRequestId
    detailOpen.value = true
    detailLoading.value = true
    detailError.value = false
    detail.value = null
    try {
      const response = await batchDayReplayApi.resultVersionDetail(row.id, tenantId)
      if (currentRequest === detailRequestId && tenantId === tenant.tenantId)
        detail.value = response
    } catch {
      if (currentRequest === detailRequestId && tenantId === tenant.tenantId)
        detailError.value = true
    } finally {
      if (currentRequest === detailRequestId) detailLoading.value = false
    }
  }

  async function actOnVersion(row: ResultVersion, action: 'promote' | 'reject') {
    if (!canMutateConfig.value || row.status !== 'PENDING' || actionVersionId.value) return
    const tenantId = tenant.tenantId
    if (!tenantId) return
    const confirmationKey =
      action === 'promote'
        ? 'batchDayReplay.resultGovernancePromoteConfirm'
        : 'batchDayReplay.resultGovernanceRejectConfirm'
    try {
      await ElMessageBox.confirm(
        t(confirmationKey, { version: row.versionNo }),
        t(`batchDayReplay.resultGovernance${action === 'promote' ? 'Promote' : 'Reject'}`),
        {
          type: 'warning',
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
        },
      )
    } catch {
      return
    }
    if (!canMutateConfig.value || tenantId !== tenant.tenantId) return
    actionVersionId.value = `${row.id}:${action}`
    try {
      if (action === 'promote') await batchDayReplayApi.promoteResultVersion(row.id, tenantId)
      else await batchDayReplayApi.rejectResultVersion(row.id, tenantId)
      if (tenantId !== tenant.tenantId) return
      await load()
      if (loadError.value) {
        ElMessage.warning(t('batchDayReplay.resultGovernanceActionError'))
        return
      }
      ElMessage.success(t('batchDayReplay.resultGovernanceActionRecorded'))
    } catch {
      if (tenantId === tenant.tenantId) {
        await load()
        ElMessage.error(t('batchDayReplay.resultGovernanceActionError'))
      }
    } finally {
      if (tenantId === tenant.tenantId) actionVersionId.value = ''
    }
  }

  function statusLabel(status: string) {
    if (status === 'PENDING') return t('batchDayReplay.resultGovernancePending')
    if (status === 'EFFECTIVE') return t('batchDayReplay.resultGovernanceEffectiveState')
    if (status === 'REJECTED') return t('batchDayReplay.resultGovernanceRejected')
    if (status === 'SUPERSEDED') return t('batchDayReplay.resultGovernanceSuperseded')
    if (status === 'ARCHIVED') return t('batchDayReplay.resultGovernanceArchived')
    if (status === 'DRY_RUN') return t('batchDayReplay.resultGovernanceDryRun')
    return status || t('batchDayReplay.resultGovernanceOtherStatus')
  }

  function statusTone(status: string) {
    if (status === 'PENDING') return 'warning'
    if (status === 'EFFECTIVE') return 'success'
    if (status === 'REJECTED') return 'info'
    return 'info'
  }

  function isNotFound(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('response' in error)) return false
    const response = error.response
    return Boolean(
      response && typeof response === 'object' && 'status' in response && response.status === 404,
    )
  }

  useTenantReload(() => {
    void load()
  })
</script>

<style scoped>
  .result-version-governance__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }

  .result-version-governance__hint {
    margin: 0 0 12px;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .result-version-governance__business-key {
    width: min(560px, 55vw);
  }

  .result-version-governance__effective,
  .result-version-governance__payload-note {
    margin-bottom: 12px;
  }
</style>
