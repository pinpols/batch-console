<template>
  <PageContainer>
    <PageHeader title="标签管理" description="资源标签的增删改查与按标签搜索。" />

    <SectionCard>
      <el-tabs v-model="activeTab" v-hover-tab-activate="true" class="pill-tabs">
        <el-tab-pane label="标签查询" name="query">
          <ProTable
            :data="tagRows as unknown as Record<string, unknown>[]"
            :loading="loadingTags"
            :total="tagRows.length"
            :show-pager="false"
            v-model:page="tagPage"
            v-model:page-size="tagPageSize"
            empty-text="暂无数据"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="loadingTags"
                @search="loadTags"
                @reset="
                  () => {
                    queryForm.resourceType = ''
                    queryForm.resourceCode = ''
                  }
                "
                @refresh="loadTags"
              >
                <el-form-item label="资源类型">
                  <el-select
                    v-model="queryForm.resourceType"
                    clearable
                    placeholder="全部"
                    style="width: 160px"
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
                    placeholder="资源编码"
                    style="width: 180px"
                    @keyup.enter="loadTags"
                  />
                </el-form-item>
              </ListPageQueryBar>
            </template>
            <el-table-column prop="tagKey" label="标签键" min-width="180" show-overflow-tooltip />
            <el-table-column prop="tagValue" label="标签值" min-width="250" show-overflow-tooltip />
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button
                  size="small"
                  plain
                  type="danger"
                  v-track-click="{ action: '删除标签', tagKey: row.tagKey }"
                  @click="confirmDeleteTag(row)"
                  >删除</el-button
                >
              </template>
            </el-table-column>
          </ProTable>

          <div class="section-divider">
            <h4 class="section-divider__title">新增 / 更新标签</h4>
            <el-form :inline="true" class="query-form">
              <el-form-item label="标签键">
                <el-input v-model="upsertForm.tagKey" placeholder="tagKey" style="width: 160px" />
              </el-form-item>
              <el-form-item label="标签值">
                <el-input
                  v-model="upsertForm.tagValue"
                  placeholder="tagValue（可选）"
                  style="width: 200px"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="savingTag" @click="upsertTag">保存</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="按标签搜索" name="search">
          <ProTable
            :data="searchResults as unknown as Record<string, unknown>[]"
            :loading="searching"
            :total="searchResults.length"
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
                  }
                "
                @refresh="doSearch"
              >
                <el-form-item label="标签键">
                  <el-input
                    v-model="searchForm.tagKey"
                    placeholder="tagKey"
                    style="width: 160px"
                    @keyup.enter="doSearch"
                  />
                </el-form-item>
                <el-form-item label="标签值">
                  <el-input
                    v-model="searchForm.tagValue"
                    clearable
                    placeholder="可选"
                    style="width: 200px"
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
        </el-tab-pane>

        <el-tab-pane label="已注册 Key" name="keys">
          <ProTable
            :data="pagedKeys"
            :loading="loadingKeys"
            :total="tagKeys.length"
            v-model:page="keyPage"
            v-model:page-size="keyPageSize"
            @change="() => {}"
          >
            <template #query>
              <ListPageQueryBar
                :filter-busy="false"
                :refresh-busy="loadingKeys"
                @search="() => {}"
                @reset="() => {}"
                @refresh="loadKeys"
              />
            </template>
            <el-table-column prop="key" label="标签键" min-width="300">
              <template #default="{ row }">{{
                typeof row === 'string' ? row : (row.key ?? row)
              }}</template>
            </el-table-column>
          </ProTable>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
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
  const activeTab = ref('query')

  const { data: metaEnums } = useConsoleMetaEnumsQuery()

  const resourceTypeOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'triggerResourceType'),
  )

  const loadingTags = ref(false)
  const savingTag = ref(false)
  const searching = ref(false)
  const loadingKeys = ref(false)

  const queryForm = reactive({ resourceType: '' as string, resourceCode: '' })
  const upsertForm = reactive({ tagKey: '', tagValue: '' })
  const searchForm = reactive({ tagKey: '', tagValue: '' })

  const tagRows = ref<Record<string, unknown>[]>([])
  const searchResults = ref<Record<string, unknown>[]>([])
  const tagKeys = ref<unknown[]>([])

  const tagPage = ref(1)
  const tagPageSize = ref(20)
  const searchPage = ref(1)
  const searchPageSize = ref(20)
  const keyPage = ref(1)
  const keyPageSize = ref(20)

  const pagedKeys = computed(
    () =>
      toPageResult(tagKeys.value, keyPage.value, keyPageSize.value).records as unknown as Record<
        string,
        unknown
      >[],
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
    } catch {
      tagRows.value = []
    } finally {
      loadingTags.value = false
    }
  }

  async function upsertTag() {
    if (!queryForm.resourceType || !queryForm.resourceCode.trim()) {
      ElMessage.warning('请先在上方选择资源类型和编码')
      return
    }
    if (!upsertForm.tagKey.trim()) {
      ElMessage.warning('Tag Key 不能为空')
      return
    }
    savingTag.value = true
    try {
      await upsertResourceTag(tenant.tenantId, {
        resourceType: queryForm.resourceType as ResourceType,
        resourceCode: queryForm.resourceCode,
        tagKey: upsertForm.tagKey,
        ...(upsertForm.tagValue ? { tagValue: upsertForm.tagValue } : {}),
      })
      ElMessage.success('已保存')
      upsertForm.tagKey = ''
      upsertForm.tagValue = ''
      await loadTags()
    } finally {
      savingTag.value = false
    }
  }

  async function confirmDeleteTag(row: Record<string, unknown>) {
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

<style scoped></style>
