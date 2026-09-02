<script setup lang="ts">
  /**
   * GATEWAY 节点(菱形)。
   * 显示 strategy(AND / OR / XOR);未配置时显示占位。
   * 红框:store.errorNodeIds 命中时显示(校验失败可视化)。
   */
  import { computed, inject } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../../store/useDesignerStore'
  import type { DesignerNode } from '../../types'

  const { t } = useI18n()
  const store = useDesignerStore()
  const getNode = inject<(() => { getData?: () => DesignerNode | undefined }) | null>(
    'getNode',
    null,
  )
  const data = getNode?.()?.getData?.()
  const strategy = computed(() => {
    const v = String(
      (data?.attrs as Record<string, unknown> | undefined)?.gatewayStrategy ?? '',
    ).toUpperCase()
    return ['AND', 'OR', 'XOR'].includes(v) ? v : ''
  })
  const hasError = computed(() => (data?.id ? store.errorNodeIds.has(data.id) : false))
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
          {{ strategy || t('workflowDesignerMvp.gatewayStrategyUnset') }}
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
