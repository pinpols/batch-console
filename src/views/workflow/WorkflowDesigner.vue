<template>
  <PageContainer class="workflow-designer-page">
    <!-- 离屏模板图：供 X6 Dnd 生成与画布一致的拖拽预览 -->
    <div ref="dndPaletteRef" class="workflow-dnd-palette-host" aria-hidden="true" />

    <section class="workflow-context app-surface" :aria-label="t('workflowDesigner.ariaContext')">
      <div class="workflow-context__main">
        <div class="workflow-context__title-row">
          <h1 class="workflow-context__title">{{ workflowContextTitle }}</h1>
          <el-tag
            v-if="workflowContextCode"
            class="workflow-context__tag"
            size="small"
            effect="plain"
          >
            {{ workflowContextCode }}
          </el-tag>
          <el-tag
            v-if="workflowDefinition"
            class="workflow-context__tag"
            :type="workflowDefinition.enabled ? 'success' : 'info'"
            size="small"
            effect="plain"
          >
            {{
              workflowDefinition.enabled
                ? t('workflowDesigner.tagEnabled')
                : t('workflowDesigner.tagDisabled')
            }}
          </el-tag>
        </div>
        <p class="workflow-context__desc">{{ workflowContextDesc }}</p>
      </div>

      <div class="workflow-context__metrics" :aria-label="t('workflowDesigner.ariaCanvasState')">
        <div class="workflow-context-metric">
          <span class="workflow-context-metric__label">{{
            t('workflowDesigner.metricNodes')
          }}</span>
          <strong>{{ stats.nodes }}</strong>
        </div>
        <div class="workflow-context-metric">
          <span class="workflow-context-metric__label">{{
            t('workflowDesigner.metricEdges')
          }}</span>
          <strong>{{ stats.edges }}</strong>
        </div>
        <div class="workflow-context-metric">
          <span class="workflow-context-metric__label">
            {{ t('workflowDesigner.metricValidation') }}
          </span>
          <strong :class="{ 'is-danger': validationErrorCount > 0 }">
            {{ validationSummary }}
          </strong>
        </div>
        <div class="workflow-context-metric workflow-context-metric--wide">
          <span class="workflow-context-metric__label">{{
            t('workflowDesigner.metricDraft')
          }}</span>
          <strong>{{ draftSavedDisplay.main }}</strong>
          <span class="workflow-context-metric__sub">{{ draftSourceLabel }}</span>
        </div>
      </div>

      <div class="workflow-context__actions">
        <el-button :loading="definitionsLoading" @click="reloadDefinitions">
          {{ t('workflowDesigner.btnSyncDefinitions') }}
        </el-button>
        <el-button type="primary" :loading="loadingWorkflow" @click="reloadWorkflow">
          {{ t('workflowDesigner.btnReloadCanvas') }}
        </el-button>
        <el-tooltip :content="t('workflowDesigner.docsTooltip')" placement="bottom">
          <el-button :icon="Reading" @click="docsDrawerOpen = true">
            {{ t('workflowDesigner.btnDocs') }}
          </el-button>
        </el-tooltip>
      </div>
    </section>

    <DocsDrawer v-model="docsDrawerOpen" doc-key="adr-009-workflow-param-dsl" />

    <SectionCard class="workflow-shell workflow-page-card">
      <div class="workflow-toolbar">
        <div class="workflow-toolbar__section workflow-toolbar__section--object">
          <span class="workflow-toolbar__eyebrow">{{ t('workflowDesigner.eyebrowObject') }}</span>
          <div class="workflow-toolbar__controls workflow-toolbar__controls--object">
            <el-select
              v-model="selectedWorkflowCode"
              filterable
              clearable
              :placeholder="t('workflowDesigner.selectPlaceholder')"
              class="workflow-select"
              :loading="definitionsLoading"
            >
              <el-option
                v-for="item in definitionOptions"
                :key="item.workflowCode"
                :label="`${item.workflowName} · ${item.workflowCode}`"
                :value="item.workflowCode"
              />
            </el-select>
            <div class="workflow-toolbar__meta">
              <el-tag
                v-if="workflowDefinition"
                :type="workflowDefinition.enabled ? 'success' : 'info'"
                class="workflow-toolbar__tag"
                effect="plain"
                size="small"
              >
                {{ workflowDefinition.workflowType }}
              </el-tag>
              <el-tag
                v-if="draftSource === 'local-draft'"
                type="warning"
                class="workflow-toolbar__tag"
                effect="plain"
                size="small"
              >
                {{ t('workflowDesigner.tagLocalDraft') }}
              </el-tag>
              <el-tag
                v-else-if="draftSource === 'backend'"
                type="success"
                class="workflow-toolbar__tag"
                effect="plain"
                size="small"
              >
                {{ t('workflowDesigner.tagBackend') }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="workflow-toolbar__section workflow-toolbar__section--actions">
          <span class="workflow-toolbar__eyebrow">{{ t('workflowDesigner.eyebrowCanvas') }}</span>
          <div class="workflow-toolbar__actions">
            <el-button-group class="workflow-toolbar__btn-group">
              <el-button
                :disabled="!canUndo"
                :title="`${t('workflowDesigner.btnUndo')} (Ctrl+Z)`"
                @click="undo"
              >
                {{ t('workflowDesigner.btnUndo') }}
              </el-button>
              <el-button
                :disabled="!canRedo"
                :title="`${t('workflowDesigner.btnRedo')} (Ctrl+Y)`"
                @click="redo"
              >
                {{ t('workflowDesigner.btnRedo') }}
              </el-button>
              <el-button :disabled="!selectedWorkflowCode" @click="reLayout">
                {{ t('workflowDesigner.btnAutoLayout') }}
              </el-button>
              <el-button :disabled="!workflowDefinition" @click="applyDefinitionForm">
                {{ t('workflowDesigner.btnApplyDefinitionForm') }}
              </el-button>
            </el-button-group>
            <el-button-group class="workflow-toolbar__btn-group">
              <el-button :disabled="!graphReady" @click="saveDraft">
                {{ t('workflowDesigner.btnSaveDraft') }}
              </el-button>
              <el-button :disabled="!graphReady" @click="copyDsl">
                {{ t('workflowDesigner.btnCopyDsl') }}
              </el-button>
              <el-button :disabled="!graphReady" @click="clearDraft">
                {{ t('workflowDesigner.btnClearDraft') }}
              </el-button>
            </el-button-group>
            <el-button-group class="workflow-toolbar__btn-group">
              <el-button :disabled="!graphReady" @click="exportManifest">
                {{ t('workflowDesigner.btnExportJson') }}
              </el-button>
              <el-button
                :disabled="!graphReady || !selectedWorkflowCode"
                @click="triggerImportManifest"
              >
                {{ t('workflowDesigner.btnImportJson') }}
              </el-button>
            </el-button-group>
            <input
              ref="manifestFileInput"
              type="file"
              accept="application/json,.json"
              style="display: none"
              @change="onManifestFileChange"
            />
            <el-button
              type="primary"
              :disabled="!graphReady || !selectedWorkflowCode"
              :loading="submittingToBackend"
              @click="submitToBackend"
            >
              {{ t('workflowDesigner.btnSubmitBackend') }}
            </el-button>
          </div>
        </div>
      </div>

      <div
        class="workflow-layout"
        :class="{ 'is-dragging': splitterDrag !== null }"
        :style="{
          '--workflow-left-w': `${leftPanelPx}px`,
          '--workflow-right-w': `${rightPanelPx}px`,
        }"
      >
        <aside class="workflow-panel workflow-panel--left">
          <SectionCard class="workflow-card">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><Grid /></el-icon>
                {{ t('workflowDesigner.sectionLibrary') }}
              </span>
            </template>
            <div class="workflow-node-library">
              <button
                v-for="kind in nodeKinds"
                :key="kind.kind"
                type="button"
                class="workflow-node-pill"
                :class="`workflow-node-pill--${kind.kind.toLowerCase()}`"
                :disabled="!graphReady"
                :title="t('workflowDesigner.libraryTooltip')"
                @pointerdown="onLibraryNodePointerDown(kind.kind, $event)"
              >
                <span class="workflow-node-pill__dot" aria-hidden="true" />
                <span class="workflow-node-pill__label">{{ kind.label }}</span>
              </button>
            </div>
          </SectionCard>

          <SectionCard class="workflow-card">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><DataLine /></el-icon>
                {{ t('workflowDesigner.sectionInfo') }}
              </span>
            </template>
            <div class="workflow-summary">
              <div class="workflow-summary__col">
                <span>{{ t('workflowDesigner.summaryNodes') }}</span>
                <strong>{{ stats.nodes }}</strong>
              </div>
              <div class="workflow-summary__col">
                <span>{{ t('workflowDesigner.summaryEdges') }}</span>
                <strong>{{ stats.edges }}</strong>
              </div>
              <div class="workflow-summary__col workflow-summary__col--draft">
                <el-tooltip
                  :content="draftSavedDisplay.tip || undefined"
                  placement="top"
                  :disabled="!draftSavedDisplay.tip"
                >
                  <div class="workflow-summary__draft">
                    <span>{{ t('workflowDesigner.summaryLocalSave') }}</span>
                    <strong class="workflow-summary__draft-main">
                      {{ draftSavedDisplay.main }}
                    </strong>
                    <span class="workflow-summary__sub">{{ draftSavedDisplay.sub }}</span>
                  </div>
                </el-tooltip>
              </div>
            </div>
          </SectionCard>

          <SectionCard class="workflow-card workflow-card--validation">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><CircleCheck /></el-icon>
                {{ t('workflowDesigner.sectionValidation') }}
              </span>
            </template>
            <div
              class="workflow-validation-scroll"
              role="region"
              :aria-label="t('workflowDesigner.ariaValidationList')"
            >
              <ul v-if="validationIssues.length" class="workflow-issues">
                <li
                  v-for="(issue, idx) in validationIssues"
                  :key="`${idx}:${issue.level}:${issue.message}`"
                  class="workflow-issues__item"
                >
                  <button
                    type="button"
                    class="workflow-issue"
                    :class="[
                      `is-${issue.level}`,
                      { 'is-actionable': isValidationIssueActionable(issue) },
                    ]"
                    :disabled="!isValidationIssueActionable(issue)"
                    @click="focusValidationIssue(issue)"
                  >
                    <span class="workflow-issue__level">
                      {{ levelLabel(issue.level) }}
                    </span>
                    <span class="workflow-issue__text">{{ issue.message }}</span>
                    <span v-if="isValidationIssueActionable(issue)" class="workflow-issue__action">
                      {{ t('workflowDesigner.validationActionLocate') }}
                    </span>
                  </button>
                </li>
              </ul>
              <div v-else class="workflow-empty workflow-empty--validation">
                {{ t('workflowDesigner.validationEmpty') }}
              </div>
            </div>
          </SectionCard>

          <SectionCard class="workflow-card workflow-card--legend">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><Guide /></el-icon>
                {{ t('workflowDesigner.sectionLegend') }}
              </span>
            </template>
            <p class="workflow-legend__hint">
              {{ t('workflowDesigner.legendNodeLibrary')
              }}<strong>{{ t('workflowDesigner.legendDragHint') }}</strong>
              {{ t('workflowDesigner.legendAddNode') }}
              <strong>{{ t('workflowDesigner.legendRightAnchor') }}</strong>
              {{ t('workflowDesigner.legendConnectTo') }}
              <strong>{{ t('workflowDesigner.legendLeftAnchor') }}</strong>
              {{ t('workflowDesigner.legendPanTail') }}
            </p>
            <ul class="workflow-legend" :aria-label="t('workflowDesigner.ariaLegend')">
              <li v-for="ek in edgeKinds" :key="ek.kind" class="workflow-legend__row">
                <span
                  class="workflow-legend__swatch"
                  :style="{ background: edgeLegendColor(ek.kind) }"
                  aria-hidden="true"
                />
                <span class="workflow-legend__label">{{ ek.label }}</span>
                <code class="workflow-legend__code">{{ ek.kind }}</code>
              </li>
            </ul>
          </SectionCard>
        </aside>

        <div
          class="workflow-splitter workflow-splitter--left"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('workflowDesigner.ariaSplitterLeft')"
          :title="t('workflowDesigner.splitterTitle')"
          @mousedown.prevent="onSplitterDown('left', $event)"
        />

        <main class="workflow-canvas-shell">
          <!--
            提示文案不可放在 .workflow-canvas-frame 内：X6 autoResize 监听的是 graph.container 的父元素，
            会把父级 contentRect.height 整块赋给画布。若父级高度 = 画布 + 文案，会形成每轮 + 文案高的正反馈，导致无限增高。
          -->
          <div class="workflow-canvas-frame" :class="{ 'is-resetting': canvasResetting }">
            <div ref="canvasRef" class="workflow-canvas" />
            <div v-show="selectedWorkflowCode && graphReady" class="workflow-canvas-hud">
              <div class="workflow-minimap-stack">
                <div
                  ref="minimapHostRef"
                  class="workflow-minimap-host"
                  :aria-label="t('workflowDesigner.ariaMinimap')"
                />
                <span class="workflow-minimap-coords" :title="minimapCoordsTitle">{{
                  minimapCoordsLabel
                }}</span>
              </div>
              <div
                class="workflow-zoom-toolbar"
                role="toolbar"
                :aria-label="t('workflowDesigner.ariaZoomToolbar')"
              >
                <button
                  type="button"
                  class="workflow-zoom-toolbar__btn"
                  :title="t('workflowDesigner.btnZoomOut')"
                  @click="nudgeGraphZoom(-1)"
                >
                  −
                </button>
                <span class="workflow-zoom-toolbar__pct">{{ graphZoomPercentLabel }}</span>
                <button
                  type="button"
                  class="workflow-zoom-toolbar__btn"
                  :title="t('workflowDesigner.btnZoomIn')"
                  @click="nudgeGraphZoom(1)"
                >
                  +
                </button>
                <button
                  type="button"
                  class="workflow-zoom-toolbar__fit"
                  :title="t('workflowDesigner.btnFitTitle')"
                  @click="fitGraphZoom"
                >
                  {{ t('workflowDesigner.btnFit') }}
                </button>
              </div>
            </div>
            <div
              v-if="loadingWorkflow && selectedWorkflowCode"
              class="workflow-canvas-loading"
              v-loading="true"
              :element-loading-text="t('workflowDesigner.canvasLoading')"
            />
            <div v-if="!selectedWorkflowCode" class="workflow-canvas-empty">
              <el-empty :description="t('workflowDesigner.canvasEmpty')" :image-size="80">
                <template #image>
                  <div class="workflow-canvas-empty__illus" aria-hidden="true" />
                </template>
              </el-empty>
            </div>
          </div>
          <p class="workflow-canvas-hint">
            {{ t('workflowDesigner.canvasHintTail1') }}
            <kbd>Ctrl</kbd>
            /
            <kbd>⌘</kbd>
            {{ t('workflowDesigner.canvasHintTail2') }}
            <kbd>Delete</kbd>
            {{ t('workflowDesigner.canvasHintDelete') }}
            <kbd>Shift</kbd>
            +
            <kbd>T</kbd>
            /
            <kbd>D</kbd>
            /
            <kbd>J</kbd>
            {{ t('workflowDesigner.canvasHintShiftKey') }}
          </p>
        </main>

        <div
          class="workflow-splitter workflow-splitter--right"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('workflowDesigner.ariaSplitterRight')"
          :title="t('workflowDesigner.splitterTitle')"
          @mousedown.prevent="onSplitterDown('right', $event)"
        />

        <aside class="workflow-panel workflow-panel--right">
          <WorkflowInspectorWorkflowForm :workflow-form="workflowForm" />

          <SectionCard class="workflow-card">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><EditPen /></el-icon>
                {{ t('workflowDesigner.sectionSelected') }}
              </span>
            </template>
            <WorkflowInspectorNodeForm
              v-if="selectedKind === 'node'"
              :node-form="nodeForm"
              @apply="applyNodeForm"
              @duplicate="duplicateSelectedNode"
              @remove="removeSelected"
              @add-downstream="addDownstreamNode"
            />

            <WorkflowInspectorEdgeForm
              v-else-if="selectedKind === 'edge'"
              :edge-form="edgeForm"
              @apply="applyEdgeForm"
              @remove="removeSelected"
            />

            <el-empty
              v-else
              class="workflow-inspector-empty"
              :description="t('workflowDesigner.inspectorEmpty')"
              :image-size="64"
            />
          </SectionCard>

          <SectionCard class="workflow-card workflow-card--dsl">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><Document /></el-icon>
                {{ t('workflowDesigner.sectionDsl') }}
              </span>
            </template>
            <el-collapse v-model="dslPanelOpen" class="workflow-dsl-collapse">
              <el-collapse-item name="preview">
                <template #title>
                  <div class="workflow-dsl-collapse__head">
                    <span class="workflow-dsl-collapse__title">
                      {{ t('workflowDesigner.dslPreviewTitle') }}
                    </span>
                    <el-tag
                      size="small"
                      type="info"
                      effect="plain"
                      class="workflow-dsl-collapse__tag"
                    >
                      {{ t('workflowDesigner.dslLines', { n: dslPreviewLines }) }}
                    </el-tag>
                  </div>
                </template>
                <el-input
                  :model-value="dslPreview"
                  type="textarea"
                  :rows="14"
                  readonly
                  class="workflow-dsl-input"
                />
              </el-collapse-item>
            </el-collapse>
          </SectionCard>
        </aside>
      </div>
    </SectionCard>

    <Teleport to="body">
      <div
        v-show="canvasContextMenu.visible"
        ref="canvasContextMenuRef"
        class="workflow-canvas-ctx-menu"
        role="menu"
        :style="{
          left: `${canvasContextMenu.x}px`,
          top: `${canvasContextMenu.y}px`,
        }"
        @contextmenu.prevent
      >
        <template v-if="canvasContextMenu.type === 'node'">
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item"
            role="menuitem"
            @click="ctxMenuEditNode"
          >
            {{ t('workflowDesigner.ctxEditInSidebar') }}
          </button>
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item"
            role="menuitem"
            @click="ctxMenuDuplicateFromContext"
          >
            {{ t('workflowDesigner.ctxDuplicateNode') }}
          </button>
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item workflow-canvas-ctx-menu__item--danger"
            role="menuitem"
            @click="ctxMenuDeleteNodeFromContext"
          >
            {{ t('workflowDesigner.ctxDeleteNode') }}
          </button>
        </template>
        <template v-else-if="canvasContextMenu.type === 'edge'">
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item"
            role="menuitem"
            @click="ctxMenuEditEdge"
          >
            {{ t('workflowDesigner.ctxEditInSidebar') }}
          </button>
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item workflow-canvas-ctx-menu__item--danger"
            role="menuitem"
            @click="ctxMenuDeleteEdgeFromContext"
          >
            {{ t('workflowDesigner.ctxDeleteEdge') }}
          </button>
        </template>
      </div>
    </Teleport>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    CircleCheck,
    DataLine,
    Document,
    EditPen,
    Grid,
    Guide,
    Reading,
  } from '@element-plus/icons-vue'
  import DocsDrawer from '@/components/common/DocsDrawer.vue'
  import { useAppStore } from '@/stores/app'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantReload } from '@/composables/useTenantReload'
  import PageContainer from '@/components/common/PageContainer.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import {
    nodeKinds,
    edgeKinds,
    edgeLegendColor,
    isValidationIssueActionable,
    copyWorkflowForm,
    normalizeWorkflowDefinition,
    type ValidationIssueLevel,
  } from './composables/workflowConstants'
  import { useWorkflowSplitter } from './composables/useWorkflowSplitter'
  import { useWorkflowGraph } from './composables/useWorkflowGraph'
  import { useWorkflowInspector } from './composables/useWorkflowInspector'
  import { useWorkflowData } from './composables/useWorkflowData'
  import { useWorkflowDag } from './composables/useWorkflowDag'
  import WorkflowInspectorWorkflowForm from './components/WorkflowInspectorWorkflowForm.vue'
  import WorkflowInspectorNodeForm from './components/WorkflowInspectorNodeForm.vue'
  import WorkflowInspectorEdgeForm from './components/WorkflowInspectorEdgeForm.vue'

  const app = useAppStore()
  const tenant = useTenantStore()
  const { t } = useI18n({ useScope: 'global' })

  function levelLabel(level: ValidationIssueLevel) {
    return level === 'error' ? t('workflowDesigner.levelError') : t('workflowDesigner.levelWarning')
  }

  // ─── DOM refs ──────────────────────────────────────────────────────────────
  const canvasRef = ref<HTMLDivElement | null>(null)
  const minimapHostRef = ref<HTMLDivElement | null>(null)
  const dndPaletteRef = ref<HTMLDivElement | null>(null)

  // ─── Splitter ──────────────────────────────────────────────────────────────
  const {
    leftPanelPx,
    rightPanelPx,
    splitterDrag,
    onSplitterDown,
    restorePanelWidths,
    cleanupSplitter,
  } = useWorkflowSplitter()

  // ─── Inspector (needs graph, so we forward refs) ───────────────────────────
  // We need selectedCellId as a shared ref between inspector and graph
  const selectedCellId = ref('')

  // 上下文文档抽屉:点击工具栏"DSL 文档"打开,iframe 加载 /docs/architecture/adr/ADR-009-...
  const docsDrawerOpen = ref(false)

  // ─── Graph ─────────────────────────────────────────────────────────────────
  // Inspector 依赖 graph、graph 的事件需要 inspector 的 setSelectedCell 等 —— 循环
  // 依赖通过先建 graph(无 inspector 依赖)、再建 inspector、最后
  // bindInspectorCallbacks 三步打破。之前用父级 `let _X = () => {}` 占位 + 函数包装
  // 传 deps,暴露面多、占位期误用难察觉,现在占位已下沉到 useWorkflowGraph 内部。
  const graphModule = useWorkflowGraph({
    canvasRef,
    minimapHostRef,
    dndPaletteRef,
    selectedCellId,
  })

  const {
    graph,
    graphReady,
    canvasResetting,
    graphVersion,
    graphVersionLight,
    canvasContextMenu,
    canvasContextMenuRef,
    graphZoomPercentLabel,
    closeCanvasContextMenu,
    onDocumentPointerCloseContextMenu,
    nudgeGraphZoom,
    fitGraphZoom,
    canUndo,
    canRedo,
    undo,
    redo,
    copySelection,
    cutSelection,
    pasteFromClipboard,
    duplicateSelection,
    scheduleEdgeZOrder,
    syncGraphDerivedState,
    bindDerivedStateCallbacks,
    bindInspectorCallbacks,
    cancelPositionDerivedSyncTimer,
    onLibraryNodePointerDown,
    currentWorkflowExportNodes,
    currentWorkflowExportEdges,
    allocateNodeCodeForGraph,
    allocateEdgeId,
    graphNodesSnapshot,
    graphEdgesSnapshot,
    edgeDraftFromGraphCell,
    resetGraph,
    createGraph,
    disposeGraph,
  } = graphModule

  // ─── Inspector ─────────────────────────────────────────────────────────────
  const inspectorModule = useWorkflowInspector({
    graph,
    graphReady,
    graphVersionLight,
    selectedCellId,
    syncGraphDerivedState,
    scheduleEdgeZOrder,
  })

  const {
    selectedKind,
    workflowForm,
    nodeForm,
    edgeForm,
    stats,
    minimapCoordsTitle,
    minimapCoordsLabel,
    setSelectedCell,
    ensureSingleTerminal,
    focusValidationIssue,
    applyNodeForm,
    applyEdgeForm,
    refreshGraphTheme,
    setNodeStyle,
    setEdgeStyle,
    renderCellAppearance,
    selectFallbackAfterDelete,
  } = inspectorModule

  // 绑定 inspector 回调到 graph 模块(替代旧的 `let _X = () => {}` 占位)。
  bindInspectorCallbacks({ setSelectedCell, setNodeStyle, setEdgeStyle, renderCellAppearance })

  // ─── Data ──────────────────────────────────────────────────────────────────
  const dataModule = useWorkflowData({
    graph,
    graphReady,
    graphVersion,
    selectedCellId,
    workflowForm,
    currentWorkflowExportNodes,
    currentWorkflowExportEdges,
    graphNodesSnapshot,
    graphEdgesSnapshot,
    resetGraph,
    syncGraphDerivedState,
    edgeDraftFromGraphCell,
  })

  const {
    definitionsLoading,
    loadingWorkflow,
    submittingToBackend,
    selectedWorkflowCode,
    definitionOptions,
    workflowDefinition,
    draftSource,
    draftUpdatedAt,
    validationIssues,
    dslPanelOpen,
    routeWorkflowCode,
    selectedDefinition,
    draftSavedDisplay,
    dslPreview,
    dslPreviewLines,
    validateGraph,
    queueDraftSave,
    saveDraft,
    clearDraft,
    flushPendingDraft,
    loadDefinitions,
    loadWorkflow,
    reloadDefinitions,
    reloadWorkflow,
    applyDefinitionForm,
    submitToBackend,
    copyDsl,
    exportManifest,
    importManifestFromFile,
    getSuppressDefinitionFormSync,
    clearSuppressDefinitionFormSync,
    router,
  } = dataModule

  const manifestFileInput = ref<HTMLInputElement | null>(null)
  function triggerImportManifest() {
    manifestFileInput.value?.click()
  }
  async function onManifestFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) await importManifestFromFile(file)
    // 清空 input 值，允许下次选同一文件也触发 change
    if (input) input.value = ''
  }

  const workflowContextCode = computed(() => selectedWorkflowCode.value.trim())
  const workflowContextTitle = computed(() => {
    if (!selectedWorkflowCode.value) return t('workflowDesigner.titleUnselected')
    return (
      selectedDefinition.value?.workflowName ||
      workflowDefinition.value?.workflowName ||
      selectedWorkflowCode.value
    )
  })
  const workflowContextDesc = computed(() => {
    if (!selectedWorkflowCode.value) return t('workflowDesigner.descUnselected')
    return (
      workflowDefinition.value?.description ||
      selectedDefinition.value?.description ||
      t('workflowDesigner.descNone')
    )
  })
  const validationErrorCount = computed(
    () => validationIssues.value.filter((issue) => issue.level === 'error').length,
  )
  const validationWarningCount = computed(
    () => validationIssues.value.filter((issue) => issue.level === 'warning').length,
  )
  const validationSummary = computed(() => {
    if (validationErrorCount.value > 0)
      return t('workflowDesigner.validationErrors', { n: validationErrorCount.value })
    if (validationWarningCount.value > 0)
      return t('workflowDesigner.validationWarnings', { n: validationWarningCount.value })
    return t('workflowDesigner.validationPass')
  })
  const draftSourceLabel = computed(() =>
    draftSource.value === 'local-draft'
      ? t('workflowDesigner.sourceLocal')
      : t('workflowDesigner.sourceBackend'),
  )

  // Bind validation + draft callbacks into the graph module
  bindDerivedStateCallbacks(validateGraph, queueDraftSave, validationIssues)

  // ─── DAG ───────────────────────────────────────────────────────────────────
  const {
    addDownstreamNode,
    duplicateSelectedNode,
    removeSelected,
    reLayout,
    onKeydown,
    ctxMenuEditNode,
    ctxMenuDuplicateFromContext,
    ctxMenuDeleteNodeFromContext,
    ctxMenuEditEdge,
    ctxMenuDeleteEdgeFromContext,
  } = useWorkflowDag({
    graph,
    graphReady,
    selectedKind,
    selectedCellId,
    canvasContextMenu,
    setSelectedCell,
    ensureSingleTerminal,
    selectFallbackAfterDelete,
    setNodeStyle,
    setEdgeStyle,
    syncGraphDerivedState,
    scheduleEdgeZOrder,
    closeCanvasContextMenu,
    allocateNodeCodeForGraph,
    allocateEdgeId,
    currentWorkflowExportNodes,
    currentWorkflowExportEdges,
    copySelection,
    cutSelection,
    pasteFromClipboard,
    duplicateSelection,
  })

  // ─── Watchers ──────────────────────────────────────────────────────────────

  let routeChangeByUs = false

  watch(
    selectedWorkflowCode,
    (code) => {
      closeCanvasContextMenu()
      if (!code) {
        workflowDefinition.value = null
        copyWorkflowForm(
          {
            workflowCode: '',
            workflowName: '',
            workflowType: '',
            enabled: true,
            description: '',
          },
          workflowForm,
        )
        return
      }
      if (routeWorkflowCode.value !== code) {
        routeChangeByUs = true
        void router
          .replace({ path: `/workflow/designer/${encodeURIComponent(code)}` })
          .finally(() => {
            routeChangeByUs = false
          })
      }
      void loadWorkflow()
    },
    { immediate: true },
  )

  useTenantReload(() => {
    selectedWorkflowCode.value = ''
    definitionOptions.value = []
    workflowDefinition.value = null
    clearDraft(false)
    void loadDefinitions()
  })

  watch(
    () => routeWorkflowCode.value,
    (code) => {
      if (!routeChangeByUs && code && code !== selectedWorkflowCode.value) {
        selectedWorkflowCode.value = code
      }
    },
  )

  watch(
    () => selectedDefinition.value,
    (def) => {
      if (!def) return
      if (getSuppressDefinitionFormSync()) {
        clearSuppressDefinitionFormSync()
        return
      }
      copyWorkflowForm(normalizeWorkflowDefinition(def, tenant.tenantId), workflowForm)
    },
  )

  watch(
    () => app.theme,
    () => {
      refreshGraphTheme()
    },
  )

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * B7:标签页 / 浏览器关闭时 onBeforeUnmount 不保证触发(尤其移动端 /
   * 后台杀进程),pending 的 draft 防抖会丢失。用 beforeunload + visibilitychange
   * 兜底 flush。注意:不在 handler 里弹 confirm,只做 best-effort 持久化。
   */
  function flushDraftOnExit() {
    flushPendingDraft()
  }
  function onVisibilityChangeMaybeFlush() {
    if (document.visibilityState === 'hidden') flushPendingDraft()
  }

  onMounted(() => {
    window.addEventListener('mousedown', onDocumentPointerCloseContextMenu, true)
    restorePanelWidths()
    createGraph()
    window.addEventListener('keydown', onKeydown)
    refreshGraphTheme()
    window.addEventListener('beforeunload', flushDraftOnExit)
    document.addEventListener('visibilitychange', onVisibilityChangeMaybeFlush)
  })

  /**
   * KeepAlive 双挂载:DefaultLayout 用 <KeepAlive :key="r.fullPath">,本
   * 页 watcher router.replace 会把 fullPath 从 /workflow/designer 改成
   * /workflow/designer/<code> → key 变化 → 旧实例进 cache,新实例挂载。
   *
   * cache 中的旧实例不会跑 onBeforeUnmount,graph 一直挂着,每次跳路径
   * 累积一份 x6 Graph + 事件监听 + DOM。
   *
   * 策略:用 onDeactivated 在"进缓存"时主动 disposeGraph,onActivated
   * 回到前台时如果 graph 为空再重建一次。首次挂载时 onMounted 已建好,
   * 紧跟的 onActivated 里 graph.value 非空 → 跳过,不重复构造。
   */
  onDeactivated(() => {
    flushPendingDraft()
    cancelPositionDerivedSyncTimer()
    disposeGraph()
  })

  onActivated(() => {
    if (!graph.value) {
      createGraph()
      refreshGraphTheme()
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('mousedown', onDocumentPointerCloseContextMenu, true)
    window.removeEventListener('beforeunload', flushDraftOnExit)
    document.removeEventListener('visibilitychange', onVisibilityChangeMaybeFlush)
    cleanupSplitter()
    window.removeEventListener('keydown', onKeydown)
    flushPendingDraft()
    cancelPositionDerivedSyncTimer()
    disposeGraph()
  })
</script>
<style src="./WorkflowDesigner.css"></style>
