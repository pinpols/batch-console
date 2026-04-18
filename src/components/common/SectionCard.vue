<template>
  <el-card class="section-card" shadow="never">
    <template v-if="$slots.header" #header>
      <div class="section-card__header">
        <slot name="header" />
      </div>
    </template>
    <slot />
  </el-card>
</template>

<style scoped>
  .section-card {
    border: none;
    border-radius: var(--radius-content);
  }

  .section-card :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .section-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }
</style>
