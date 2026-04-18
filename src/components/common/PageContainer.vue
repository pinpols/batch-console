<template>
  <main class="page-container">
    <slot />
  </main>
</template>

<style scoped>
  .page-container {
    display: flex;
    flex-direction: column;
    gap: var(--page-section-gap);
    min-height: 100%;
  }
</style>
