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
            <el-input
              v-model="searchForm.tagKey"
              :placeholder="t('tagSearchTab.tagKeyPlaceholder')"
              class="tag-search__key"
              @keyup.enter="doSearch"
            />
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

    <div class="tag-subsection">
      <div class="tag-subsection__title">{{ t('tagSearchTab.keysSubtitle') }}</div>
      <ProTable
        :data="pagedKeys"
        :loading="loadingKeys"
        :error="loadKeysError"
        :on-retry="loadKeys"
        :total="filteredKeys.length"
        v-model:page="keyPage"
        v-model:page-size="keyPageSize"
        @change="() => {}"
      >
        <template #query>
          <ListPageQueryBar
            :filter-busy="keysFilterBusy"
            :refresh-busy="loadingKeys"
            @search="
              () =>
                runKeysSearch(() => {
                  keyPage = 1
                })
            "
            @reset="
              () =>
                runKeysReset(() => {
                  keyKeyword = ''
                  keyPage = 1
                })
            "
            @refresh="() => runKeysRefresh(loadKeys)"
          >
            <el-form-item :label="t('tagSearchTab.keysKeywordLabel')">
              <el-input
                class="query-w-260"
                v-model="keyKeyword"
                clearable
                :placeholder="t('tagSearchTab.keysKeywordPlaceholder')"
                @keyup.enter="
                  () => {
                    keyPage = 1
                  }
                "
              />
            </el-form-item>
          </ListPageQueryBar>
        </template>
        <el-table-column prop="key" :label="t('tagSearchTab.colTagKey')" min-width="300" />
      </ProTable>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'

  const { t } = useI18n({ useScope: 'global' })
  import { searchByTag, listTagKeys } from '@/api/tags'
  import { toPageResult } from '@/api/adapters'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useConsoleMetaEnumsQuery } from '@/composables/queries/useConsoleMeta'
  import { pickMetaEnumGroup } from '@/utils/metaEnumPick'
  import StatusTag from '@/components/common/StatusTag.vue'
  import MetaSelect from '@/components/common/MetaSelect.vue'
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
  const { loading: loadingKeys, error: loadKeysError, run: runLoadKeys } = useListLoadState()
  const {
    filterBusy: searchFilterBusy,
    runSearch: runTagSearch,
    runReset: runTagSearchReset,
    runRefresh: runTagSearchRefresh,
  } = useListFilterFeedback(searching)
  const {
    filterBusy: keysFilterBusy,
    runSearch: runKeysSearch,
    runReset: runKeysReset,
    runRefresh: runKeysRefresh,
  } = useListFilterFeedback(loadingKeys)

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
    }).catch(() => {
      searchResults.value = []
    })
  }

  async function loadKeys() {
    await runLoadKeys(async () => {
      const data = await listTagKeys(tenant.tenantId)
      tagKeys.value = Array.isArray(data) ? data : []
    }).catch(() => {
      tagKeys.value = []
    })
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
