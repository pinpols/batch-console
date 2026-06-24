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
        <div class="tpl__header">
          <span>{{ t('tenantPlacementList.sectionTitle') }}</span>
          <el-tag size="small" type="info" effect="plain">
            {{ t('tenantPlacementList.total', { n: rows.length }) }}
          </el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="tpl__intro"
        :title="t('tenantPlacementList.introTitle')"
      >
        <template #default>{{ t('tenantPlacementList.introBody') }}</template>
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
          <EmptyState :description="t('tenantPlacementList.empty')" :image-size="80" />
        </template>

        <el-table-column
          prop="tenantId"
          :label="t('tenantPlacementList.colTenant')"
          min-width="180"
        />
        <el-table-column :label="t('tenantPlacementList.colPlacement')" min-width="160">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.placementKey }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.updatedAt')" width="170">
          <template #default="{ row }">{{ fmtDatetime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column prop="updatedBy" :label="t('tenantPlacementList.colUpdatedBy')" width="140">
          <template #default="{ row }">{{ row.updatedBy ?? '—' }}</template>
        </el-table-column>
        <el-table-column
          v-if="canManage"
          :label="t('common.actions')"
          width="160"
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
      :title="editing ? t('tenantPlacementList.editTitle') : t('tenantPlacementList.createTitle')"
      direction="rtl"
      size="520px"
      destroy-on-close
    >
      <el-form :model="form" label-width="120px">
        <el-form-item :label="t('tenantPlacementList.colTenant')" required>
          <el-input
            v-model="form.tenantId"
            :disabled="editing"
            maxlength="64"
            :placeholder="t('tenantPlacementList.tenantPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('tenantPlacementList.colPlacement')" required>
          <el-select
            v-model="form.placementKey"
            filterable
            allow-create
            default-first-option
            class="tpl__select"
            :placeholder="t('tenantPlacementList.placementPlaceholder')"
          >
            <el-option
              v-for="key in placementKeyOptions"
              :key="key"
              :label="key"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="placementKeyInvalid">
          <el-text type="danger" size="small">{{ t('tenantPlacementList.keyPatternError') }}</el-text>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" :disabled="placementKeyInvalid" @click="save">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh, Plus } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import RowActions, { type RowAction } from '@/components/common/RowActions.vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useAuthStore } from '@/stores/auth'
  import {
    listTenantPlacements,
    upsertTenantPlacement,
    deleteTenantPlacement,
    listShardCatalog,
    PLACEMENT_KEY_PATTERN,
    type TenantPlacementRow,
    type TenantPlacementSavePayload,
  } from '@/api/opsManagement'

  const { t } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const canManage = computed(() => auth.hasPermission('ROLE_ADMIN'))

  const rows = ref<TenantPlacementRow[]>([])
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const page = ref(1)
  const pageSize = ref(15)
  const placementKeyOptions = ref<string[]>([])

  const dialogVisible = ref(false)
  const editing = ref(false)
  const saving = ref(false)
  const form = reactive<TenantPlacementSavePayload>({ tenantId: '', placementKey: '' })

  const placementKeyInvalid = computed(
    () => !!form.placementKey && !PLACEMENT_KEY_PATTERN.test(form.placementKey),
  )

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      rows.value = (await listTenantPlacements()) ?? []
    } catch (err) {
      loadError.value = err
      rows.value = []
      ElMessage.error(t('tenantPlacementList.loadError'))
    } finally {
      loading.value = false
    }
  }

  async function loadPlacementOptions() {
    try {
      const catalog = (await listShardCatalog()) ?? []
      placementKeyOptions.value = catalog.filter((c) => c.enabled).map((c) => c.placementKey)
    } catch {
      placementKeyOptions.value = [] // 目录拉不到时退化为自由输入
    }
  }

  function openCreate() {
    editing.value = false
    form.tenantId = ''
    form.placementKey = ''
    void loadPlacementOptions()
    dialogVisible.value = true
  }

  function openEdit(row: TenantPlacementRow) {
    editing.value = true
    form.tenantId = row.tenantId
    form.placementKey = row.placementKey
    void loadPlacementOptions()
    dialogVisible.value = true
  }

  async function save() {
    if (placementKeyInvalid.value) return
    saving.value = true
    try {
      await upsertTenantPlacement({ ...form })
      ElMessage.success(t('tenantPlacementList.saveSuccess'))
      dialogVisible.value = false
      await load()
    } catch {
      // 拦截器弹错
    } finally {
      saving.value = false
    }
  }

  async function confirmDelete(row: TenantPlacementRow) {
    try {
      await confirmDanger({
        verb: t('tenantPlacementList.actionUnassign'),
        target: String(row.tenantId ?? ''),
        consequence: t('tenantPlacementList.deleteConfirm', { tenant: row.tenantId }),
      })
    } catch {
      return
    }
    try {
      await deleteTenantPlacement(row.tenantId)
      ElMessage.success(t('tenantPlacementList.deleteSuccess'))
      await load()
    } catch {
      // 拦截器弹错
    }
  }

  function rowActions(row: TenantPlacementRow): RowAction[] {
    return [
      { key: 'edit', label: t('tenantPlacementList.actionReassign'), primary: true, onClick: () => openEdit(row) },
      { key: 'delete', label: t('tenantPlacementList.actionUnassign'), danger: true, onClick: () => confirmDelete(row) },
    ]
  }

  load()
</script>

<style scoped>
  .tpl__header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tpl__intro {
    margin-bottom: var(--space-md, 16px);
  }

  .tpl__select {
    width: 100%;
  }
</style>
