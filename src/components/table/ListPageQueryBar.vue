<template>
  <el-form inline class="query-form" v-bind="attrs" @submit.prevent="emit('search')">
    <!-- prepend: 查询条件 form-item 之前的插槽（典型用法：左上角的"新增 XX"主操作按钮） -->
    <slot name="prepend" />
    <slot />
    <el-form-item v-if="showTrailing" class="query-actions">
      <el-button
        v-if="showSearch"
        type="primary"
        :icon="Search"
        :loading="filterBusy"
        :disabled="disabled"
        @click="emit('search')"
      >
        查询
      </el-button>
      <el-button
        v-if="showReset"
        text
        :icon="RefreshLeft"
        :loading="filterBusy"
        :disabled="disabled"
        @click="emit('reset')"
      >
        重置
      </el-button>
      <el-button
        v-if="showRefresh"
        text
        :icon="Refresh"
        :loading="refreshLoading"
        :disabled="disabled"
        @click="emit('refresh')"
      >
        刷新
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
  import { computed, useAttrs } from 'vue'
  import { Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'

  defineOptions({ inheritAttrs: false })

  const props = withDefaults(
    defineProps<{
      /** 查询 / 重置按钮 loading */
      filterBusy?: boolean
      /** 刷新按钮 loading；不传则与 filterBusy 相同 */
      refreshBusy?: boolean
      disabled?: boolean
      showSearch?: boolean
      showReset?: boolean
      showRefresh?: boolean
    }>(),
    {
      filterBusy: false,
      refreshBusy: undefined,
      disabled: false,
      showSearch: true,
      showReset: true,
      showRefresh: true,
    },
  )

  const emit = defineEmits<{
    search: []
    reset: []
    refresh: []
  }>()

  const attrs = useAttrs()

  const refreshLoading = computed(() =>
    props.refreshBusy === undefined ? props.filterBusy : props.refreshBusy,
  )

  const showTrailing = computed(() => props.showSearch || props.showReset || props.showRefresh)
</script>

<style scoped>
  /* 自管 margin-bottom:让裸用 ListPageQueryBar(不套 ProTable)的页面也跟下方表格
     有标准间距。ProTable 那边把 .pro-table__query 的 margin 清 0 避免叠加 */
  .query-form {
    margin-bottom: var(--page-block-gap);
  }

  .query-actions :deep(.el-form-item__content) {
    gap: 4px;
  }
</style>
