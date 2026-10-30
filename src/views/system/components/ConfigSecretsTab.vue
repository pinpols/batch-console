<template>
  <div>
    <ListPageQueryBar
      :filter-busy="filterBusy"
      :refresh-busy="loadingSecrets"
      :disabled="loadingSecrets"
      @refresh="() => runRefresh(loadSecrets)"
      @search="() => runSearch(loadSecrets)"
      @reset="() => runReset(loadSecrets)"
    />
    <DataState
      :loading="loadingSecrets"
      :error="loadSecretsError"
      :has-data="pagedSecrets.records.length > 0"
      :on-retry="loadSecrets"
    >
      <el-table
        v-loading="loadingSecrets"
        :data="pagedSecrets.records"
        stripe
        border
        :empty-text="t('common.noData')"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" :label="t('configSecretsTab.fieldId')" width="80" />
        <el-table-column
          :label="t('configSecretsTab.colSecret')"
          min-width="240"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div class="cell-stack">
              <CopyableText :text="String(row.secretRef ?? '')" />
              <span v-if="row.secretName" class="cell-sub">{{ row.secretName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="versionNo"
          :label="t('configSecretsTab.colVersion')"
          width="80"
          align="right"
        />
        <el-table-column :label="t('configSecretsTab.colCurrent')" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.currentVersion" type="success" size="small" effect="plain">
              {{ t('configSecretsTab.tagCurrent') }}
            </el-tag>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('configSecretsTab.colStatus')" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.revokedAt" type="danger" size="small" effect="plain">
              {{ t('configSecretsTab.tagRevoked') }}
            </el-tag>
            <span v-else>{{ row.secretStatus }}</span>
          </template>
        </el-table-column>
        <DatetimeColumn
          prop="effectiveFromAt"
          :label="t('configSecretsTab.colEffectiveFrom')"
          width="160"
        />
        <DatetimeColumn
          prop="effectiveToAt"
          :label="t('configSecretsTab.colEffectiveTo')"
          width="160"
        />
        <DatetimeColumn
          prop="rotationWindowStartAt"
          :label="t('configSecretsTab.colRotationStart')"
          width="160"
        />
        <DatetimeColumn
          prop="rotationWindowEndAt"
          :label="t('configSecretsTab.colRotationEnd')"
          width="160"
        />
        <el-table-column
          prop="rotationReason"
          :label="t('configSecretsTab.colRotationReason')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="createdBy"
          :label="t('configSecretsTab.colCreatedBy')"
          width="120"
          show-overflow-tooltip
        />
        <DatetimeColumn prop="createdAt" :label="t('configSecretsTab.colCreatedAt')" width="160" />
        <el-table-column :label="t('configSecretsTab.colActions')" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <RowActions
                :actions="secretRowActions(row as ConsoleSecretVersionResponse)"
                :inline-limit="1"
              />
            </div>
          </template>
        </el-table-column>
      </el-table>
    </DataState>
    <TablePagerBar
      :page="secretPage"
      :page-size="secretPageSize"
      :total="pagedSecrets.total"
      @update:page="(p: number) => (secretPage = p)"
      @update:page-size="
        (s: number) => {
          secretPageSize = s
          secretPage = 1
        }
      "
    />

    <el-drawer
      :append-to-body="true"
      v-model="secretDetailVisible"
      :title="t('configSecretsTab.drawerTitle')"
      size="640px"
    >
      <el-descriptions v-if="secretDetail" :column="1" border size="small">
        <el-descriptions-item :label="t('configSecretsTab.fieldId')">
          {{ secretDetail.id }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('configSecretsTab.fieldSecretKey')">
          {{ secretDetail.secretRef }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('configSecretsTab.fieldVersion')">
          {{ secretDetail.versionNo }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('configSecretsTab.fieldStatus')">
          <el-tag v-if="secretDetail.revokedAt" type="danger" size="small" effect="plain">
            {{ t('configSecretsTab.tagRevoked') }}
          </el-tag>
          <span v-else>{{ secretDetail.secretStatus }}</span>
        </el-descriptions-item>
        <el-descriptions-item
          v-if="secretDetail.revokedAt"
          :label="t('configSecretsTab.fieldRevokedAt')"
        >
          {{ secretDetail.revokedAt }}
        </el-descriptions-item>
        <el-descriptions-item
          v-if="secretDetail.revokedAt"
          :label="t('configSecretsTab.fieldRevokeReason')"
        >
          {{ secretDetail.revokeReason || '—' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('configSecretsTab.fieldRaw')">
          <JsonPreview :data="secretDetail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import {
    listSecrets,
    getSecretVersion,
    rotateSecret,
    revokeSecretVersion,
  } from '@/api/configReleases'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantRequestScope } from '@/composables/useTenantRequestScope'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import type { ConsoleSecretVersionResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const auth = useAuthStore()
  const {
    loading: loadingSecrets,
    error: loadSecretsError,
    run: runLoadSecrets,
  } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingSecrets)
  const secretDetailVisible = ref(false)
  const secretRows = ref<ConsoleSecretVersionResponse[]>([])
  const secretPage = ref(1)
  const secretPageSize = ref(15)
  const pagedSecrets = computed(() =>
    toPageResult(secretRows.value, secretPage.value, secretPageSize.value),
  )
  const secretDetail = ref<ConsoleSecretVersionResponse | null>(null)

  const listScope = useTenantRequestScope()
  const detailScope = useTenantRequestScope()
  const actionScope = useTenantRequestScope()
  async function loadSecrets() {
    const request = listScope.begin()
    if (!request.tenantId) return
    await runLoadSecrets(
      async () => {
        const data = await listSecrets(request.tenantId)
        if (listScope.isCurrent(request)) secretRows.value = data
      },
      () => listScope.isCurrent(request),
    ).catch(() => {
      if (!listScope.isCurrent(request)) return
      secretRows.value = []
    })
  }

  async function viewSecret(row: ConsoleSecretVersionResponse) {
    const request = detailScope.begin()
    if (!request.tenantId || (row.tenantId && row.tenantId !== request.tenantId)) return
    const data = await getSecretVersion(row.id, request.tenantId)
    if (!detailScope.isCurrent(request)) return
    secretDetail.value = data as ConsoleSecretVersionResponse
    secretDetailVisible.value = true
  }

  function secretRowActions(row: ConsoleSecretVersionResponse): RowAction[] {
    const actions: RowAction[] = [
      {
        key: 'detail',
        label: t('configSecretsTab.btnDetail'),
        primary: true,
        onClick: () => viewSecret(row),
      },
    ]
    if (auth.hasPermission('ROLE_ADMIN')) {
      actions.push({
        key: 'rotate',
        label: t('configSecretsTab.btnRotate'),
        warning: true,
        divided: true,
        track: { action: t('configSecretsTab.trackRotate'), secretKey: row.secretRef },
        onClick: () => confirmRotate(row),
      })
      if (row.secretStatus !== 'DRAFT' && !row.revokedAt) {
        actions.push({
          key: 'revoke',
          label: t('configSecretsTab.btnRevoke'),
          danger: true,
          divided: true,
          track: { action: t('configSecretsTab.trackRevoke'), secretKey: row.secretRef },
          onClick: () => confirmRevoke(row),
        })
      }
    }
    return actions
  }

  async function confirmRevoke(row: ConsoleSecretVersionResponse) {
    const request = actionScope.begin()
    if (!request.tenantId || (row.tenantId && row.tenantId !== request.tenantId)) return
    try {
      await confirmDanger({
        verb: t('configSecretsTab.revokeConfirmTitle'),
        target: t('configSecretsTab.revokeTarget', {
          name: row.secretRef,
          version: row.versionNo,
        }),
        consequence: t('configSecretsTab.revokeConfirmText'),
        irreversible: true,
      })
      if (!actionScope.isCurrent(request)) return
      const { value: reason } = await ElMessageBox.prompt(
        t('configSecretsTab.revokeReasonPrompt'),
        t('configSecretsTab.revokeReasonTitle'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputType: 'textarea',
          inputValidator: (value) => {
            const normalized = value?.trim() ?? ''
            if (!normalized) return t('configSecretsTab.revokeReasonRequired')
            if (normalized.length > 512) return t('configSecretsTab.revokeReasonTooLong')
            return true
          },
        },
      )
      if (!actionScope.isCurrent(request)) return
      await revokeSecretVersion(row.id, { tenantId: request.tenantId, reason: reason.trim() })
      if (!actionScope.isCurrent(request)) return
      ElMessage.success(t('configSecretsTab.revokeDoneToast'))
      await loadSecrets()
    } catch {
      /* cancel */
    }
  }

  async function confirmRotate(row: ConsoleSecretVersionResponse) {
    const request = actionScope.begin()
    if (!request.tenantId || (row.tenantId && row.tenantId !== request.tenantId)) return
    try {
      await confirmDanger({
        verb: t('configSecretsTab.rotateConfirmTitle'),
        target: '',
        consequence: t('configSecretsTab.rotateConfirmText', { name: row.secretRef }),
      })
      if (!actionScope.isCurrent(request)) return
      const { value: secretPayloadJson } = await ElMessageBox.prompt(
        t('configSecretsTab.rotatePayloadPrompt'),
        t('configSecretsTab.rotatePayloadTitle'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputType: 'textarea',
          inputValidator: (value) => {
            if (!value?.trim()) return t('configSecretsTab.rotatePayloadRequired')
            try {
              JSON.parse(value)
              return true
            } catch {
              return t('configSecretsTab.rotatePayloadInvalid')
            }
          },
        },
      )
      if (!actionScope.isCurrent(request)) return
      await rotateSecret({
        tenantId: request.tenantId,
        secretRef: row.secretRef,
        secretName: row.secretName,
        secretPayloadJson,
      })
      if (!actionScope.isCurrent(request)) return
      ElMessage.success(t('configSecretsTab.rotateDoneToast'))
      await loadSecrets()
    } catch {
      /* cancel */
    }
  }

  watch(
    () => tenant.tenantId,
    () => {
      secretRows.value = []
      secretDetail.value = null
      secretDetailVisible.value = false
      loadingSecrets.value = false
      loadSecretsError.value = null
    },
    { flush: 'sync' },
  )
  useTenantReload(() => {
    secretPage.value = 1
    void loadSecrets()
  })
</script>
