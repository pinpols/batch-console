<template>
  <!-- ElConfigProvider 把 :locale 透传给所有 Element Plus 声明式组件
       (Pagination / DatePicker / Dialog 等内置文案);imperative API
       (ElMessageBox / ElMessage)由 main.ts use(ElementPlus, { locale }) 提供。 -->
  <ElConfigProvider :locale="elementLocale">
    <RouteProgressBar />
    <RouterView />
  </ElConfigProvider>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElConfigProvider } from 'element-plus'
  import RouteProgressBar from '@/components/common/RouteProgressBar.vue'
  import { resolveElementPlusLocale } from '@/locales/elementPlus'
  import type { Locale } from '@/constants/locale'

  const { locale } = useI18n({ useScope: 'global' })
  const elementLocale = computed(() => resolveElementPlusLocale(locale.value as Locale))
</script>
