<template>
  <div class="not-found">
    <div class="not-found__content">
      <h1 class="not-found__code">404</h1>
      <p class="not-found__message">{{ t('notFound.title') }}</p>
      <p class="not-found__hint">{{ t('notFound.hint') }}</p>
      <el-button type="primary" @click="goHome">{{ t('notFound.backHome') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })
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
    min-height: 100dvh;
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
