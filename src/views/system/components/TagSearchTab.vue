<template>
  <div>
    <ProTable
      :data="filteredSearchResults"
      :loading="searching"
      :error="searchError"
      :on-retry="doSearch"
      :total="filteredSearchResults.length"
      :show-pager="false"
      v-model:page="searchPage"
      v-model:page-size="searchPageSize"
    >
      <template #query>
        <ListPageQueryBar
          :filter-busy="searchFilterBusy"
          :refresh-busy="searching"
          @search="() => runTagSearch(doSearch)"
          @reset="
            () =>
              runTagSearchReset(() => {
                searchForm.tagKey = ''
                searchForm.tagValue = ''
                searchFilters.resourceType = ''
              })
          "
          @refresh="() => runTagSearchRefresh(doSearch)"
        >
          <el-form-item :label="t('tagSearchTab.resourceTypeLabel')">
            <MetaSelect
              v-model="searchFilters.resourceType"
              clearable
              :placeholder="t('tagSearchTab.resourceTypePlaceholder')"
              class="tag-search__type"
              :options="resourceTypeOptions"
            />
          </el-form-item>
          <el-form-item :label="t('tagSearchTab.tagKeyLabel')">
            <!-- tagKey 改用 autocomplete:已注册 tagKey 作为下拉建议,省掉原"已注册 Key"独立面板。
                 BE 一开始就预拉了 tagKeys 列表,这里直接消费,0 额外请求。 -->
            <el-autocomplete
              v-model="searchForm.tagKey"
              :fetch-suggestions="suggestTagKeys"
              :placeholder="t('tagSearchTab.tagKeyPlaceholder')"
              :trigger-on-focus="true"
              class="tag-search__key"
              clearable
              @keyup.enter="doSearch"
            >
              <template #default="{ item }">
                <span class="tag-search__suggest">{{ item.value }}</span>
              </template>
            </el-autocomplete>
          </el-form-item>
          <el-form-item :label="t('tagSearchTab.tagValueLabel')">
            <el-input
              v-model="searchForm.tagValue"
              clearable
              :placeholder="t('tagSearchTab.tagValuePlaceholder')"
              class="tag-search__value"
              @keyup.enter="doSearch"
            />
          </el-form-item>
        </ListPageQueryBar>
      </template>
      <!-- 自定义 empty 状态:区分"还没搜"和"搜了无结果",避免冷冰冰的"暂无数据" -->
      <template #empty>
        <EmptyState
          v-if="!hasSearched"
          :title="t('tagSearchTab.emptyInitialTitle')"
          :description="t('tagSearchTab.emptyInitialDesc')"
          :image-size="80"
        />
        <EmptyState
          v-else
          variant="filter-empty"
          :title="t('tagSearchTab.emptyNoMatchTitle')"
          :description="t('tagSearchTab.emptyNoMatchDesc')"
          :image-size="80"
        />
      </template>
      <el-table-column prop="resourceType" :label="t('tagSearchTab.colResourceType')" width="140">
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
        :label="t('tagSearchTab.colResourceCode')"
        min-width="200"
        show-overflow-tooltip
      />
      <el-table-column
        prop="tagKey"
        :label="t('tagSearchTab.colTagKey')"
        min-width="160"
        show-overflow-tooltip
      />
      <el-table-column
        prop="tagValue"
        :label="t('tagSearchTab.colTagValue')"
        min-width="200"
        show-overflow-tooltip
      />
    </ProTable>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { searchByTag, listTagKeys } from '@/api/tags'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import StatusTag from '@/components/common/StatusTag.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import ProTable from '@/components/table/ProTable.vue'
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
  import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
  import { useListLoadState } from '@/composables/useListLoadState'

  const tenant = useTenantStore()
  const { data: metaEnums } = useConsoleMetaEnumsQuery()
  const resourceTypeOptions = computed(() =>
    pickMetaEnumGroup(metaEnums.value, 'triggerResourceType'),
  )

  const { loading: searching, error: searchError, run: runSearchTag } = useListLoadState()
  const {
    filterBusy: searchFilterBusy,
    runSearch: runTagSearch,
    runReset: runTagSearchReset,
    runRefresh: runTagSearchRefresh,
  } = useListFilterFeedback(searching)

  const searchForm = reactive({ tagKey: '', tagValue: '' })
  const searchFilters = reactive({ resourceType: '' as string })

  const searchResults = ref<Record<string, unknown>[]>([])
  const tagKeys = ref<string[]>([])
  // 用于区分"还没搜过"和"搜了但无结果"的两种空态
  const hasSearched = ref(false)

  const searchPage = ref(1)
  const searchPageSize = ref(20)

  const filteredSearchResults = computed(() => {
    let rows = searchResults.value
    const rt = searchFilters.resourceType.trim()
    if (rt) rows = rows.filter((x) => String(x.resourceType ?? '') === rt)
    return rows
  })

  // autocomplete 回调:按输入前缀模糊匹配已注册 tagKey
  function suggestTagKeys(queryString: string, cb: (items: { value: string }[]) => void) {
    const q = queryString.trim().toLowerCase()
    const matched = q ? tagKeys.value.filter((k) => k.toLowerCase().includes(q)) : tagKeys.value
    cb(matched.slice(0, 20).map((v) => ({ value: v })))
  }

  async function doSearch() {
    if (!searchForm.tagKey.trim()) {
      ElMessage.warning(t('tagSearchTab.tagKeyRequired'))
      return
    }
    await runSearchTag(async () => {
      const data = await searchByTag(
        tenant.tenantId,
        searchForm.tagKey,
        searchForm.tagValue || undefined,
      )
      searchResults.value = Array.isArray(data) ? (data as Record<string, unknown>[]) : []
      hasSearched.value = true
    }).catch(() => {
      searchResults.value = []
      hasSearched.value = true
    })
  }

  async function loadKeys() {
    try {
      const data = await listTagKeys(tenant.tenantId)
      // BE 可能返回 string[] 也可能 {key}[],归一成 string[]
      tagKeys.value = (Array.isArray(data) ? data : []).map((x) => {
        if (typeof x === 'string') return x
        if (x && typeof x === 'object' && 'key' in x)
          return String((x as Record<string, unknown>).key ?? '')
        return String(x ?? '')
      })
    } catch {
      tagKeys.value = []
    }
  }

  useTenantReload(() => {
    searchResults.value = []
    tagKeys.value = []
    hasSearched.value = false
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

  .tag-search__suggest {
    font-size: 13px;
    color: var(--color-text-primary);
  }
</style>
