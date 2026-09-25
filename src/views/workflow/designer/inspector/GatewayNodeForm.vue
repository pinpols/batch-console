<script setup lang="ts">
  /** GATEWAY 节点表单：分支由出边决定，汇聚由 joinMode 决定。 */
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useDesignerStore } from '../store/useDesignerStore'
  import type { DesignerNode } from '../types'

  const props = defineProps<{ node: DesignerNode; readonly: boolean }>()
  const { t } = useI18n()
  const store = useDesignerStore()

  type JoinMode = 'ALL' | 'ANY' | 'N_OF'

  interface GatewayAttrs {
    joinMode?: JoinMode
    joinThreshold?: number
  }

  function readAttrs(node: DesignerNode): GatewayAttrs {
    const attrs = (node.attrs ?? {}) as Record<string, unknown>
    const mode = String(attrs.joinMode ?? '').toUpperCase()
    const threshold = Number(attrs.joinThreshold)
    return {
      joinMode: ['ALL', 'ANY', 'N_OF'].includes(mode) ? (mode as JoinMode) : undefined,
      joinThreshold: Number.isInteger(threshold) && threshold > 0 ? threshold : undefined,
    }
  }

  const local = ref<GatewayAttrs>(readAttrs(props.node))
  const localName = ref(props.node.nodeName)
  const incomingCount = computed(
    () => store.edges.filter((edge) => edge.target === props.node.id).length,
  )
  const outgoingCount = computed(
    () => store.edges.filter((edge) => edge.source === props.node.id).length,
  )
  const isJoin = computed(() => incomingCount.value >= 2)
  const isBranch = computed(() => outgoingCount.value >= 2)

  const fieldErrors = computed(() => {
    const errors = new Map<string, string>()
    for (const error of store.validationErrors) {
      if (error.nodeId === props.node.id && error.field) {
        errors.set(error.field, error.messageKey)
      }
    }
    return errors
  })

  watch(
    () => [props.node.id, props.node.nodeName, JSON.stringify(props.node.attrs ?? {})],
    () => {
      local.value = readAttrs(props.node)
      localName.value = props.node.nodeName
    },
  )

  function onBlurName() {
    if (props.readonly || localName.value === props.node.nodeName) return
    store.updateNode(props.node.id, { nodeName: localName.value })
  }

  function onJoinModeChange(value: JoinMode) {
    if (props.readonly) return
    local.value.joinMode = value
    if (value === 'N_OF') {
      const threshold = Math.min(2, incomingCount.value)
      local.value.joinThreshold = local.value.joinThreshold ?? threshold
    } else {
      local.value.joinThreshold = undefined
    }
    store.updateNode(props.node.id, {
      attrs: {
        joinMode: value,
        joinThreshold: local.value.joinThreshold,
      },
    })
  }

  function onThresholdChange(value: number | undefined) {
    if (props.readonly) return
    local.value.joinThreshold = value
    store.updateNode(props.node.id, { attrs: { joinThreshold: value } })
  }
</script>

<template>
  <el-form class="gateway-inspector" label-position="top" size="small">
    <el-form-item :label="t('workflowDesignerMvp.field.nodeType')">
      <el-input :model-value="t('workflowDesignerMvp.nodeGateway')" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeCode')">
      <el-input :model-value="props.node.nodeCode" readonly />
    </el-form-item>
    <el-form-item :label="t('workflowDesignerMvp.field.nodeName')">
      <el-input v-model="localName" :readonly="props.readonly" @blur="onBlurName" />
    </el-form-item>

    <div class="gateway-inspector__topology" :aria-label="t('workflowDesignerMvp.gatewayTopology')">
      <div>
        <span>{{ t('workflowDesignerMvp.field.incomingDependencies') }}</span>
        <strong>{{ incomingCount }}</strong>
      </div>
      <div>
        <span>{{ t('workflowDesignerMvp.field.outgoingDependencies') }}</span>
        <strong>{{ outgoingCount }}</strong>
      </div>
    </div>

    <el-alert
      v-if="isBranch"
      type="info"
      :closable="false"
      show-icon
      :title="t('workflowDesignerMvp.gatewayBranchHint')"
    />

    <template v-if="isJoin">
      <el-form-item
        :label="t('workflowDesignerMvp.field.joinMode')"
        :error="fieldErrors.get('joinMode') ? t(fieldErrors.get('joinMode')!) : undefined"
        required
      >
        <el-radio-group
          v-model="local.joinMode"
          :disabled="props.readonly"
          @change="onJoinModeChange($event as JoinMode)"
        >
          <el-radio-button value="ALL">ALL</el-radio-button>
          <el-radio-button value="ANY">ANY</el-radio-button>
          <el-radio-button value="N_OF">N_OF</el-radio-button>
        </el-radio-group>
        <div class="gateway-inspector__hint">
          {{ t(`workflowDesignerMvp.joinModeDescription.${local.joinMode ?? 'ALL'}`) }}
        </div>
      </el-form-item>
      <el-form-item
        v-if="local.joinMode === 'N_OF'"
        :label="t('workflowDesignerMvp.field.joinThreshold')"
        :error="
          fieldErrors.get('joinThreshold')
            ? t(fieldErrors.get('joinThreshold')!, { count: incomingCount })
            : undefined
        "
        required
      >
        <el-input-number
          v-model="local.joinThreshold"
          :disabled="props.readonly"
          :min="1"
          :max="incomingCount"
          controls-position="right"
          @change="onThresholdChange($event as number | undefined)"
        />
      </el-form-item>
    </template>

    <el-alert
      v-else
      type="success"
      :closable="false"
      show-icon
      :title="t('workflowDesignerMvp.gatewayPassThroughHint')"
    />
  </el-form>
</template>

<style scoped>
  .gateway-inspector__topology {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 14px;
  }

  .gateway-inspector__topology > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    padding: 8px 10px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-control, 4px);
    color: var(--color-text-secondary);
    font-size: 11px;
  }

  .gateway-inspector__topology strong {
    color: var(--color-text-primary);
    font-family: var(--font-family-mono);
    font-size: 13px;
  }

  .gateway-inspector__hint {
    width: 100%;
    margin-top: 6px;
    color: var(--color-text-secondary);
    font-size: 11px;
    line-height: 1.5;
  }

  .gateway-inspector :deep(.el-alert) {
    margin-bottom: 14px;
  }

  .gateway-inspector :deep(.el-input-number) {
    width: 100%;
  }
</style>
