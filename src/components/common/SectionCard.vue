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
    border: 1px solid var(--color-border-light);
  }

  .section-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }
</style>
