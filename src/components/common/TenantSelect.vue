<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    reserve-keyword
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
    <el-option v-for="t in options" :key="t.tenantId" :label="t.tenantId" :value="t.tenantId">
      <span>{{ t.tenantId }}</span>
      <span v-if="t.tenantName" class="tenant-option-name">{{ t.tenantName }}</span>
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
    }>(),
    {
      modelValue: '',
      placeholder: '搜索租户',
      size: 'default',
      disabled: false,
      selectStyle: 'width: 200px',
      selectClass: '',
    },
  )

  defineEmits<{
    'update:modelValue': [value: string]
  }>()

  const resolvedSelectClass = computed(() => props.selectClass?.trim() || undefined)

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

  onMounted(() => fetchTenants())
</script>

<style scoped>
  .tenant-option-name {
    margin-left: 8px;
    color: var(--color-text-tertiary, #909399);
    font-size: 12px;
  }
</style>
