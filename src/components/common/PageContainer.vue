<template>
  <main class="page-container">
    <slot />
  </main>
</template>

<style scoped>
  .page-container {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    min-height: 100%;
  }
</style>
