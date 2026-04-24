<template>
  <PageContainer>
    <PageHeader title="标签管理" description="资源标签的增删改查与按标签搜索。" />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="资源标签" name="resource">
          <ListPageQueryBar
            :filter-busy="false"
            :refresh-busy="loadingTags"
            @search="loadTags"
            @reset="
              () => {
                queryForm.resourceType = ''
                queryForm.resourceCode = ''
                tagRows.value = []
              }
            "
            @refresh="loadTags"
          >
            <template #prepend>
              <el-button
                type="primary"
                :icon="Plus"
                class="pretty-add-button"
                @click="openNewDialog"
              >
                新增标签
              </el-button>
            </template>
            <el-form-item label="资源类型">
              <el-select
                v-model="queryForm.resourceType"
                clearable
                placeholder="请选择"
                class="tag-query__type"
              >
                <el-option
                  v-for="opt in resourceTypeOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="资源编码">
              <el-input
                v-model="queryForm.resourceCode"
                clearable
                placeholder="必填"
                class="tag-query__code"
                @keyup.enter="loadTags"
              />
            </el-form-item>
          </ListPageQueryBar>

          <el-table
            v-loading="loadingTags"
            :data="tagRows"
            stripe
            border
            size="small"
            empty-text="暂无数据"
            class="console-table"
          >
            <el-table-column prop="tagKey" label="标签键" min-width="220" show-overflow-tooltip />
            <el-table-column label="标签值" min-width="260">
              <template #default="{ row }">
                <el-input
                  v-model="editValueByKey[String(row.tagKey)]"
                  clearable
                  placeholder="可选"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <div class="table-actions">
                  <el-button
                    size="small"
                    plain
                    type="primary"
                    :loading="savingKey === String(row.tagKey)"
                    @click="saveRow(row)"
                  >
                    保存
                  </el-button>
                  <el-button
                    size="small"
                    plain
                    type="danger"
                    :loading="deletingKey === String(row.tagKey)"
                    @click="confirmDeleteTag(row)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="按标签搜索" name="search">
          <ProTable
            :data="filteredSearchResults as unknown as Record<string, unknown>[]"
            :loading="searching"
            :total="filteredSearchResults.length"
            :show-pager="false"
            v-model:page="searchPage"
            v-model:page-size="searchPageSize"
            empty-text="暂无数据"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="searching"
                @search="doSearch"
                @reset="
                  () => {
                    searchForm.tagKey = ''
                    searchForm.tagValue = ''
                    searchFilters.resourceType = ''
                  }
                "
                @refresh="doSearch"
              >
                <el-form-item label="资源类型">
                  <el-select
                    v-model="searchFilters.resourceType"
                    clearable
                    placeholder="全部"
                    class="tag-search__type"
                  >
                    <el-option
                      v-for="opt in resourceTypeOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="标签键">
                  <el-input
                    v-model="searchForm.tagKey"
                    placeholder="必填，如 env / biz / owner"
                    class="tag-search__key"
                    @keyup.enter="doSearch"
                  />
                </el-form-item>
                <el-form-item label="标签值">
                  <el-input
                    v-model="searchForm.tagValue"
                    clearable
                    placeholder="可选，如 prod"
                    class="tag-search__value"
                    @keyup.enter="doSearch"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="resourceType" label="资源类型" width="140">
              <template #default="{ row }">
                <StatusTag
                  v-if="row.resourceType"
                  :value="String(row.resourceType)"
                  category="triggerResourceType"
                />
                <span v-else class="cell-empty">—</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="resourceCode"
              label="资源编码"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column prop="tagKey" label="标签键" min-width="160" show-overflow-tooltip />
            <el-table-column prop="tagValue" label="标签值" min-width="200" show-overflow-tooltip />
          </ProTable>

          <div class="tag-subsection">
            <div class="tag-subsection__title">已注册 Key</div>
            <ProTable
              :data="pagedKeys"
              :loading="loadingKeys"
              :total="filteredKeys.length"
              v-model:page="keyPage"
              v-model:page-size="keyPageSize"
              @change="() => {}"
            >
              <template #query>
                <ListPageQueryBar
                  :filter-busy="false"
                  :refresh-busy="loadingKeys"
                  @search="
                    () => {
                      keyPage = 1
                    }
                  "
                  @reset="
                    () => {
                      keyKeyword = ''
                      keyPage = 1
                    }
                  "
                  @refresh="loadKeys"
                >
                  <el-form-item label="关键字">
                    <el-input
                      class="query-w-260"
                      v-model="keyKeyword"
                      clearable
                      placeholder="搜索已注册 tagKey"
                      @keyup.enter="
                        () => {
                          keyPage = 1
                        }
                      "
                    />
                  </el-form-item>
                </ListPageQueryBar>
              </template>
              <el-table-column prop="key" label="标签键" min-width="300" />
            </ProTable>
          </div>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>

    <el-dialog v-model="newDialogVisible" title="新增标签" width="520px">
      <el-form label-width="84px" class="new-dialog-form">
        <el-form-item label="标签键" required>
          <el-input v-model="newTag.tagKey" placeholder="tagKey" />
        </el-form-item>
        <el-form-item label="标签值">
          <el-input v-model="newTag.tagValue" placeholder="tagValue（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="newDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="savingNew" @click="saveNewTag">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Plus } from '@element-plus/icons-vue'
  import {
    listResourceTags,
    upsertResourceTag,
    deleteResourceTag,
    searchByTag,
    listTagKeys,
  } from '@/api/tags'
  import type { ResourceType } from '@/api/tags'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import StatusTag from '@/components/common/StatusTag.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'

  const tenant = useTenantStore()
  const activeTab = ref<'resource' | 'search'>('resource')

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const resourceTypeOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'triggerResourceType'),
  )

  const loadingTags = ref(false)
  const searching = ref(false)
  const loadingKeys = ref(false)

  const queryForm = reactive({ resourceType: '' as string, resourceCode: '' })
  const searchForm = reactive({ tagKey: '', tagValue: '' })
  const searchFilters = reactive({ resourceType: '' as string })

  const editValueByKey = reactive<Record<string, string>>({})
  const savingKey = ref('')
  const deletingKey = ref('')
  const savingNew = ref(false)
  const newTag = reactive({ tagKey: '', tagValue: '' })
  const newDialogVisible = ref(false)

  const tagRows = ref<Record<string, unknown>[]>([])
  const searchResults = ref<Record<string, unknown>[]>([])
  const tagKeys = ref<unknown[]>([])
  const keyKeyword = ref('')

  const filteredSearchResults = computed(() => {
    let rows = searchResults.value
    const rt = searchFilters.resourceType.trim()
    if (rt) rows = rows.filter((x) => String(x.resourceType ?? '') === rt)
    return rows
  })

  const filteredKeys = computed(() => {
    const k = keyKeyword.value.trim().toLowerCase()
    const list = Array.isArray(tagKeys.value) ? tagKeys.value : []
    const keys = list.map((x) => {
      if (typeof x === 'string') return x
      if (x && typeof x === 'object' && 'key' in x)
        return String((x as Record<string, unknown>).key ?? '')
      return String(x ?? '')
    })
    return k ? keys.filter((x) => x.toLowerCase().includes(k)) : keys
  })

  const tagPage = ref(1)
  const tagPageSize = ref(20)
  const searchPage = ref(1)
  const searchPageSize = ref(20)
  const keyPage = ref(1)
  const keyPageSize = ref(20)

  const pagedKeys = computed(
    () =>
      toPageResult(
        filteredKeys.value.map((key) => ({ key })),
        keyPage.value,
        keyPageSize.value,
      ).records as unknown as Record<string, unknown>[],
  )

  async function loadTags() {
    if (!queryForm.resourceType || !queryForm.resourceCode.trim()) {
      ElMessage.warning('请输入资源类型和编码')
      return
    }
    loadingTags.value = true
    try {
      const data = await listResourceTags(
        tenant.tenantId,
        queryForm.resourceType as ResourceType,
        queryForm.resourceCode,
      )
      tagRows.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
      Object.keys(editValueByKey).forEach((k) => delete editValueByKey[k])
      tagRows.value.forEach((row) => {
        const tagKey = String((row as Record<string, unknown>).tagKey ?? '')
        editValueByKey[tagKey] = (row as Record<string, unknown>).tagValue
          ? String((row as Record<string, unknown>).tagValue)
          : ''
      })
    } catch {
      tagRows.value = []
    } finally {
      loadingTags.value = false
    }
  }

  async function upsertTag(tagKey: string, tagValue: string) {
    if (!queryForm.resourceType || !queryForm.resourceCode.trim()) {
      ElMessage.warning('请先在上方选择资源类型和编码')
      return
    }
    if (!tagKey.trim()) {
      ElMessage.warning('Tag Key 不能为空')
      return
    }
    try {
      await upsertResourceTag(tenant.tenantId, {
        resourceType: queryForm.resourceType as ResourceType,
        resourceCode: queryForm.resourceCode,
        tagKey,
        ...(tagValue ? { tagValue } : {}),
      })
      ElMessage.success('已保存')
      await loadTags()
    } catch {
      ElMessage.error('保存失败')
    } finally {
      // keep for vue compiler: try must have catch/finally
    }
  }

  async function saveRow(row: Record<string, unknown>) {
    const k = String(row.tagKey ?? '')
    savingKey.value = k
    try {
      await upsertTag(k, editValueByKey[k] ?? '')
    } finally {
      savingKey.value = ''
    }
  }

  async function saveNewTag() {
    if (!newTag.tagKey.trim()) {
      ElMessage.warning('Tag Key 不能为空')
      return
    }
    savingNew.value = true
    try {
      await upsertTag(newTag.tagKey.trim(), newTag.tagValue.trim())
      newTag.tagKey = ''
      newTag.tagValue = ''
      newDialogVisible.value = false
    } finally {
      savingNew.value = false
    }
  }

  function openNewDialog() {
    newTag.tagKey = ''
    newTag.tagValue = ''
    newDialogVisible.value = true
  }

  async function confirmDeleteTag(row: Record<string, unknown>) {
    deletingKey.value = String(row.tagKey ?? '')
    try {
      await ElMessageBox.confirm(`删除标签 "${row.tagKey}"？`, '删除确认', { type: 'warning' })
      await deleteResourceTag(
        tenant.tenantId,
        queryForm.resourceType,
        queryForm.resourceCode,
        String(row.tagKey),
      )
      ElMessage.success('已删除')
      await loadTags()
    } catch {
      /* cancel */
    } finally {
      deletingKey.value = ''
    }
  }

  async function doSearch() {
    if (!searchForm.tagKey.trim()) {
      ElMessage.warning('Tag Key 不能为空')
      return
    }
    searching.value = true
    try {
      const data = await searchByTag(
        tenant.tenantId,
        searchForm.tagKey,
        searchForm.tagValue || undefined,
      )
      searchResults.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }

  async function loadKeys() {
    loadingKeys.value = true
    try {
      const data = await listTagKeys(tenant.tenantId)
      tagKeys.value = Array.isArray(data) ? data : []
    } catch {
      tagKeys.value = []
    } finally {
      loadingKeys.value = false
    }
  }

  useTenantReload(() => {
    tagRows.value = []
    searchResults.value = []
    tagKeys.value = []
    void loadKeys()
  })
</script>

<style scoped>
  .tag-query__type {
    width: 160px;
  }

  .tag-query__code {
    width: 260px;
  }

  .tag-search__type {
    width: 160px;
  }

  .tag-search__key {
    width: 320px;
  }

  .tag-search__value {
    width: 260px;
  }

  @media (max-width: 900px) {
    .tag-search__key,
    .tag-search__value {
      width: min(320px, 100%);
    }

    .tag-query__code {
      width: min(320px, 100%);
    }
  }

  .tag-subsection {
    margin-top: var(--space-md);
  }

  .tag-subsection__title {
    font-size: 13px;
    font-weight: 650;
    color: var(--color-text-secondary);
    margin: var(--space-md) 0 var(--space-sm);
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .new-dialog-form {
    padding-top: 4px;
  }
</style>
