<template>
  <el-drawer
    :append-to-body="true"
    :model-value="modelValue"
    :title="resolvedTitle"
    direction="rtl"
    size="640px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <template #header>
      <div class="docs-drawer__header">
        <span class="docs-drawer__title">
          <el-icon><Document /></el-icon>
          {{ resolvedTitle }}
        </span>
        <el-button
          text
          type="primary"
          tag="a"
          :href="iframeSrc"
          target="_blank"
          rel="noopener"
          :icon="Top"
        >
          {{ t('docsDrawer.openInDocs') }}
        </el-button>
      </div>
    </template>
    <iframe
      v-if="modelValue && iframeSrc"
      :src="iframeSrc"
      class="docs-drawer__iframe"
      :title="t('docsDrawer.iframeTitle')"
      loading="lazy"
    />
  </el-drawer>
</template>

<script setup lang="ts">
  /**
   * 嵌入式文档抽屉:右侧滑出,iframe 加载文档站对应页。
   *
   * 用法:
   *   <DocsDrawer v-model="open" doc-key="adr-009-workflow-param-dsl" />
   *   <el-button @click="open = true">查看 ADR-009 DSL</el-button>
   *
   * iframe 而非 markdown 客户端渲染:复用文档站完整体验(搜索、ADR 互链、shiki),
   * 而且首屏 SPA bundle 不带 markdown 渲染管线。
   *
   * docKey 是稳定标识(避免业务代码硬编码具体 URL);新增 doc-key 加到 DOC_REGISTRY。
   */
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ArrowUp as Top, FileText as Document } from 'lucide-vue-next'
  import { DOC_REGISTRY, resolveDocUrl } from './docsRegistry'
  const { t } = useI18n({ useScope: 'global' })

  const props = defineProps<{
    modelValue: boolean
    /** 稳定标识,见 docsRegistry.DOC_REGISTRY */
    docKey: string
    /** 可选:覆盖 DOC_REGISTRY 默认标题 */
    title?: string
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
  }>()

  const docEntry = computed(() => DOC_REGISTRY[props.docKey])
  const iframeSrc = computed(() => resolveDocUrl(props.docKey))
  const resolvedTitle = computed(
    () => props.title || docEntry.value?.title || t('docsDrawer.iframeTitle'),
  )
</script>

<style scoped>
  .docs-drawer__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
  .docs-drawer__title {
    font-size: 15px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .docs-drawer__iframe {
    width: 100%;
    height: calc(100vh - 80px);
    height: calc(100dvh - 80px);
    border: none;
  }
</style>
