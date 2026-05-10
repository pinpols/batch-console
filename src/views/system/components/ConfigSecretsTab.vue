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
        empty-text="暂无数据"
        size="small"
        class="console-table"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="secretRef" label="Secret Key" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <CopyableText :text="String(row.secretRef ?? '')" />
          </template>
        </el-table-column>
        <el-table-column prop="versionNo" label="版本" width="80" />
        <el-table-column prop="secretStatus" label="状态" width="100" />
        <DatetimeColumn prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="viewSecret(row)">详情</el-button>
              <el-button
                size="small"
                plain
                type="warning"
                v-track-click="{ action: '轮转 Secret', secretKey: row.secretRef }"
                @click="confirmRotate(row)"
                >轮转</el-button
              >
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

    <el-drawer v-model="secretDetailVisible" title="Secret 详情" size="560px">
      <el-descriptions v-if="secretDetail" :column="1" border size="small">
        <el-descriptions-item label="ID">{{ secretDetail.id }}</el-descriptions-item>
        <el-descriptions-item label="Secret Key">{{ secretDetail.secretRef }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ secretDetail.versionNo }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ secretDetail.secretStatus }}</el-descriptions-item>
        <el-descriptions-item label="原始响应">
          <JsonPreview :data="secretDetail" />
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
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
      await ElMessageBox.confirm(`轮转 Secret "${row.secretRef}"？`, '轮转确认', {
        type: 'warning',
      })
      await rotateSecret({ tenantId: tenant.tenantId, secretRef: row.secretRef })
      ElMessage.success('已发起轮转')
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
