<template>
  <div class="m-skel">
    <div v-for="i in count" :key="i" class="m-skel__card">
      <div class="m-skel__row m-skel__row--title" />
      <div class="m-skel__row m-skel__row--sub" />
      <div class="m-skel__meta">
        <div class="m-skel__row" />
        <div class="m-skel__row" />
        <div class="m-skel__row" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  withDefaults(defineProps<{ count?: number }>(), { count: 3 })
</script>

<style scoped>
  .m-skel {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .m-skel__card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    border-radius: 12px;
    padding: 14px;
  }

  .m-skel__row {
    height: 10px;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      var(--el-fill-color-light) 0%,
      var(--el-fill-color-lighter) 50%,
      var(--el-fill-color-light) 100%
    );
    background-size: 200% 100%;
    animation: m-skel-shimmer 1.4s ease-in-out infinite;
  }

  .m-skel__row--title {
    width: 55%;
    height: 14px;
    margin-bottom: 8px;
  }

  .m-skel__row--sub {
    width: 35%;
    height: 10px;
    margin-bottom: 10px;
  }

  .m-skel__meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  @keyframes m-skel-shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
</style>
