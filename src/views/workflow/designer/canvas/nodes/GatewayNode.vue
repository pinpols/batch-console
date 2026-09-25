<script setup lang="ts">
  /**
   * GATEWAY 节点(菱形)。
   * 显示真实运行语义：分支出边数，或汇聚 joinMode / threshold。
   * 红框:store.errorNodeIds 命中时显示(校验失败可视化)。
   */
  import { computed, inject } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../../store/useDesignerStore'
  import type { DesignerNode } from '../../types'

  const { t } = useI18n()
  const store = useDesignerStore()
  type GatewayViewData = DesignerNode & { getData?: () => DesignerNode | undefined }
  const getNode = inject<(() => { getData?: () => GatewayViewData | undefined }) | null>(
    'getNode',
    null,
  )
  const viewData = getNode?.()?.getData?.()
  const data = computed(() => viewData?.getData?.() ?? viewData)
  const semanticLabel = computed(() => {
    const nodeId = data.value?.id ?? data.value?.nodeCode
    if (!nodeId) return 'GATEWAY'
    const incoming = store.edges.filter((edge) => edge.target === nodeId).length
    const outgoing = store.edges.filter((edge) => edge.source === nodeId).length
    const attrs = (data.value?.attrs ?? {}) as Record<string, unknown>
    const mode = String(attrs.joinMode ?? 'ALL').toUpperCase()
    if (incoming >= 2) {
      if (mode === 'N_OF') {
        const threshold = Number(attrs.joinThreshold) || incoming
        return `N_OF ${threshold}/${incoming}`
      }
      return `${mode === 'ANY' ? 'ANY' : 'ALL'} ${incoming}`
    }
    if (outgoing >= 2) return `FORK ${outgoing}`
    return 'GATEWAY'
  })
  const hasError = computed(() => {
    const nodeId = data.value?.id ?? data.value?.nodeCode
    return nodeId ? store.errorNodeIds.has(nodeId) : false
  })
</script>

<template>
  <div
    class="designer-gateway"
    :class="{ 'designer-gateway--error': hasError }"
    role="img"
    :aria-label="t('workflowDesignerMvp.nodeGateway')"
  >
    <div class="designer-gateway__diamond">
      <div class="designer-gateway__inner">
        <span class="designer-gateway__strategy">
          {{ semanticLabel }}
        </span>
        <span class="designer-gateway__label">{{ data?.nodeName || data?.nodeCode || '' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .designer-gateway {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
  }
  .designer-gateway__diamond {
    width: 100%;
    height: 100%;
    transform: rotate(45deg);
    background: var(--wf-node-gateway-light);
    border: 2px solid var(--wf-node-gateway);
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      box-shadow 0.12s ease,
      border-color 0.12s ease;
  }
  .designer-gateway__diamond:hover {
    box-shadow: 0 0 0 3px var(--wf-node-gateway-light);
  }
  .designer-gateway--error .designer-gateway__diamond {
    border-color: var(--wf-node-error);
    background: var(--wf-node-error-light);
  }
  .designer-gateway__inner {
    transform: rotate(-45deg);
    text-align: center;
    font-size: 11px;
    color: #243247;
  }
  .designer-gateway__strategy {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: var(--wf-node-gateway);
  }
  .designer-gateway__label {
    display: block;
    font-size: 10px;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
