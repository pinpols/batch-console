<template>
  <!-- 中文全局 locale：Element Plus 的 MessageBox / Dialog / Pagination 等默认英文
       （按钮 "OK"/"Cancel"、"Previous"/"Next" 等）；挂载 zh-cn 后统一中文。 -->
  <ElConfigProvider :locale="zhCn">
    <RouteProgressBar />
    <RouterView />
  </ElConfigProvider>
</template>

<script setup lang="ts">
  import { ElConfigProvider } from 'element-plus'
  import zhCn from 'element-plus/es/locale/lang/zh-cn'
  import RouteProgressBar from '@/components/common/RouteProgressBar.vue'
</script>
