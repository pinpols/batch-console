<template>
  <div class="not-found">
    <div class="not-found__content">
      <h1 class="not-found__code">404</h1>
      <p class="not-found__message">页面不存在</p>
      <p class="not-found__hint">请检查地址是否正确，或返回首页。</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'

  const router = useRouter()

  function goHome() {
    router.push('/')
  }
</script>

<style scoped>
  .not-found {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
  }

  .not-found__code {
    font-size: 72px;
    font-weight: 700;
    color: var(--el-color-primary);
    margin: 0 0 8px;
    line-height: 1;
  }

  .not-found__message {
    font-size: 20px;
    color: var(--el-text-color-primary);
    margin: 0 0 8px;
  }

  .not-found__hint {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0 0 24px;
  }
</style>
