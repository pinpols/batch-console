<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    reserve-keyword
    :popper-class="resolvedPopperClass"
    clearable
    :remote-method="search"
    :loading="searching"
    :placeholder="placeholder"
    :size="size"
    :class="resolvedSelectClass"
    :style="selectStyleNormalized"
    :disabled="disabled"
    @update:model-value="$emit('update:modelValue', $event)"
    @clear="onClear"
  >
    <el-option
      v-for="tenant in options"
      :key="tenant.tenantId"
      :label="tenant.tenantId"
      :value="tenant.tenantId"
    >
      <div class="tenant-option" :title="optionLabel(tenant)">
        <span class="tenant-option__id">{{ tenant.tenantId }}</span>
        <span v-if="tenant.tenantName" class="tenant-option__name">{{ tenant.tenantName }}</span>
        <span
          v-if="tenant.status && tenant.status !== 'ACTIVE'"
          class="tenant-option__status"
          :data-status="tenant.status"
        >
          {{ tenant.status }}
        </span>
      </div>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
  import { computed, ref, onMounted } from 'vue'
  import { listTenants, type Tenant } from '@/api/tenants'

  const props = withDefaults(
    defineProps<{
      modelValue?: string
      placeholder?: string
      size?: 'small' | 'default' | 'large'
      disabled?: boolean
      /** @deprecated Prefer `selectClass` (e.g. `query-w-200`) */
      selectStyle?: string
      /** Utility classes applied to the underlying `el-select` */
      selectClass?: string
      /** Classes applied to the dropdown popper. */
      popperClass?: string
    }>(),
    {
      modelValue: '',
      placeholder: '搜索租户',
      size: 'default',
      disabled: false,
      selectStyle: 'width: 200px',
      selectClass: '',
      popperClass: '',
    },
  )

  defineEmits<{
    'update:modelValue': [value: string]
  }>()

  const resolvedSelectClass = computed(() => props.selectClass?.trim() || undefined)
  const resolvedPopperClass = computed(() =>
    ['tenant-select-popper', props.popperClass?.trim()].filter(Boolean).join(' '),
  )

  const selectStyleNormalized = computed(() => {
    // When callers use width utility classes, inline `width:` would win and defeat the class.
    if (resolvedSelectClass.value) return undefined
    return props.selectStyle?.trim() ? props.selectStyle : undefined
  })

  const searching = ref(false)
  const options = ref<Tenant[]>([])

  // 永远从下拉里隐藏的 tenant_id:
  //   - 'default'        配置模板库(V55 seed),新租户初始化时复制 queue/window/calendar
  //   - 'default-tenant' V42 演示账号孤儿;V148 自动清,残留兜底
  //   - 'system'         admin 账号宿主,不是业务工作租户(管理页 /system/* 不依赖切到这里)
  // 后端列表接口若未过滤,前端兜底再过一遍(防御性双层)
  const HIDDEN_TENANTS = new Set(['default', 'default-tenant', 'system'])

  async function fetchTenants(keyword?: string) {
    searching.value = true
    try {
      const res = await listTenants({ keyword, pageNo: 1, pageSize: 50 })
      options.value = res.items.filter((t) => !HIDDEN_TENANTS.has(t.tenantId))
    } catch {
      options.value = []
    } finally {
      searching.value = false
    }
  }

  function search(query: string) {
    fetchTenants(query || undefined)
  }

  function onClear() {
    fetchTenants()
  }

  function optionLabel(tenant: Tenant) {
    return tenant.tenantName ? `${tenant.tenantId} ${tenant.tenantName}` : tenant.tenantId
  }

  onMounted(() => fetchTenants())
</script>

<style scoped>
  .tenant-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-width: 0;
    line-height: 1.2;
  }

  .tenant-option__id {
    flex: 0 0 auto;
    max-width: 104px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary, #303133);
    font-size: 13px;
    font-weight: 650;
  }

  .tenant-option__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-tertiary, #909399);
    font-size: 12px;
  }

  .tenant-option__status {
    flex: 0 0 auto;
    padding: 1px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-warning, #e6a23c) 14%, transparent);
    color: var(--color-warning, #b88230);
    font-size: 10px;
    font-weight: 700;
    line-height: 16px;
  }

  :deep(.el-select__selected-item .tenant-option__name),
  :deep(.el-select__selected-item .tenant-option__status) {
    display: none;
  }

  :deep(.el-select__selected-item .tenant-option__id) {
    max-width: 100%;
  }

  :global(.tenant-select-popper) {
    min-width: min(320px, calc(100vw - 32px)) !important;
  }

  :global(.tenant-select-popper .el-select-dropdown__item) {
    height: 36px;
    padding-inline: 12px;
  }
</style>
