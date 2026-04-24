<template>
  <div>
    <ProTable
      :data="filteredSearchResults"
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
      <el-table-column prop="resourceCode" label="资源编码" min-width="200" show-overflow-tooltip />
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
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { ElMessage } from 'element-plus'
  import { searchByTag, listTagKeys } from '@/api/tags'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import StatusTag from '@/components/common/StatusTag.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const resourceTypeOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'triggerResourceType'),
  )

  const searching = ref(false)
  const loadingKeys = ref(false)

  const searchForm = reactive({ tagKey: '', tagValue: '' })
  const searchFilters = reactive({ resourceType: '' as string })

  const searchResults = ref<Record<string, unknown>[]>([])
  const tagKeys = ref<unknown[]>([])
  const keyKeyword = ref('')

  const searchPage = ref(1)
  const searchPageSize = ref(20)
  const keyPage = ref(1)
  const keyPageSize = ref(20)

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

  const pagedKeys = computed(
    () =>
      toPageResult(
        filteredKeys.value.map((key) => ({ key })),
        keyPage.value,
        keyPageSize.value,
      ).records,
  )

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
    searchResults.value = []
    tagKeys.value = []
    void loadKeys()
  })
</script>

<style scoped>
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
</style>
