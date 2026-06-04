<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="load">
          {{ t('common.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <template #header>
        <div class="ctt__header">
          <span>{{ t('customTaskTypeList.sectionTitle') }}</span>
          <el-tag size="small" type="info" effect="plain">
            {{ t('customTaskTypeList.totalActive', { n: rows.length }) }}
          </el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="ctt__intro"
        :title="t('customTaskTypeList.introTitle')"
      >
        <template #default>
          {{ t('customTaskTypeList.introBody') }}
        </template>
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
          <EmptyState :description="t('customTaskTypeList.emptyDescription')" :image-size="80" />
        </template>

        <el-table-column prop="taskTypeCode" :label="t('customTaskTypeList.colCode')" min-width="200">
          <template #default="{ row }">
            <el-link type="primary" @click="openDetail(row)">{{ row.taskTypeCode }}</el-link>
          </template>
        </el-table-column>
        <el-table-column
          prop="displayName"
          :label="t('customTaskTypeList.colDisplayName')"
          min-width="160"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span v-if="row.displayName">{{ row.displayName }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('customTaskTypeList.colVersion')" width="140">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.descriptorVersion ?? '—' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source" :label="t('customTaskTypeList.colSource')" width="120">
          <template #default="{ row }">
            <span v-if="row.source">{{ row.source }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="declaredByWorkerCode"
          :label="t('customTaskTypeList.colWorker')"
          min-width="160"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span v-if="row.declaredByWorkerCode">{{ row.declaredByWorkerCode }}</span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column :label="t('customTaskTypeList.colStatus')" width="100">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.status === 'ACTIVE' ? 'success' : 'info'"
              effect="plain"
            >
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('customTaskTypeList.colLastDeclared')" width="170">
          <template #default="{ row }">{{ fmtDatetime(row.lastDeclaredAt) }}</template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer
      v-model="detailOpen"
      :title="
        detailRow
          ? t('customTaskTypeList.detailTitle', { code: detailRow.taskTypeCode })
          : t('customTaskTypeList.detailTitleFallback')
      "
      size="720px"
      direction="rtl"
    >
      <div v-if="detailRow" class="ctt-detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item :label="t('customTaskTypeList.colCode')">
            {{ detailRow.taskTypeCode }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('customTaskTypeList.colDisplayName')">
            {{ detailRow.displayName ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('customTaskTypeList.colVersion')">
            {{ detailRow.descriptorVersion ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('customTaskTypeList.colSource')">
            {{ detailRow.source ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('customTaskTypeList.colWorker')">
            {{ detailRow.declaredByWorkerCode ?? '—' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('customTaskTypeList.colStatus')">
            {{ detailRow.status }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('customTaskTypeList.fieldFirstDeclared')">
            {{ fmtDatetime(detailRow.firstDeclaredAt) }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('customTaskTypeList.colLastDeclared')">
            {{ fmtDatetime(detailRow.lastDeclaredAt) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">
          <span class="ctt-detail__divider">{{ t('customTaskTypeList.descriptorTitle') }}</span>
        </el-divider>

        <el-alert
          type="warning"
          :closable="false"
          show-icon
          class="ctt-detail__warn"
          :title="t('customTaskTypeList.descriptorSafetyTitle')"
        >
          <template #default>
            {{ t('customTaskTypeList.descriptorSafetyBody') }}
          </template>
        </el-alert>

        <SensitiveFieldAlert :value="parsedDescriptor ?? detailRow.descriptor" />

        <div v-if="parsedDescriptor">
          <JsonPreview :data="parsedDescriptor" />
        </div>
        <div v-else-if="detailRow.descriptor" class="ctt-detail__raw">
          <pre>{{ detailRow.descriptor }}</pre>
        </div>
        <EmptyState v-else :description="t('customTaskTypeList.descriptorEmpty')" :image-size="60" />
      </div>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Refresh } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import SensitiveFieldAlert from '@/components/common/SensitiveFieldAlert.vue'
  import { fmtDatetime } from '@/utils/datetime'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useTenantStore } from '@/stores/tenant'
  import {
    listCustomTaskTypes,
    parseDescriptor,
    type CustomTaskType,
  } from '@/api/customTaskTypes'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()

  const rows = ref<CustomTaskType[]>([])
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const page = ref(1)
  const pageSize = ref(15)

  const detailOpen = ref(false)
  const detailRow = ref<CustomTaskType | null>(null)
  const parsedDescriptor = computed(() => parseDescriptor(detailRow.value?.descriptor))

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      // 该端点 tenantId 是 @RequestParam(query 必填),interceptor 只注入 X-Tenant-Id header
      // 不够 → 必须显式带 query tenantId,否则 BE 400「租户参数缺失」。
      rows.value = (await listCustomTaskTypes(tenant.tenantId)) ?? []
    } catch (err) {
      loadError.value = err
      rows.value = []
      ElMessage.error(t('customTaskTypeList.loadError'))
    } finally {
      loading.value = false
    }
  }

  function openDetail(row: CustomTaskType) {
    detailRow.value = row
    detailOpen.value = true
  }

  useTenantReload(load)
</script>

<style scoped>
  .ctt__header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ctt__intro {
    margin-bottom: var(--space-md, 16px);
  }

  .muted {
    color: var(--color-text-tertiary);
  }

  .ctt-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-md, 16px);
  }

  .ctt-detail__divider {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .ctt-detail__warn {
    font-size: 12px;
  }

  .ctt-detail__raw pre {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
    font-size: 12px;
    padding: 12px;
    background: var(--color-bg-subtle, #f5f7fa);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content, 8px);
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
