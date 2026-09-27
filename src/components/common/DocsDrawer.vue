<template>
  <el-drawer
    class="docs-drawer"
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
        <el-button text type="primary" :icon="Top" @click="openInDocs">
          {{ t('docsDrawer.openInDocs') }}
        </el-button>
      </div>
    </template>
    <el-skeleton v-if="docsState === 'checking'" :rows="8" animated />
    <EmptyState
      v-else-if="docsState === 'unavailable'"
      variant="service-down"
      :title="t('docsUnavailable.title')"
      :description="t('docsUnavailable.description')"
    >
      <template #action>
        <el-button type="primary" :icon="Refresh" @click="checkDocs">
          {{ t('docsUnavailable.retry') }}
        </el-button>
      </template>
    </EmptyState>
    <iframe
      v-else-if="modelValue && iframeSrc && docsState === 'ready'"
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
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ArrowUp as Top, FileText as Document, RefreshCw as Refresh } from '@lucide/vue'
  import { useRouter } from 'vue-router'
  import EmptyState from './EmptyState.vue'
  import { DOC_REGISTRY, resolveDocUrl } from './docsRegistry'
  import { checkDocsAvailability } from '@/utils/serviceAvailability'
  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()

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
  const docsState = ref<'idle' | 'checking' | 'ready' | 'unavailable'>('idle')

  async function checkDocs() {
    if (!iframeSrc.value) {
      docsState.value = 'unavailable'
      return
    }
    docsState.value = 'checking'
    docsState.value = (await checkDocsAvailability(iframeSrc.value)) ? 'ready' : 'unavailable'
  }

  async function openInDocs() {
    const docsTab = window.open('about:blank', '_blank')
    if (docsTab) docsTab.opener = null
    if (await checkDocsAvailability(iframeSrc.value)) {
      if (docsTab) docsTab.location.href = iframeSrc.value
      else window.open(iframeSrc.value, '_blank', 'noopener')
      return
    }
    docsTab?.close()
    emit('update:modelValue', false)
    void router.push('/docs-unavailable')
  }

  watch(
    [() => props.modelValue, iframeSrc],
    ([visible]) => {
      if (visible) void checkDocs()
      else docsState.value = 'idle'
    },
    { immediate: true },
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

  .docs-drawer :deep(.el-skeleton) {
    padding: var(--space-lg);
  }
</style>
