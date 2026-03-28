<template>
  <el-card class="table-skeleton" shadow="never">
    <div class="table-skeleton__toolbar">
      <el-skeleton animated :rows="1" />
    </div>
    <el-skeleton animated :rows="rows" />
  </el-card>
</template>

<script setup lang="ts">
  withDefaults(
    defineProps<{
      rows?: number
    }>(),
    {
      rows: 6,
    },
  )
</script>

<style scoped>
  .table-skeleton {
    border: 1px solid var(--color-border-light);
  }

  .table-skeleton__toolbar {
    margin-bottom: 16px;
  }
</style>

