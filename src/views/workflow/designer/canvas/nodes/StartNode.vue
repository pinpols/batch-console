<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { inject } from 'vue'
import type { DesignerNode } from '../../types'

const { t } = useI18n()
// X6 vue-shape 通过 provide(getNode/node) 把节点实例传进来。
// 取节点数据用于显示;Spike 阶段只展示类型徽标 + 名称
const getNode = inject<(() => { getData?: () => DesignerNode | undefined }) | null>(
  'getNode',
  null,
)
const data = getNode?.()?.getData?.()
</script>

<template>
  <div class="designer-node designer-node--start" role="img" :aria-label="t('workflowDesignerSpike.nodeStart')">
    <span class="designer-node__badge">{{ t('workflowDesignerSpike.nodeStart') }}</span>
    <span v-if="data?.nodeName" class="designer-node__label">{{ data.nodeName }}</span>
  </div>
</template>

<style scoped>
.designer-node {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  color: #fff;
  user-select: none;
}
.designer-node--start {
  background: var(--color-success, #67c23a);
  border: 2px solid var(--color-success-dark, #529b2e);
}
.designer-node__badge {
  font-weight: 600;
}
.designer-node__label {
  font-size: 11px;
  opacity: 0.9;
}
</style>
