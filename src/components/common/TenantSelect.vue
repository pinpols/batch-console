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
    :style="selectStyle"
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
  import { ref, onMounted } from 'vue'
  import { listTenants, type Tenant } from '@/api/tenants'

  withDefaults(
    defineProps<{
      modelValue?: string
      placeholder?: string
      size?: 'small' | 'default' | 'large'
      disabled?: boolean
      selectStyle?: string
    }>(),
    {
      modelValue: '',
      placeholder: '搜索租户',
      size: 'default',
      disabled: false,
      selectStyle: 'width: 200px',
    },
  )

  defineEmits<{
    'update:modelValue': [value: string]
  }>()

  const searching = ref(false)
  const options = ref<Tenant[]>([])

  async function fetchTenants(keyword?: string) {
    searching.value = true
    try {
      const res = await listTenants({ keyword, pageNo: 1, pageSize: 50 })
      options.value = res.items
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
