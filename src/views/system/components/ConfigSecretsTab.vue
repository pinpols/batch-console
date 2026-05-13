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
        <el-table-column prop="secretStatus" :label="t('configSecretsTab.colStatus')" width="100" />
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
              <el-button size="small" plain type="primary" @click="viewSecret(row)">
                {{ t('configSecretsTab.btnDetail') }}
              </el-button>
              <el-button
                size="small"
                plain
                type="warning"
                v-track-click="{
                  action: t('configSecretsTab.trackRotate'),
                  secretKey: row.secretRef,
                }"
                @click="confirmRotate(row)"
              >
                {{ t('configSecretsTab.btnRotate') }}
              </el-button>
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
          {{ secretDetail.secretStatus }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('configSecretsTab.fieldRaw')">
          <JsonPreview :data="secretDetail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { listSecrets, getSecretVersion, rotateSecret } from '@/api/configReleases'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import TablePagerBar from '@/components/table/TablePagerBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import DatetimeColumn from '@/components/common/DatetimeColumn.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'
  import DataState from '@/components/common/DataState.vue'
  import type { ConsoleSecretVersionResponse } from '@/types/console-api'

  const tenant = useTenantStore()
  const {
    loading: loadingSecrets,
    error: loadSecretsError,
    run: runLoadSecrets,
  } = useListLoadState()
  const { filterBusy, runSearch, runReset, runRefresh } = useListFilterFeedback(loadingSecrets)
  const secretDetailVisible = ref(false)
  const secretRows = ref<ConsoleSecretVersionResponse[]>([])
  const secretPage = ref(1)
  const secretPageSize = ref(20)
  const pagedSecrets = computed(() =>
    toPageResult(secretRows.value, secretPage.value, secretPageSize.value),
  )
  const secretDetail = ref<ConsoleSecretVersionResponse | null>(null)

  async function loadSecrets() {
    await runLoadSecrets(async () => {
      secretRows.value = await listSecrets(tenant.tenantId)
    }).catch(() => {
      secretRows.value = []
    })
  }

  async function viewSecret(row: ConsoleSecretVersionResponse) {
    secretDetail.value = (await getSecretVersion(
      row.id,
      tenant.tenantId,
    )) as ConsoleSecretVersionResponse
    secretDetailVisible.value = true
  }

  async function confirmRotate(row: ConsoleSecretVersionResponse) {
    try {
      await ElMessageBox.confirm(
        t('configSecretsTab.rotateConfirmText', { name: row.secretRef }),
        t('configSecretsTab.rotateConfirmTitle'),
        { type: 'warning' },
      )
      await rotateSecret({ tenantId: tenant.tenantId, secretRef: row.secretRef })
      ElMessage.success(t('configSecretsTab.rotateDoneToast'))
      await loadSecrets()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(() => {
    secretPage.value = 1
    void loadSecrets()
  })
</script>
