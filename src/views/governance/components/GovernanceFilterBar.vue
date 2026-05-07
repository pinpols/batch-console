<template>
  <ListPageQueryBar
    class="governance-query"
    :filter-busy="filterBusy"
    :refresh-busy="refreshBusy"
    @search="emit('search')"
    @reset="emit('reset')"
    @refresh="emit('refresh')"
  >
    <el-form-item label="关键字">
      <el-input
        :model-value="keyword"
        clearable
        :placeholder="keywordPlaceholder"
        class="governance-query__search"
        @update:model-value="(v) => emit('update:keyword', v)"
        @keyup.enter="emit('search')"
      />
    </el-form-item>
    <el-form-item label="启用状态">
      <el-select
        :model-value="enabled"
        clearable
        placeholder="全部"
        class="governance-query__select"
        @update:model-value="(v) => emit('update:enabled', v as boolean | undefined)"
      >
        <el-option label="已启用" :value="true" />
        <el-option label="已停用" :value="false" />
      </el-select>
    </el-form-item>
  </ListPageQueryBar>
</template>

<script setup lang="ts">
  import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'

  defineProps<{
    keyword: string
    enabled: boolean | undefined
    keywordPlaceholder: string
    filterBusy: boolean
    refreshBusy: boolean
  }>()

  const emit = defineEmits<{
    (e: 'update:keyword', v: string): void
    (e: 'update:enabled', v: boolean | undefined): void
    (e: 'search'): void
    (e: 'reset'): void
    (e: 'refresh'): void
  }>()
</script>

<style scoped>
  .governance-query {
    margin-bottom: 12px;
  }

  .governance-query__search {
    width: 320px;
  }

  .governance-query__select {
    width: 160px;
  }

  @media (max-width: 900px) {
    .governance-query__search {
      width: min(320px, 100%);
    }
  }
</style>
