<script setup lang="ts">
  /** GATEWAY 节点表单：分支由出边决定，汇聚由 joinMode 决定。 */
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useDesignerStore } from '../store/useDesignerStore'
  import type { DesignerNode } from '../types'
  import { useInspectorTextDraft } from './useInspectorTextDraft'

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
    const rawMode = String(attrs.joinMode ?? '')
    const mode = rawMode.toUpperCase()
    const threshold = Number(attrs.joinThreshold)
    return {
      joinMode: ['ALL', 'ANY', 'N_OF'].includes(mode) ? (mode as JoinMode) : undefined,
      joinThreshold: Number.isInteger(threshold) && threshold > 0 ? threshold : undefined,
    }
  }

  const local = ref<GatewayAttrs>(readAttrs(props.node))
  const {
    value: localName,
    update: updateName,
    captureInput: captureName,
    isCurrent,
    scope,
    id,
  } = useInspectorTextDraft(
    'nodeName',
    () => props.node.id,
    () => props.node.nodeName,
    () => props.readonly,
  )
  const incomingCount = computed(
    () => store.edges.filter((edge) => edge.target === props.node.id).length,
  )
  const outgoingCount = computed(
    () => store.edges.filter((edge) => edge.source === props.node.id).length,
  )
  const isJoin = computed(() => incomingCount.value >= 2)
  const isBranch = computed(() => outgoingCount.value >= 2)
  const thresholdDraft = computed(() => store.getInspectorDraft('gatewayThreshold', props.node.id))

  const fieldErrors = computed(() => {
    const errors = new Map<string, string>()
    for (const error of store.validationErrors) {
      if (error.nodeId === props.node.id && error.field) {
        errors.set(error.field, error.messageKey)
      }
    }
    return errors
  })

  function localizedFieldError(field: string, params?: { count: number }): string | undefined {
    const messageKey = fieldErrors.value.get(field)
    if (!messageKey) return undefined
    return params ? t(messageKey, params) : t(messageKey)
  }

  watch(
    () => [props.node.id, props.node.nodeName, JSON.stringify(props.node.attrs ?? {})],
    () => {
      local.value = readAttrs(props.node)
      const draft = store.getInspectorDraft('gatewayThreshold', props.node.id)
      if (draft && /^\d+$/.test(draft.value)) local.value.joinThreshold = Number(draft.value)
    },
    { immediate: true },
  )

  function hasDraft() {
    return store.inspectorDrafts.some(
      (draft) => draft.elementId === props.node.id && draft.field !== 'edgeCondition',
    )
  }

  function flushDraft() {
    if (!isCurrent() || props.readonly || !hasDraft()) return
    store.applyInspectorDrafts(props.node.id)
  }
  defineExpose({ hasDraft, flushDraft })

  function onJoinModeChange(value: JoinMode) {
    if (!isCurrent() || props.readonly || !store.editable) return
    if (thresholdDraft.value) {
      local.value.joinMode = readAttrs(props.node).joinMode
      ElMessage.warning(t('workflowDesignerMvp.drafts.resolveThresholdBeforeMode'))
      return
    }
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
    if (!isCurrent() || props.readonly || !store.editable) return
    const draft = store.getInspectorDraft('gatewayThreshold', props.node.id)
    if (draft && !store.validInspectorDraft(draft)) return
    local.value.joinThreshold = value
    store.updateNode(props.node.id, { attrs: { joinThreshold: value } })
    store.setInspectorDraft('gatewayThreshold', props.node.id, value == null ? '' : String(value))
  }

  function captureThreshold(event: Event) {
    const target = event.target
    if (isCurrent() && !props.readonly && target instanceof HTMLInputElement) {
      store.setInspectorDraft('gatewayThreshold', id, target.value, scope)
    }
  }

  function applyThresholdDraft() {
    if (!isCurrent() || props.readonly || !store.editable) return
    store.resolveInspectorDraft('gatewayThreshold', id, 'apply')
  }

  async function discardThresholdDraft() {
    const draft = thresholdDraft.value
    if (!draft || !isCurrent()) return
    try {
      await ElMessageBox.confirm(t('workflowDesignerMvp.drafts.discardConfirm'), undefined, {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
      if (!isCurrent() || store.getInspectorDraft('gatewayThreshold', id) !== draft) return
      store.resolveInspectorDraft('gatewayThreshold', id, 'discard')
      local.value.joinThreshold = readAttrs(props.node).joinThreshold
    } catch {
      // 取消时保留阈值草稿。
    }
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
    <el-form-item
      :label="t('workflowDesignerMvp.field.nodeName')"
      :error="
        Array.from(localName).length > 256
          ? t('workflowDesignerMvp.validation.nodeNameTooLong')
          : undefined
      "
      @input.capture="captureName"
    >
      <el-input
        :model-value="localName"
        :readonly="props.readonly"
        @update:model-value="updateName"
        @blur="flushDraft"
      />
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
        :error="localizedFieldError('joinMode')"
        required
      >
        <el-radio-group
          v-model="local.joinMode"
          :disabled="props.readonly"
          @change="onJoinModeChange($event as JoinMode)"
        >
          <el-radio-button value="ALL">{{
            t('workflowDesignerMvp.joinModeLabels.ALL')
          }}</el-radio-button>
          <el-radio-button value="ANY">{{
            t('workflowDesignerMvp.joinModeLabels.ANY')
          }}</el-radio-button>
          <el-radio-button value="N_OF">{{
            t('workflowDesignerMvp.joinModeLabels.N_OF')
          }}</el-radio-button>
        </el-radio-group>
        <div class="gateway-inspector__hint">
          {{ t(`workflowDesignerMvp.joinModeDescription.${local.joinMode ?? 'ALL'}`) }}
        </div>
      </el-form-item>
      <div
        v-if="thresholdDraft"
        class="gateway-inspector__draft"
        data-testid="gateway-threshold-draft"
        role="status"
      >
        <span>{{ t('workflowDesignerMvp.drafts.resolveThresholdBeforeMode') }}</span>
        <el-button
          size="small"
          :disabled="props.readonly || !store.validInspectorDraft(thresholdDraft)"
          data-testid="gateway-threshold-apply"
          @click="applyThresholdDraft"
          >{{ t('workflowDesignerMvp.drafts.useDraft') }}</el-button
        >
        <el-button
          size="small"
          data-testid="gateway-threshold-discard"
          @click="discardThresholdDraft"
        >
          {{ t('workflowDesignerMvp.drafts.discard') }}
        </el-button>
      </div>
      <el-form-item
        v-if="local.joinMode === 'N_OF'"
        :label="t('workflowDesignerMvp.field.joinThreshold')"
        :error="localizedFieldError('joinThreshold', { count: incomingCount })"
        required
        @input.capture="captureThreshold"
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

  .gateway-inspector__draft {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .gateway-inspector :deep(.el-alert) {
    margin-bottom: 14px;
  }

  .gateway-inspector :deep(.el-input-number) {
    width: 100%;
  }
</style>
