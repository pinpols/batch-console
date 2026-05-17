<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button type="primary" :icon="Plus" class="pretty-add-button" @click="openCreate">
          {{ t('systemParameterList.headerCreate') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <ProTable
        :data="pagedRows"
        :loading="tableBlocking"
        :total="filtered.length"
        v-model:page="page"
        v-model:page-size="pageSize"
        :has-active-filters="!!keyword"
        @change="slicePage"
        :error="loadError"
        :on-retry="load"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="filterBusy"
            :refresh-busy="loading"
            @search="onSearch"
            @reset="onReset"
            @refresh="() => runRefresh(load)"
          >
            <el-form-item :label="t('systemParameterList.keywordLabel')">
              <el-input
                class="query-w-200"
                v-model="kwDraft"
                clearable
                :placeholder="t('systemParameterList.keywordPlaceholder')"
                @keyup.enter="onSearch"
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column
          prop="key"
          :label="t('systemParameterList.colKey')"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <CopyableText v-if="row.key" :text="row.key" />
            <span v-else class="cell-empty">—</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="value"
          :label="t('systemParameterList.colValue')"
          min-width="300"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.value || '—' }}
          </template>
        </el-table-column>
        <el-table-column :label="t('systemParameterList.colActions')" width="160" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" plain type="primary" @click="openEdit(row)">
                {{ t('systemParameterList.actionEdit') }}
              </el-button>
              <el-button size="small" plain type="danger" @click="confirmDelete(row)">
                {{ t('systemParameterList.actionDelete') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </ProTable>
    </SectionCard>

    <el-drawer
      :append-to-body="true"
      v-model="dialogVisible"
      :title="
        editingKey
          ? t('systemParameterList.dialogEditTitle')
          : t('systemParameterList.dialogCreateTitle')
      "
      direction="rtl"
      size="480px"
    >
      <el-form ref="paramFormRef" :model="form" :rules="formRules" label-width="88px">
        <el-form-item :label="t('systemParameterList.fieldKey')" prop="key">
          <el-input
            v-model="form.key"
            :disabled="!!editingKey"
            :placeholder="t('systemParameterList.fieldKeyPlaceholder')"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item :label="t('systemParameterList.fieldValue')" prop="value">
          <el-input
            v-model="form.value"
            type="textarea"
            :rows="3"
            :placeholder="t('systemParameterList.fieldValuePlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="saving" @click="save">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import type { FormRules } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import { useFormValidate, rules } from '@/composables/useFormValidate'
  import {
    listSystemParameters,
    upsertSystemParameter,
    deleteSystemParameter,
  } from '@/api/systemParameters'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'

  const tenant = useTenantStore()
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const { filterBusy, tableBlocking, runSearch, runReset, runRefresh } =
    useListFilterFeedback(loading)
  const saving = ref(false)
  const dialogVisible = ref(false)
  const editingKey = ref('')
  const allRows = ref<{ key: string; value: string }[]>([])
  const form = reactive({ key: '', value: '' })

  const { formRef: paramFormRef, validate: validateParamForm } = useFormValidate()
  const formRules: FormRules = {
    key: [
      rules.required(t('systemParameterList.keyRequired')),
      rules.pattern(/^[a-zA-Z0-9._-]+$/, t('systemParameterList.keyPattern')),
      rules.maxLength(128),
    ],
  }
  const page = ref(1)
  const pageSize = ref(20)
  const kwDraft = ref('')
  const keyword = ref('')

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase()
    if (!k) return allRows.value
    return allRows.value.filter((r) => r.key.toLowerCase().includes(k))
  })

  const pagedRows = computed(() => {
    const pr = toPageResult(filtered.value, page.value, pageSize.value)
    return pr.records
  })

  function slicePage() {}
  function onSearch() {
    return runSearch(() => {
      keyword.value = kwDraft.value
      page.value = 1
    })
  }
  function onReset() {
    return runReset(() => {
      kwDraft.value = ''
      keyword.value = ''
      page.value = 1
    })
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const data = await listSystemParameters(tenant.tenantId)
      allRows.value = Array.isArray(data)
        ? // BE 返 List<SystemParameterEntity> {paramKey, paramValue, ...},翻译到本地 {key, value}
          (data as Array<Record<string, unknown>>).map((r) => ({
            key: String(r.paramKey ?? r.key ?? ''),
            value: String(r.paramValue ?? r.value ?? ''),
          }))
        : Object.entries(data as Record<string, string>).map(([key, value]) => ({
            key,
            value: String(value),
          }))
    } catch (err) {
      loadError.value = err
      allRows.value = []
    } finally {
      loading.value = false
    }
  }

  function openCreate() {
    editingKey.value = ''
    form.key = ''
    form.value = ''
    dialogVisible.value = true
  }

  function openEdit(row: { key: string; value: string }) {
    editingKey.value = row.key
    form.key = row.key
    form.value = row.value
    dialogVisible.value = true
  }

  async function save() {
    if (!(await validateParamForm())) return
    saving.value = true
    try {
      await upsertSystemParameter(tenant.tenantId, { key: form.key, value: form.value })
      ElMessage.success(t('systemParameterList.saveSuccess'))
      dialogVisible.value = false
      await load()
    } finally {
      saving.value = false
    }
  }

  async function confirmDelete(row: { key: string }) {
    try {
      await confirmDanger({
        verb: t('systemParameterList.deleteVerb'),
        target: t('systemParameterList.deleteTarget', { key: row.key }),
        consequence: t('systemParameterList.deleteConsequence'),
        irreversible: true,
      })
      await deleteSystemParameter(tenant.tenantId, row.key)
      ElMessage.success(t('systemParameterList.deleteSuccess'))
      await load()
    } catch {
      /* cancel */
    }
  }

  useTenantReload(load)
</script>

<style scoped></style>
