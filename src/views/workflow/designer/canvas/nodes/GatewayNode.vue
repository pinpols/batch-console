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
  const v = String((data?.attrs as Record<string, unknown> | undefined)?.gatewayStrategy ?? '').toUpperCase()
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
  background: var(--color-warning-light, #fdf6ec);
  border: 2px solid var(--color-warning, #e6a23c);
  display: flex;
  align-items: center;
  justify-content: center;
}
.designer-gateway--error .designer-gateway__diamond {
  border-color: var(--color-danger, #f56c6c);
  background: var(--color-danger-light, #fef0f0);
}
.designer-gateway__inner {
  transform: rotate(-45deg);
  text-align: center;
  font-size: 11px;
  color: var(--color-text-primary, #303133);
}
.designer-gateway__strategy {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-warning-dark, #b88230);
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
