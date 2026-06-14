<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button v-if="canManage" type="primary" :icon="Plus" @click="openCreate">
          {{ t('common.create') }}
        </el-button>
        <el-button :icon="Refresh" :loading="loading" @click="load">
          {{ t('common.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <template #header>
        <div class="scl__header">
          <span>{{ t('shardCatalogList.sectionTitle') }}</span>
          <el-tag size="small" type="info" effect="plain">
            {{ t('shardCatalogList.total', { n: rows.length }) }}
          </el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="scl__intro"
        :title="t('shardCatalogList.introTitle')"
      >
        <template #default>{{ t('shardCatalogList.introBody') }}</template>
      </el-alert>

      <ProTable
        :data="rows"
        :loading="loading"
        :total="rows.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :error="loadError"
        :on-retry="load"
      >
        <template #empty>
          <EmptyState :description="t('shardCatalogList.empty')" :image-size="80" />
        </template>

        <el-table-column prop="placementKey" :label="t('shardCatalogList.colKey')" min-width="160">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.placementKey }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('shardCatalogList.colEndpoint')" min-width="220">
          <template #default="{ row }">{{ row.host }}:{{ row.port }}/{{ row.dbName }}</template>
        </el-table-column>
        <el-table-column
          prop="secretRef"
          :label="t('shardCatalogList.colSecretRef')"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column :label="t('shardCatalogList.colPool')" width="100">
          <template #default="{ row }">{{ row.poolMaxSize ?? '—' }}</template>
        </el-table-column>
        <el-table-column :label="t('shardCatalogList.colEnabled')" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.enabled ? 'success' : 'info'" effect="plain">
              {{ row.enabled ? t('common.enabled') : t('common.disabled') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.updatedAt')" width="170">
          <template #default="{ row }">{{ fmtDatetime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column
          v-if="canManage"
          :label="t('common.actions')"
          width="140"
          fixed="right"
        >
          <template #default="{ row }">
            <RowActions :actions="rowActions(row)" />
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer
      v-model="dialogVisible"
      :title="editing ? t('shardCatalogList.editTitle') : t('shardCatalogList.createTitle')"
      direction="rtl"
      size="560px"
      destroy-on-close
    >
      <el-form :model="form" label-width="120px">
        <el-form-item :label="t('shardCatalogList.colKey')" required>
          <el-input
            v-model="form.placementKey"
            :disabled="editing"
            maxlength="64"
            :placeholder="t('shardCatalogList.keyPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('shardCatalogList.fieldHost')" required>
          <el-input v-model="form.host" maxlength="255" />
        </el-form-item>
        <el-form-item :label="t('shardCatalogList.fieldPort')" required>
          <el-input-number v-model="form.port" :min="1" :max="65535" />
        </el-form-item>
        <el-form-item :label="t('shardCatalogList.fieldDbName')" required>
          <el-input v-model="form.dbName" maxlength="128" />
        </el-form-item>
        <el-form-item :label="t('shardCatalogList.colSecretRef')" required>
          <el-input
            v-model="form.secretRef"
            maxlength="255"
            :placeholder="t('shardCatalogList.secretRefPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('shardCatalogList.colPool')">
          <el-input-number v-model="form.poolMaxSize" :min="1" :max="1000" />
        </el-form-item>
        <el-form-item :label="t('shardCatalogList.colEnabled')">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item :label="t('shardCatalogList.fieldDescription')">
          <el-input v-model="form.description" type="textarea" maxlength="512" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ t('common.save') }}</el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh, Plus } from '@element-plus/icons-vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useAuthStore } from '@/stores/auth'
  import {
    listShardCatalog,
    upsertShardCatalog,
    deleteShardCatalog,
    type ShardCatalogRow,
    type ShardCatalogSavePayload,
  } from '@/api/opsManagement'

  const { t } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const canManage = computed(() => auth.hasPermission('ROLE_ADMIN'))

  const rows = ref<ShardCatalogRow[]>([])
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const page = ref(1)
  const pageSize = ref(15)

  const dialogVisible = ref(false)
  const editing = ref(false)
  const saving = ref(false)
  const form = reactive<ShardCatalogSavePayload>({
    placementKey: '',
    host: '',
    port: 5432,
    dbName: '',
    secretRef: '',
    poolMaxSize: undefined,
    enabled: true,
    description: '',
  })

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      rows.value = (await listShardCatalog()) ?? []
    } catch (err) {
      loadError.value = err
      rows.value = []
      ElMessage.error(t('shardCatalogList.loadError'))
    } finally {
      loading.value = false
    }
  }

  function openCreate() {
    editing.value = false
    Object.assign(form, {
      placementKey: '',
      host: '',
      port: 5432,
      dbName: '',
      secretRef: '',
      poolMaxSize: undefined,
      enabled: true,
      description: '',
    })
    dialogVisible.value = true
  }

  function openEdit(row: ShardCatalogRow) {
    editing.value = true
    Object.assign(form, {
      placementKey: row.placementKey,
      host: row.host,
      port: row.port,
      dbName: row.dbName,
      secretRef: row.secretRef,
      poolMaxSize: row.poolMaxSize ?? undefined,
      enabled: row.enabled,
      description: row.description ?? '',
    })
    dialogVisible.value = true
  }

  async function save() {
    saving.value = true
    try {
      await upsertShardCatalog({ ...form })
      ElMessage.success(t('shardCatalogList.saveSuccess'))
      dialogVisible.value = false
      await load()
    } catch {
      // 错误 toast 由拦截器统一弹,这里不重复
    } finally {
      saving.value = false
    }
  }

  async function confirmDelete(row: ShardCatalogRow) {
    try {
      await ElMessageBox.confirm(
        t('shardCatalogList.deleteConfirm', { key: row.placementKey }),
        t('shardCatalogList.deleteTitle'),
        { type: 'warning', confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel') },
      )
    } catch {
      return // 用户取消
    }
    try {
      await deleteShardCatalog(row.placementKey)
      ElMessage.success(t('shardCatalogList.deleteSuccess'))
      await load()
    } catch {
      // 拦截器弹错
    }
  }

  function rowActions(row: ShardCatalogRow): RowAction[] {
    return [
      { key: 'edit', label: t('common.edit'), primary: true, onClick: () => openEdit(row) },
      { key: 'delete', label: t('common.delete'), danger: true, onClick: () => confirmDelete(row) },
    ]
  }

  load()
</script>

<style scoped>
  .scl__header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .scl__intro {
    margin-bottom: var(--space-md, 16px);
  }
</style>
