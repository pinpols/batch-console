<template>
  <PageContainer class="workflow-designer-page">
    <!-- 离屏模板图：供 X6 Dnd 生成与画布一致的拖拽预览 -->
    <div ref="dndPaletteRef" class="workflow-dnd-palette-host" aria-hidden="true" />

    <PageHeader title="Workflow 编排" :description="subtitle" show-description compact>
      <template #actions>
        <el-button :loading="definitionsLoading" @click="reloadDefinitions">同步定义列表</el-button>
        <el-button type="primary" :loading="loadingWorkflow" @click="reloadWorkflow">
          重新加载画布
        </el-button>
      </template>
    </PageHeader>

    <SectionCard class="workflow-shell workflow-page-card">
      <div class="workflow-toolbar">
        <div class="workflow-toolbar__section workflow-toolbar__section--object">
          <span class="workflow-toolbar__eyebrow">编排对象</span>
          <div class="workflow-toolbar__controls workflow-toolbar__controls--object">
            <el-select
              v-model="selectedWorkflowCode"
              filterable
              clearable
              placeholder="选择 workflow"
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
                本地草稿
              </el-tag>
              <el-tag
                v-else-if="draftSource === 'backend'"
                type="success"
                class="workflow-toolbar__tag"
                effect="plain"
                size="small"
              >
                后端数据
              </el-tag>
            </div>
          </div>
        </div>

        <div class="workflow-toolbar__section workflow-toolbar__section--actions">
          <span class="workflow-toolbar__eyebrow">画布</span>
          <div class="workflow-toolbar__actions">
            <el-button-group class="workflow-toolbar__btn-group">
              <el-button :disabled="!selectedWorkflowCode" @click="reLayout">自动布局</el-button>
              <el-button :disabled="!workflowDefinition" @click="applyDefinitionForm">
                应用流程信息
              </el-button>
            </el-button-group>
            <el-button-group class="workflow-toolbar__btn-group">
              <el-button :disabled="!graphReady" @click="saveDraft">保存草稿</el-button>
              <el-button :disabled="!graphReady" @click="copyDsl">复制 DSL</el-button>
              <el-button :disabled="!graphReady" @click="clearDraft">清除草稿</el-button>
            </el-button-group>
            <el-button
              type="primary"
              :disabled="!graphReady || !selectedWorkflowCode"
              :loading="submittingToBackend"
              @click="submitToBackend"
            >
              提交到后端
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
                节点库
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
                title="按住左键拖到画布"
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
                编排信息
              </span>
            </template>
            <div class="workflow-summary">
              <div class="workflow-summary__col">
                <span>节点</span>
                <strong>{{ stats.nodes }}</strong>
              </div>
              <div class="workflow-summary__col">
                <span>连线</span>
                <strong>{{ stats.edges }}</strong>
              </div>
              <div class="workflow-summary__col workflow-summary__col--draft">
                <el-tooltip
                  :content="draftSavedDisplay.tip || undefined"
                  placement="top"
                  :disabled="!draftSavedDisplay.tip"
                >
                  <div class="workflow-summary__draft">
                    <span>本地保存</span>
                    <strong class="workflow-summary__draft-main">{{
                      draftSavedDisplay.main
                    }}</strong>
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
                校验结果
              </span>
            </template>
            <div class="workflow-validation-scroll" role="region" aria-label="校验提示列表">
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
                    <span class="workflow-issue__level">{{
                      validationIssueLevelLabel(issue.level)
                    }}</span>
                    <span class="workflow-issue__text">{{ issue.message }}</span>
                    <span v-if="isValidationIssueActionable(issue)" class="workflow-issue__action"
                      >定位</span
                    >
                  </button>
                </li>
              </ul>
              <div v-else class="workflow-empty workflow-empty--validation">
                当前 DAG 没有明显结构问题。
              </div>
            </div>
          </SectionCard>

          <SectionCard class="workflow-card workflow-card--legend">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><Guide /></el-icon>
                连线与图例
              </span>
            </template>
            <p class="workflow-legend__hint">
              节点库<strong>左键按住拖到画布</strong>添加节点；从节点
              <strong>右侧锚点</strong> 连到目标 <strong>左侧锚点</strong>；空白处拖动平移画布。
            </p>
            <ul class="workflow-legend" aria-label="边类型图例">
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
          aria-label="拖拽调整左侧栏宽度"
          title="拖拽调整宽度"
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
                <div ref="minimapHostRef" class="workflow-minimap-host" aria-label="画布缩略图" />
                <span class="workflow-minimap-coords" :title="minimapCoordsTitle">{{
                  minimapCoordsLabel
                }}</span>
              </div>
              <div class="workflow-zoom-toolbar" role="toolbar" aria-label="画布缩放">
                <button
                  type="button"
                  class="workflow-zoom-toolbar__btn"
                  title="缩小"
                  @click="nudgeGraphZoom(-1)"
                >
                  −
                </button>
                <span class="workflow-zoom-toolbar__pct">{{ graphZoomPercentLabel }}</span>
                <button
                  type="button"
                  class="workflow-zoom-toolbar__btn"
                  title="放大"
                  @click="nudgeGraphZoom(1)"
                >
                  +
                </button>
                <button
                  type="button"
                  class="workflow-zoom-toolbar__fit"
                  title="缩放以适应全部节点"
                  @click="fitGraphZoom"
                >
                  适应
                </button>
              </div>
            </div>
            <div
              v-if="loadingWorkflow && selectedWorkflowCode"
              class="workflow-canvas-loading"
              v-loading="true"
              element-loading-text="加载画布中..."
            />
            <div v-if="!selectedWorkflowCode" class="workflow-canvas-empty">
              <el-empty description="请选择 Workflow 后开始编排" :image-size="80">
                <template #image>
                  <div class="workflow-canvas-empty__illus" aria-hidden="true" />
                </template>
              </el-empty>
            </div>
          </div>
          <p class="workflow-canvas-hint">
            左侧节点库按住拖到画布添加 · 空白处拖拽平移 · 右下角缩略图拖拽视口 ·
            <kbd>Ctrl</kbd>
            /
            <kbd>⌘</kbd>
            + 滚轮缩放 · 右键节点/连线快捷操作 ·
            <kbd>Delete</kbd>
            删除 ·
            <kbd>Shift</kbd>
            +
            <kbd>T</kbd>
            /
            <kbd>D</kbd>
            /
            <kbd>J</kbd>
            快速加下游
          </p>
        </main>

        <div
          class="workflow-splitter workflow-splitter--right"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整右侧栏宽度"
          title="拖拽调整宽度"
          @mousedown.prevent="onSplitterDown('right', $event)"
        />

        <aside class="workflow-panel workflow-panel--right">
          <SectionCard class="workflow-card">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><Setting /></el-icon>
                流程属性
              </span>
            </template>
            <el-form label-position="top" class="workflow-form workflow-form--inspector">
              <el-form-item label="流程编码">
                <el-input
                  v-model="workflowForm.workflowCode"
                  disabled
                  size="small"
                  placeholder="只读"
                />
              </el-form-item>
              <el-form-item label="流程名称">
                <el-input
                  v-model="workflowForm.workflowName"
                  size="small"
                  placeholder="列表与画布展示名"
                />
              </el-form-item>
              <el-form-item label="流程类型">
                <el-input
                  v-model="workflowForm.workflowType"
                  size="small"
                  placeholder="如 PIPELINE / BATCH"
                />
              </el-form-item>
              <el-form-item label="启用">
                <el-switch v-model="workflowForm.enabled" size="small" />
              </el-form-item>
              <el-form-item label="说明">
                <el-input
                  v-model="workflowForm.description"
                  type="textarea"
                  :rows="2"
                  size="small"
                  placeholder="可选，简述用途"
                />
              </el-form-item>
            </el-form>
          </SectionCard>

          <SectionCard class="workflow-card">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><EditPen /></el-icon>
                选中对象
              </span>
            </template>
            <div v-if="selectedKind === 'node'">
              <el-form label-position="top" class="workflow-form workflow-form--inspector">
                <el-form-item label="节点编码">
                  <el-input v-model="nodeForm.nodeCode" disabled size="small" placeholder="只读" />
                </el-form-item>
                <el-form-item label="显示名称">
                  <el-input v-model="nodeForm.nodeName" size="small" placeholder="画布上标题" />
                </el-form-item>
                <el-form-item label="节点类型">
                  <el-radio-group
                    v-model="nodeForm.nodeType"
                    size="small"
                    class="workflow-inspector-radio-group"
                  >
                    <el-radio-button v-for="kind in nodeKinds" :key="kind.kind" :label="kind.kind">
                      {{ kind.label }}
                    </el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <div class="workflow-inspector-cols-2">
                  <el-form-item label="关联作业">
                    <el-input
                      v-model="nodeForm.relatedJobCode"
                      placeholder="作业编码，可空"
                      size="small"
                    />
                  </el-form-item>
                  <el-form-item label="关联管道">
                    <el-input
                      v-model="nodeForm.relatedPipelineCode"
                      placeholder="管道编码，可空"
                      size="small"
                    />
                  </el-form-item>
                </div>
                <div class="workflow-inspector-cols-2">
                  <el-form-item label="Worker">
                    <el-input
                      v-model="nodeForm.workerGroup"
                      size="small"
                      placeholder="分组，可空"
                    />
                  </el-form-item>
                  <el-form-item label="窗口">
                    <el-input v-model="nodeForm.windowCode" size="small" placeholder="窗口编码" />
                  </el-form-item>
                </div>
                <div class="workflow-inspector-cols-2">
                  <el-form-item label="排序">
                    <el-input-number
                      v-model="nodeForm.nodeOrder"
                      class="workflow-fill-w"
                      :min="0"
                      :step="1"
                      size="small"
                      controls-position="right"
                    />
                  </el-form-item>
                  <el-form-item label="最大重试">
                    <el-input-number
                      v-model="nodeForm.retryMaxCount"
                      class="workflow-fill-w"
                      :min="0"
                      :step="1"
                      size="small"
                      controls-position="right"
                    />
                  </el-form-item>
                </div>
                <el-form-item label="重试策略">
                  <el-input
                    v-model="nodeForm.retryPolicy"
                    size="small"
                    placeholder="如 NONE、FIXED 等"
                  />
                </el-form-item>
                <el-form-item label="超时(s)">
                  <el-input-number
                    v-model="nodeForm.timeoutSeconds"
                    class="workflow-fill-w"
                    :min="0"
                    :step="30"
                    size="small"
                    controls-position="right"
                  />
                </el-form-item>
                <el-form-item label="扩展 JSON">
                  <el-input
                    v-model="nodeForm.nodeParams"
                    type="textarea"
                    :rows="2"
                    size="small"
                    placeholder="合法 JSON 对象，如 {}"
                  />
                </el-form-item>
                <el-form-item label="启用">
                  <el-switch v-model="nodeForm.enabled" size="small" />
                </el-form-item>
              </el-form>
              <div class="workflow-action-row workflow-action-row--inspector">
                <el-button type="primary" size="small" @click="applyNodeForm">应用修改</el-button>
                <el-button size="small" @click="duplicateSelectedNode">复制</el-button>
                <el-button type="danger" plain size="small" @click="removeSelected">删除</el-button>
              </div>
              <div class="workflow-quick-create">
                <div class="workflow-quick-create__head">
                  <span class="workflow-quick-create__title">快速新增下游</span>
                  <span class="workflow-quick-create__hint">快捷键：Shift + T / D / J</span>
                </div>
                <div class="workflow-quick-create__actions">
                  <el-button
                    class="workflow-quick-create__btn"
                    size="small"
                    @click="addDownstreamNode('TASK')"
                  >
                    下游任务
                  </el-button>
                  <el-button
                    class="workflow-quick-create__btn"
                    size="small"
                    @click="addDownstreamNode('DECISION')"
                  >
                    下游分支
                  </el-button>
                  <el-button
                    class="workflow-quick-create__btn"
                    size="small"
                    @click="addDownstreamNode('JOIN')"
                  >
                    下游汇聚
                  </el-button>
                </div>
              </div>
            </div>

            <div v-else-if="selectedKind === 'edge'">
              <el-form label-position="top" class="workflow-form workflow-form--inspector">
                <div class="workflow-inspector-cols-2">
                  <el-form-item label="来源">
                    <el-input
                      v-model="edgeForm.fromNodeCode"
                      disabled
                      size="small"
                      placeholder="只读"
                    />
                  </el-form-item>
                  <el-form-item label="目标">
                    <el-input
                      v-model="edgeForm.toNodeCode"
                      disabled
                      size="small"
                      placeholder="只读"
                    />
                  </el-form-item>
                </div>
                <el-form-item label="边类型">
                  <el-radio-group
                    v-model="edgeForm.edgeType"
                    size="small"
                    class="workflow-inspector-radio-group"
                  >
                    <el-radio-button v-for="item in edgeKinds" :key="item.kind" :label="item.kind">
                      {{ item.label }}
                    </el-radio-button>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="条件表达式">
                  <el-input
                    v-model="edgeForm.conditionExpr"
                    type="textarea"
                    :rows="2"
                    size="small"
                    placeholder="留空则边上显示类型名称"
                  />
                </el-form-item>
                <el-form-item label="启用">
                  <el-switch v-model="edgeForm.enabled" size="small" />
                </el-form-item>
              </el-form>
              <div class="workflow-action-row workflow-action-row--inspector">
                <el-button type="primary" size="small" @click="applyEdgeForm">应用修改</el-button>
                <el-button type="danger" plain size="small" @click="removeSelected"
                  >删除边</el-button
                >
              </div>
            </div>

            <el-empty
              v-else
              class="workflow-inspector-empty"
              description="在画布上点选节点或连线以编辑属性"
              :image-size="64"
            />
          </SectionCard>

          <SectionCard class="workflow-card workflow-card--dsl">
            <template #title>
              <span class="workflow-card-title">
                <el-icon class="workflow-card-title__icon"><Document /></el-icon>
                草稿 DSL
              </span>
            </template>
            <el-collapse v-model="dslPanelOpen" class="workflow-dsl-collapse">
              <el-collapse-item name="preview">
                <template #title>
                  <div class="workflow-dsl-collapse__head">
                    <span class="workflow-dsl-collapse__title">JSON 预览（只读）</span>
                    <el-tag
                      size="small"
                      type="info"
                      effect="plain"
                      class="workflow-dsl-collapse__tag"
                    >
                      {{ dslPreviewLines }} 行
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
            侧栏编辑
          </button>
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item"
            role="menuitem"
            @click="ctxMenuDuplicateFromContext"
          >
            复制节点
          </button>
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item workflow-canvas-ctx-menu__item--danger"
            role="menuitem"
            @click="ctxMenuDeleteNodeFromContext"
          >
            删除节点
          </button>
        </template>
        <template v-else-if="canvasContextMenu.type === 'edge'">
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item"
            role="menuitem"
            @click="ctxMenuEditEdge"
          >
            侧栏编辑
          </button>
          <button
            type="button"
            class="workflow-canvas-ctx-menu__item workflow-canvas-ctx-menu__item--danger"
            role="menuitem"
            @click="ctxMenuDeleteEdgeFromContext"
          >
            删除连线
          </button>
        </template>
      </div>
    </Teleport>
  </PageContainer>
</template>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import {
    CircleCheck,
    DataLine,
    Document,
    EditPen,
    Grid,
    Guide,
    Setting,
  } from '@element-plus/icons-vue'
  import { useAppStore } from '@/stores/app'
  import { useTenantStore } from '@/stores/tenant'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import {
    nodeKinds,
    edgeKinds,
    edgeLegendColor,
    validationIssueLevelLabel,
    isValidationIssueActionable,
    copyWorkflowForm,
    normalizeWorkflowDefinition,
  } from './composables/workflowConstants'
  import { useWorkflowSplitter } from './composables/useWorkflowSplitter'
  import { useWorkflowGraph } from './composables/useWorkflowGraph'
  import { useWorkflowInspector } from './composables/useWorkflowInspector'
  import { useWorkflowData } from './composables/useWorkflowData'
  import { useWorkflowDag } from './composables/useWorkflowDag'

  const app = useAppStore()
  const tenant = useTenantStore()

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

  // ─── Graph ─────────────────────────────────────────────────────────────────
  // Inspector needs graph, graph needs inspector callbacks — we resolve
  // the circular dependency by creating graph first (it has no inspector dep
  // at construction time), then inspector, then binding callbacks.

  // Create a temporary placeholder for inspector functions that graph needs
  let _setSelectedCell: (cell: import('@antv/x6').Cell | null) => void = () => {}
  let _setNodeStyle: (cell: import('@antv/x6').Node, selected: boolean) => void = () => {}
  let _setEdgeStyle: (cell: import('@antv/x6').Edge, selected: boolean) => void = () => {}
  let _renderCellAppearance: (cell: import('@antv/x6').Cell, selected: boolean) => void = () => {}
  let _applyGraphGridTheme: () => void = () => {}

  const graphModule = useWorkflowGraph({
    canvasRef,
    minimapHostRef,
    dndPaletteRef,
    selectedCellId,
    setSelectedCell: (cell) => _setSelectedCell(cell),
    setNodeStyle: (cell, selected) => _setNodeStyle(cell, selected),
    setEdgeStyle: (cell, selected) => _setEdgeStyle(cell, selected),
    renderCellAppearance: (cell, selected) => _renderCellAppearance(cell, selected),
    applyGraphGridTheme: () => _applyGraphGridTheme(),
  })

  const {
    graph,
    graphReady,
    canvasResetting,
    graphVersion,
    canvasContextMenu,
    canvasContextMenuRef,
    graphZoomPercentLabel,
    closeCanvasContextMenu,
    onDocumentPointerCloseContextMenu,
    nudgeGraphZoom,
    fitGraphZoom,
    scheduleEdgeZOrder,
    syncGraphDerivedState,
    bindDerivedStateCallbacks,
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
    graphVersion,
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
    applyGraphGridTheme,
    selectFallbackAfterDelete,
  } = inspectorModule

  // Now bind the inspector functions to the graph module's forwarding layer
  _setSelectedCell = setSelectedCell
  _setNodeStyle = setNodeStyle
  _setEdgeStyle = setEdgeStyle
  _renderCellAppearance = renderCellAppearance
  _applyGraphGridTheme = applyGraphGridTheme

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
    subtitle,
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
    getSuppressDefinitionFormSync,
    clearSuppressDefinitionFormSync,
    router,
  } = dataModule

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

  watch(
    () => tenant.tenantId,
    () => {
      selectedWorkflowCode.value = ''
      definitionOptions.value = []
      workflowDefinition.value = null
      clearDraft(false)
      void loadDefinitions()
    },
  )

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

  onMounted(() => {
    window.addEventListener('mousedown', onDocumentPointerCloseContextMenu, true)
    restorePanelWidths()
    createGraph()
    window.addEventListener('keydown', onKeydown)
    void loadDefinitions()
    refreshGraphTheme()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('mousedown', onDocumentPointerCloseContextMenu, true)
    cleanupSplitter()
    window.removeEventListener('keydown', onKeydown)
    flushPendingDraft()
    cancelPositionDerivedSyncTimer()
    disposeGraph()
  })
</script>

<style scoped>
  /** 离屏 X6 容器：不参与布局与交互 */
  .workflow-dnd-palette-host {
    position: fixed;
    left: -4000px;
    top: 0;
    width: 400px;
    height: 960px;
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
    z-index: -1;
  }

  /**
   * 页头仍禁止全局 app-surface 悬浮位移；内层编排卡片使用轻微 scale 悬浮反馈。
   * 最外层 workflow-page-card 不缩放，避免整壳抖动。
   */
  .workflow-designer-page :deep(.page-header.app-surface:hover),
  .workflow-designer-page :deep(.app-surface:hover) {
    transform: none !important;
  }

  .workflow-designer-page :deep(.el-card.workflow-page-card),
  .workflow-designer-page :deep(.el-card.workflow-page-card:hover) {
    transform: none !important;
  }

  .workflow-designer-page :deep(.el-card.workflow-card) {
    transition:
      box-shadow 0.22s ease,
      border-color 0.22s ease,
      background-color 0.22s ease;
  }

  .workflow-designer-page :deep(.el-card.workflow-card:hover) {
    transform: none !important;
    z-index: 2;
    position: relative;
    box-shadow:
      0 14px 36px rgb(15 23 42 / 11%),
      0 0 0 1px color-mix(in srgb, var(--color-primary) 14%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border-light) 68%);
    background: color-mix(in srgb, var(--color-bg-card) 94%, var(--color-bg-canvas) 6%);
  }

  :global(html.dark) .workflow-designer-page :deep(.el-card.workflow-card:hover) {
    box-shadow:
      0 16px 40px rgb(0 0 0 / 35%),
      0 0 0 1px color-mix(in srgb, var(--color-primary) 22%, transparent);
  }

  /** 四周 UI 再收一档字号 */
  .workflow-designer-page {
    font-size: 12px;
    line-height: 1.45;
  }

  .workflow-designer-page :deep(.page-header) {
    padding: 6px 10px !important;
    margin-bottom: 6px;
  }

  .workflow-designer-page :deep(.page-header .title) {
    font-size: 13px !important;
  }

  .workflow-designer-page :deep(.page-header .description) {
    font-size: 11px !important;
    margin-top: 3px !important;
  }

  .workflow-designer-page :deep(.page-header .actions .el-button) {
    font-size: 11px;
    padding: 4px 9px;
  }

  .workflow-shell {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .workflow-page-card {
    overflow: hidden;
    border-radius: var(--radius-content) !important;
    border: 1px solid var(--color-border-light) !important;
    box-shadow: var(--shadow-surface) !important;
    background: color-mix(in srgb, var(--color-bg-card) 96%, var(--color-bg-canvas) 4%) !important;
  }

  .workflow-page-card :deep(.el-card__body) {
    padding: 16px 16px 22px;
  }

  .workflow-page-card :deep(.el-form-item__label) {
    font-size: 11px;
    line-height: 1.3;
  }

  .workflow-page-card :deep(.el-input__inner),
  .workflow-page-card :deep(.el-textarea__inner) {
    font-size: 12px;
  }

  .workflow-page-card :deep(.el-button) {
    font-size: 11px;
  }

  .workflow-card-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: inherit;
    font-size: inherit;
  }

  .workflow-card-title__icon {
    font-size: 12px;
    color: color-mix(in srgb, var(--color-primary) 82%, var(--color-text-tertiary) 18%);
  }

  .workflow-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px 16px;
    padding: 10px 16px 12px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 78%, var(--color-bg-canvas) 22%);
    box-shadow: var(--shadow-surface, 0 10px 28px rgb(15 23 42 / 6%));
    transition:
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .workflow-toolbar:hover {
    border-color: color-mix(in srgb, var(--color-primary) 18%, var(--color-border-light) 82%);
    box-shadow:
      0 12px 32px rgb(15 23 42 / 8%),
      0 0 0 1px color-mix(in srgb, var(--color-primary) 8%, transparent);
  }

  :global(html.dark) .workflow-toolbar:hover {
    box-shadow:
      0 12px 32px rgb(0 0 0 / 28%),
      0 0 0 1px color-mix(in srgb, var(--color-primary) 14%, transparent);
  }

  .workflow-toolbar__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  /** 编排对象：标题 + 下拉 + 标签同一行，下拉尽量拉长 */
  .workflow-toolbar__section--object {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 12px;
    flex: 1;
    min-width: min(100%, 420px);
  }

  .workflow-toolbar__section--object .workflow-toolbar__eyebrow {
    flex-shrink: 0;
    line-height: 1.2;
    padding-top: 1px;
  }

  .workflow-toolbar__section--actions {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 12px;
    justify-content: flex-end;
    flex-shrink: 0;
    text-align: left;
  }

  .workflow-toolbar__section--actions .workflow-toolbar__eyebrow {
    flex-shrink: 0;
    line-height: 1.2;
    padding-top: 1px;
  }

  .workflow-toolbar__eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text-tertiary);
  }

  .workflow-toolbar__controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  /** 编排对象：下拉与标签同一行，下拉可伸缩变长 */
  .workflow-toolbar__controls--object {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    flex: 1 1 280px;
    min-width: 0;
  }

  .workflow-toolbar__controls--object .workflow-select {
    flex: 1 1 auto;
    width: auto !important;
    min-width: min(180px, 100%);
    max-width: min(360px, 100%);
  }

  .workflow-toolbar__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    row-gap: 4px;
    flex-shrink: 0;
  }

  .workflow-toolbar__tag {
    border-radius: var(--radius-content);
    margin: 0;
  }

  .workflow-toolbar :deep(.workflow-toolbar__tag.el-tag) {
    --el-tag-font-size: 11px;
    height: 20px;
    padding: 0 8px;
    line-height: 18px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .workflow-toolbar :deep(.workflow-select .el-input__wrapper) {
    border-radius: var(--radius-content);
    min-height: 32px;
  }

  .workflow-toolbar :deep(.workflow-select .el-input__inner) {
    font-size: 11px;
    font-weight: 500;
  }

  .workflow-toolbar__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }

  .workflow-toolbar__btn-group {
    display: inline-flex;
    vertical-align: middle;
  }

  .workflow-toolbar__btn-group :deep(.el-button) {
    font-weight: 600;
    font-size: 11px;
    padding: 4px 9px;
  }

  .workflow-select {
    width: min(300px, 100%);
    max-width: 100%;
  }

  .workflow-layout {
    --workflow-splitter-w: 10px;
    display: grid;
    grid-template-columns:
      var(--workflow-left-w) var(--workflow-splitter-w) minmax(0, 1fr) var(--workflow-splitter-w)
      var(--workflow-right-w);
    gap: 0;
    min-height: max(800px, calc(100vh - 188px));
    align-items: stretch;
    margin-top: 2px;
  }

  .workflow-layout.is-dragging {
    cursor: col-resize;
    user-select: none;
  }

  .workflow-splitter {
    position: relative;
    z-index: 2;
    width: 100%;
    min-width: 0;
    margin: 0;
    align-self: stretch;
    cursor: col-resize;
    touch-action: none;
    user-select: none;
  }

  .workflow-splitter::after {
    content: '';
    position: absolute;
    top: 14px;
    bottom: 14px;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    border-radius: 2px;
    background: color-mix(in srgb, var(--color-border) 55%, var(--color-bg-canvas) 45%);
    transition: background 0.15s ease;
  }

  .workflow-splitter:hover::after,
  .workflow-layout.is-dragging .workflow-splitter::after {
    background: color-mix(in srgb, var(--color-primary) 45%, var(--color-border) 55%);
  }

  .workflow-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .workflow-panel--left {
    position: sticky;
    top: 12px;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
    padding-right: 2px;
    scrollbar-gutter: stable;
  }

  .workflow-panel--right {
    position: sticky;
    top: 12px;
    max-height: calc(100vh - 96px);
    overflow-y: auto;
    padding-right: 2px;
    scrollbar-gutter: stable;
  }

  .workflow-card--validation {
    flex: 0 0 auto;
  }

  .workflow-card--validation :deep(.el-card__body) {
    padding: 8px 10px 10px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /** 固定高度提示栏，仅内部列表滚动（避免整列随提示变长） */
  .workflow-validation-scroll {
    height: 232px;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    padding: 6px 8px 8px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 94%, var(--color-bg-canvas) 6%);
  }

  .workflow-card--legend {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .workflow-card--legend :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    overflow: hidden;
  }

  .workflow-legend__hint {
    margin: 0;
    font-size: 11px;
    line-height: 1.55;
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }

  .workflow-legend__hint strong {
    color: var(--color-text-primary);
    font-weight: 650;
  }

  .workflow-legend {
    list-style: none;
    margin: 0;
    padding: 0 2px 0 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
    min-height: 0;
    max-height: 168px;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .workflow-legend__row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 7px;
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-canvas) 55%, var(--color-bg-card) 45%);
    border: 1px solid var(--color-border-light);
    font-size: 11px;
  }

  .workflow-legend__swatch {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-content);
    flex-shrink: 0;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-bg-card) 70%, transparent 30%);
  }

  .workflow-legend__label {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .workflow-legend__code {
    font-size: 10px;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    color: var(--color-text-tertiary);
    background: color-mix(in srgb, var(--color-bg-card) 88%, var(--color-bg-canvas) 12%);
    padding: 2px 6px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
  }

  .workflow-card {
    border-radius: var(--radius-content);
    background:
      radial-gradient(120% 80% at 0% 0%, rgb(22 119 255 / 7%), transparent 55%),
      radial-gradient(90% 60% at 100% 0%, rgb(99 102 241 / 6%), transparent 50%),
      var(--color-bg-card);
    border: 1px solid var(--color-border-light);
  }

  .workflow-card :deep(.el-card__header) {
    padding: 8px 11px;
    font-size: 12px;
    font-weight: 650;
    border-bottom: 1px solid var(--color-border-light);
  }

  .workflow-card :deep(.el-card__body) {
    padding: 10px 12px;
  }

  .workflow-card--dsl :deep(.el-card__body) {
    padding-top: 10px;
  }

  .workflow-dsl-collapse {
    --el-collapse-border-color: transparent;
    border: none;
  }

  .workflow-dsl-collapse :deep(.el-collapse-item__wrap) {
    border-bottom: none;
  }

  .workflow-dsl-collapse :deep(.el-collapse-item__header) {
    min-height: 34px;
    height: auto;
    padding: 8px 2px;
    font-size: 11px;
    font-weight: 650;
    color: var(--color-text-primary);
    background: transparent;
    border-bottom: 1px solid var(--color-border-light);
  }

  .workflow-dsl-collapse :deep(.el-collapse-item__arrow) {
    margin-right: 10px;
  }

  .workflow-dsl-collapse__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    padding-right: 8px;
    box-sizing: border-box;
  }

  .workflow-dsl-collapse__title {
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .workflow-dsl-collapse__tag {
    flex-shrink: 0;
    border-radius: var(--radius-content);
  }

  .workflow-dsl-input :deep(textarea) {
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 10px;
    line-height: 1.55;
    border-radius: var(--radius-content);
  }

  .workflow-inspector-empty {
    padding: 12px 0 8px;
  }

  .workflow-inspector-empty :deep(.el-empty__description) {
    max-width: 240px;
    margin: 12px auto 0;
    line-height: 1.55;
  }

  .workflow-inspector-empty :deep(.el-empty__image) {
    margin-bottom: 0;
  }

  .workflow-node-library {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .workflow-node-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    justify-content: flex-start;
    padding: 6px 8px;
    border-radius: var(--radius-content);
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 88%, var(--color-bg-canvas) 12%);
    color: var(--color-text-primary);
    font-size: 11px;
    font-weight: 600;
    cursor: grab;
    transition:
      box-shadow var(--motion-duration-sm, 0.15s) ease,
      border-color var(--motion-duration-sm, 0.15s) ease,
      background-color var(--motion-duration-sm, 0.15s) ease;
  }

  .workflow-node-pill:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .workflow-node-pill:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border) 70%);
    box-shadow: 0 2px 10px rgb(15 23 42 / 6%);
  }

  .workflow-node-pill:not(:disabled):active {
    cursor: grabbing;
    box-shadow: none;
  }

  .workflow-node-pill__dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-content);
    flex-shrink: 0;
    background: var(--color-border);
  }

  .workflow-node-pill--start .workflow-node-pill__dot {
    background: #0891b2;
    box-shadow: 0 0 0 3px rgb(6 182 212 / 22%);
  }

  .workflow-node-pill--task .workflow-node-pill__dot {
    background: #475569;
    box-shadow: 0 0 0 3px rgb(100 116 139 / 18%);
  }

  .workflow-node-pill--decision .workflow-node-pill__dot {
    background: #ea580c;
    box-shadow: 0 0 0 3px rgb(249 115 22 / 22%);
  }

  .workflow-node-pill--join .workflow-node-pill__dot {
    background: #4f46e5;
    box-shadow: 0 0 0 3px rgb(99 102 241 / 22%);
  }

  .workflow-node-pill--end .workflow-node-pill__dot {
    background: #dc2626;
    box-shadow: 0 0 0 3px rgb(239 68 68 / 22%);
  }

  .workflow-summary {
    display: flex;
    align-items: stretch;
    border-radius: var(--radius-content);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 88%, transparent 12%);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 40%),
      0 1px 2px rgb(15 23 42 / 4%);
    overflow: hidden;
  }

  :global(html.dark) .workflow-summary {
    box-shadow: none;
    border-color: color-mix(in srgb, var(--color-border-light) 72%, transparent 28%);
  }

  .workflow-summary__col {
    flex: 1;
    min-width: 0;
    padding: 8px 10px;
    border-radius: 0;
    background: transparent;
    border: none;
    border-right: 1px solid var(--color-border-light);
    display: flex;
    flex-direction: column;
    gap: 4px;
    justify-content: center;
  }

  .workflow-summary__col--draft {
    flex: 1.25;
    min-width: 108px;
    background: color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-card) 95%);
  }

  :global(html.dark) .workflow-summary__col--draft {
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-card) 90%);
  }

  .workflow-summary__col--draft :deep(.el-tooltip__trigger) {
    display: flex;
    width: 100%;
    min-width: 0;
  }

  .workflow-summary__col:last-child {
    border-right: none;
  }

  .workflow-summary span {
    font-size: 11px;
    color: var(--color-text-tertiary);
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.2;
  }

  .workflow-summary strong {
    font-size: 14px;
    font-weight: 750;
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  .workflow-summary__draft {
    display: flex;
    flex-direction: column;
    gap: 3px;
    align-items: flex-start;
    cursor: default;
    min-width: 0;
    width: 100%;
  }

  .workflow-summary__draft-main {
    font-size: 12px;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    color: var(--color-text-primary);
  }

  .workflow-summary__sub {
    font-size: 10px;
    line-height: 1.35;
    color: var(--color-text-tertiary);
    font-weight: 500;
  }

  .workflow-issues {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .workflow-issues__item {
    margin: 0;
  }

  .workflow-issue {
    margin: 0;
    appearance: none;
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 7px 8px 7px 11px;
    border: 1px solid var(--color-border-light);
    border-left-width: 3px;
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    color: var(--color-text-secondary);
    font-size: 11px;
    line-height: 1.55;
    text-align: left;
    cursor: default;
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .workflow-issue.is-error {
    border-left-color: color-mix(in srgb, #ef4444 72%, var(--color-border-light) 28%);
  }

  .workflow-issue.is-warning {
    border-left-color: color-mix(in srgb, #f59e0b 72%, var(--color-border-light) 28%);
  }

  .workflow-issue.is-actionable {
    cursor: pointer;
  }

  .workflow-issue.is-actionable:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--color-primary) 26%, var(--color-border-light) 74%);
    background: color-mix(in srgb, var(--color-bg-card) 96%, var(--color-bg-canvas) 4%);
    box-shadow: 0 6px 16px rgb(15 23 42 / 8%);
  }

  .workflow-issue:disabled {
    opacity: 1;
  }

  .workflow-issue__level {
    flex-shrink: 0;
    padding: 1px 6px;
    border-radius: var(--radius-content);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.4;
  }

  .workflow-issue.is-error .workflow-issue__level {
    color: #b91c1c;
    background: rgb(239 68 68 / 12%);
  }

  .workflow-issue.is-warning .workflow-issue__level {
    color: #b45309;
    background: rgb(245 158 11 / 14%);
  }

  .workflow-issue__text {
    flex: 1;
    min-width: 0;
  }

  .workflow-issue__action {
    flex-shrink: 0;
    color: var(--color-primary);
    font-size: 10px;
    font-weight: 700;
  }

  .workflow-empty {
    color: var(--color-text-secondary);
    font-size: 11px;
    line-height: 1.65;
  }

  .workflow-empty--validation {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    text-align: center;
    padding: 12px 8px;
    color: var(--color-text-tertiary);
    font-size: 11px;
  }

  .workflow-canvas-shell {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .workflow-canvas-frame {
    position: relative;
    border-radius: var(--radius-content);
    padding: 0;
    /* 单层实线边框，避免「渐变 padding + 外圈 box-shadow + 角标」叠出多道蓝线 */
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border-light) 78%);
    background: color-mix(in srgb, var(--color-bg-canvas) 88%, var(--color-bg-card) 12%);
    box-shadow:
      0 22px 48px rgb(15 23 42 / 7%),
      inset 0 1px 0 rgb(255 255 255 / 40%);
    will-change: opacity;
    transition: opacity 0.1s ease;
  }

  .workflow-canvas-frame.is-resetting {
    opacity: 0;
    pointer-events: none;
  }

  .workflow-canvas-hud {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    pointer-events: none;
  }

  .workflow-minimap-stack {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    width: 176px;
    pointer-events: none;
  }

  .workflow-minimap-stack .workflow-minimap-host {
    pointer-events: auto;
  }

  .workflow-minimap-coords {
    display: block;
    font-size: 10px;
    line-height: 1.35;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--color-text-tertiary);
    text-align: right;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: auto;
    cursor: default;
  }

  .workflow-minimap-host {
    width: 176px;
    height: 116px;
    border-radius: var(--radius-content);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-border-light) 82%, transparent 18%);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    box-shadow: 0 16px 38px rgb(15 23 42 / 10%);
    pointer-events: auto;
  }

  :global(html.dark) .workflow-minimap-host {
    background: color-mix(in srgb, var(--color-bg-card) 80%, #000 20%);
    box-shadow: 0 18px 44px rgb(0 0 0 / 42%);
  }

  .workflow-minimap-host :deep(.x6-widget-minimap) {
    background: transparent;
  }

  .workflow-minimap-host :deep(.x6-widget-minimap .x6-graph) {
    box-shadow: none;
    border-radius: var(--radius-content);
  }

  .workflow-minimap-host :deep(.x6-widget-minimap-viewport) {
    border-color: color-mix(in srgb, var(--color-primary) 70%, #31d0c6 30%);
  }

  .workflow-minimap-host :deep(.x6-widget-minimap-viewport-zoom) {
    border-color: color-mix(in srgb, var(--color-primary) 70%, #31d0c6 30%);
  }

  /*
   * ─── X6 端口可见性 ───────────────────────────────────────────────────────────
   * 端口默认隐藏（visibility:hidden 已写在 registerShapes），这里通过 CSS 让其
   * 在以下场景显现：
   *   1. 鼠标悬停节点时（hover 发现）
   *   2. 连线拖拽进行中（X6 给画布容器添加 x6-graph-connecting 类）
   *   3. 被选中节点（辅助确认可连接性）
   */
  :global(.x6-node:hover .x6-port-body),
  :global(.x6-node-selected .x6-port-body),
  :global(.x6-graph-connecting .x6-port-body) {
    visibility: visible !important;
  }

  /* 端口本身 hover：放大 + 颜色加深，给用户明确的"可拖拽"提示 */
  :global(.x6-port-body:hover) {
    r: 9;
    filter: brightness(0.88);
    cursor: crosshair;
  }

  .workflow-zoom-toolbar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: var(--radius-content);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 86%, transparent 14%);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
    box-shadow: 0 14px 32px rgb(15 23 42 / 9%);
    pointer-events: auto;
    backdrop-filter: blur(10px);
  }

  :global(html.dark) .workflow-zoom-toolbar {
    background: color-mix(in srgb, var(--color-bg-card) 80%, #000 20%);
    box-shadow: 0 16px 40px rgb(0 0 0 / 40%);
  }

  .workflow-zoom-toolbar__btn,
  .workflow-zoom-toolbar__fit {
    appearance: none;
    border: 1px solid var(--color-border-light);
    background: color-mix(in srgb, var(--color-bg-card) 86%, var(--color-bg-canvas) 14%);
    color: var(--color-text-primary);
    height: 22px;
    padding: 0 8px;
    border-radius: var(--radius-content);
    font-size: 12px;
    line-height: 20px;
    font-weight: 700;
    cursor: pointer;
  }

  .workflow-zoom-toolbar__fit {
    font-size: 9px;
    font-weight: 650;
    letter-spacing: 0.02em;
  }

  .workflow-zoom-toolbar__btn:hover,
  .workflow-zoom-toolbar__fit:hover {
    border-color: color-mix(in srgb, var(--color-primary) 25%, var(--color-border) 75%);
  }

  .workflow-zoom-toolbar__pct {
    min-width: 44px;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  :global(html.dark) .workflow-canvas-frame {
    border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border-light) 72%);
    background: color-mix(in srgb, var(--color-bg-canvas) 92%, var(--color-bg-card) 8%);
    box-shadow:
      0 28px 56px rgb(0 0 0 / 35%),
      inset 0 1px 0 rgb(255 255 255 / 6%);
  }

  .workflow-canvas-ctx-menu {
    position: fixed;
    z-index: 9999;
    width: 168px;
    padding: 6px;
    border-radius: var(--radius-content);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 82%, transparent 18%);
    background: color-mix(in srgb, var(--color-bg-card) 94%, var(--color-bg-canvas) 6%);
    box-shadow:
      0 18px 44px rgb(15 23 42 / 16%),
      0 0 0 1px color-mix(in srgb, var(--color-primary) 6%, transparent);
    backdrop-filter: blur(10px);
  }

  :global(html.dark) .workflow-canvas-ctx-menu {
    background: color-mix(in srgb, var(--color-bg-card) 78%, #000 22%);
    box-shadow:
      0 18px 48px rgb(0 0 0 / 46%),
      0 0 0 1px color-mix(in srgb, var(--color-primary) 14%, transparent);
  }

  .workflow-canvas-ctx-menu__item {
    width: 100%;
    appearance: none;
    border: none;
    background: transparent;
    color: var(--color-text-primary);
    text-align: left;
    padding: 8px 10px;
    border-radius: var(--radius-content);
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .workflow-canvas-ctx-menu__item:hover {
    background: color-mix(in srgb, var(--color-bg-canvas) 46%, var(--color-bg-card) 54%);
  }

  .workflow-canvas-ctx-menu__item--danger {
    color: color-mix(in srgb, var(--color-danger, #ef4444) 82%, var(--color-text-primary) 18%);
  }

  .workflow-canvas-loading {
    position: absolute;
    inset: 0;
    z-index: 5;
    background: var(--color-bg-canvas, #fff);
    min-height: 300px;
  }

  .workflow-canvas-empty {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-canvas) 82%, var(--color-bg-card) 18%);
    backdrop-filter: blur(6px);
  }

  :global(html.dark) .workflow-canvas-empty {
    background: color-mix(in srgb, var(--color-bg-canvas) 88%, #000 12%);
  }

  .workflow-canvas-empty :deep(.el-empty__description) {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .workflow-canvas-empty__illus {
    width: 88px;
    height: 88px;
    border-radius: var(--radius-content);
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--color-primary) 38%, var(--color-bg-card) 62%),
      color-mix(in srgb, #6366f1 32%, var(--color-bg-card) 68%)
    );
    box-shadow:
      0 16px 36px rgb(22 119 255 / 18%),
      inset 0 1px 0 rgb(255 255 255 / 35%);
    position: relative;
  }

  .workflow-canvas-empty__illus::after {
    content: '';
    position: absolute;
    inset: 18px;
    border-radius: var(--radius-content);
    border: 2px dashed color-mix(in srgb, var(--color-bg-card) 55%, transparent 45%);
    opacity: 0.85;
  }

  :global(html.dark) .workflow-canvas-empty__illus {
    box-shadow:
      0 18px 40px rgb(0 0 0 / 45%),
      inset 0 1px 0 rgb(255 255 255 / 12%);
  }

  .workflow-canvas {
    position: relative;
    z-index: 1;
    height: 100%;
    min-height: max(820px, calc(100vh - 200px));
    border-radius: var(--radius-content);
    border: none;
    /* 与外层 frame 圆角同心，避免左下角与侧栏接缝处露缝 */
    clip-path: inset(0 round var(--radius-content));
    background-color: var(--color-bg-canvas);
    background-image:
      radial-gradient(circle at 20% 12%, rgb(22 119 255 / 9%), transparent 42%),
      radial-gradient(circle at 88% 8%, rgb(99 102 241 / 7%), transparent 38%),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-card) 35%, var(--color-bg-canvas) 65%),
        var(--color-bg-canvas)
      );
    overflow: hidden;
  }

  :global(html.dark) .workflow-canvas {
    background-image:
      radial-gradient(circle at 18% 10%, rgb(22 119 255 / 12%), transparent 40%),
      radial-gradient(circle at 86% 6%, rgb(99 102 241 / 10%), transparent 36%),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-card) 16%, var(--color-bg-canvas) 84%),
        var(--color-bg-canvas)
      );
  }

  .workflow-canvas-hint {
    margin: 8px 4px 0;
    padding: 0 2px 2px;
    font-size: 11px;
    line-height: 1.6;
    color: var(--color-text-tertiary);
    text-align: center;
  }

  .workflow-canvas-hint kbd {
    display: inline-block;
    margin: 0 1px;
    padding: 1px 5px;
    border-radius: var(--radius-content);
    font-size: 11px;
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    color: var(--color-text-secondary);
    background: color-mix(in srgb, var(--color-bg-card) 70%, var(--color-bg-canvas) 30%);
    border: 1px solid var(--color-border-light);
    box-shadow: 0 1px 0 rgb(0 0 0 / 6%);
  }

  :global(html.dark) .workflow-canvas-hint kbd {
    box-shadow: none;
  }

  .workflow-form :deep(.el-form-item) {
    margin-bottom: 10px;
  }

  /** 右侧检查器：紧凑控件、无下拉（类型用分段按钮） */
  .workflow-form--inspector :deep(.el-form-item) {
    margin-bottom: 5px;
  }

  .workflow-form--inspector :deep(.el-form-item__label) {
    font-size: 11px;
    line-height: 1.25;
    padding-bottom: 1px !important;
    color: var(--color-text-tertiary);
    font-weight: 650;
  }

  /**
   * 右栏表单再缩一档：小字号、矮输入、浅底实线（去掉默认阴影「框线感」）
   */
  .workflow-panel--right .workflow-form--inspector :deep(.el-form-item) {
    margin-bottom: 3px;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-form-item__label) {
    font-size: 10px;
    line-height: 1.2;
    padding-bottom: 0 !important;
    margin-bottom: 1px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-input__wrapper) {
    min-height: 28px;
    padding: 0 7px;
    border-radius: var(--radius-content);
    box-shadow: none !important;
    border: 1px solid color-mix(in srgb, var(--color-border-light) 92%, var(--color-border) 8%);
    background: color-mix(in srgb, var(--color-bg-canvas) 38%, var(--color-bg-card) 62%);
    transition:
      border-color 0.15s ease,
      background-color 0.15s ease;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-input__wrapper.is-focus) {
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 28%, transparent) !important;
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border-light) 65%);
    background: color-mix(in srgb, var(--color-bg-card) 88%, var(--color-bg-canvas) 12%);
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-input.is-disabled .el-input__wrapper) {
    background: color-mix(in srgb, var(--color-bg-canvas) 55%, var(--color-bg-card) 45%);
    box-shadow: none !important;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-input__inner) {
    font-size: 11px;
    height: 26px;
    line-height: 26px;
    font-weight: 500;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-input__inner::placeholder),
  .workflow-panel--right .workflow-form--inspector :deep(.el-textarea__inner::placeholder) {
    font-size: 10px;
    color: var(--color-text-tertiary);
    opacity: 0.88;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-textarea__inner) {
    font-size: 11px;
    line-height: 1.4;
    padding: 4px 7px;
    min-height: 56px;
    border-radius: var(--radius-content);
    box-shadow: none !important;
    border: 1px solid color-mix(in srgb, var(--color-border-light) 92%, var(--color-border) 8%);
    background: color-mix(in srgb, var(--color-bg-canvas) 38%, var(--color-bg-card) 62%);
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-textarea__inner:focus) {
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 28%, transparent) !important;
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border-light) 65%);
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-input-number) {
    width: 100%;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-input-number .el-input__wrapper) {
    padding-left: 6px;
    padding-right: 6px;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-input-number .el-input__inner) {
    text-align: left;
  }

  .workflow-panel--right .workflow-form--inspector :deep(.el-switch) {
    transform: scale(0.86);
    transform-origin: 0 50%;
  }

  .workflow-inspector-cols-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 6px;
  }

  .workflow-inspector-cols-2 :deep(.el-form-item) {
    margin-bottom: 5px;
  }

  .workflow-fill-w {
    width: 100%;
  }

  .workflow-fill-w :deep(.el-input__wrapper) {
    width: 100%;
  }

  .workflow-inspector-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    width: 100%;
    align-items: center;
    line-height: 1;
  }

  .workflow-inspector-radio-group :deep(.el-radio-button) {
    margin: 0;
  }

  .workflow-inspector-radio-group :deep(.el-radio-button__inner) {
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: var(--radius-content) !important;
    box-shadow: none;
  }

  .workflow-action-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .workflow-action-row--inspector {
    gap: 5px;
    margin-top: 2px;
    padding-top: 6px;
    border-top: none;
    justify-content: flex-start;
  }

  .workflow-action-row--inspector :deep(.el-button) {
    font-size: 10px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: var(--radius-content);
  }

  .workflow-quick-create {
    margin-top: 10px;
    padding: 10px 10px 9px;
    border-radius: var(--radius-content);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 78%, transparent 22%);
    background: color-mix(in srgb, var(--color-bg-canvas) 42%, var(--color-bg-card) 58%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(html.dark) .workflow-quick-create {
    background: color-mix(in srgb, var(--color-bg-canvas) 35%, var(--color-bg-card) 65%);
    box-shadow: none;
    border-color: color-mix(in srgb, var(--color-border-light) 55%, transparent 45%);
  }

  .workflow-quick-create__head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 4px 10px;
  }

  .workflow-quick-create__title {
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.02em;
    color: var(--color-text-primary);
  }

  .workflow-quick-create__hint {
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-tertiary);
    opacity: 0.95;
  }

  .workflow-quick-create__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .workflow-quick-create__actions :deep(.workflow-quick-create__btn) {
    margin: 0;
    border-radius: var(--radius-content);
    font-size: 11px;
    font-weight: 650;
    padding: 5px 12px;
    border-color: color-mix(in srgb, var(--color-border-light) 82%, transparent 18%);
    background: color-mix(in srgb, var(--color-bg-card) 94%, var(--color-bg-canvas) 6%);
    color: var(--color-text-primary);
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      box-shadow 0.15s ease;
  }

  .workflow-quick-create__actions :deep(.workflow-quick-create__btn:hover) {
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border-light) 65%);
    background: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-card) 93%);
    color: var(--color-text-primary);
  }

  :global(html.dark) .workflow-quick-create__actions :deep(.workflow-quick-create__btn) {
    background: color-mix(in srgb, var(--color-bg-card) 88%, #000 12%);
    border-color: color-mix(in srgb, var(--color-border-light) 50%, transparent 50%);
  }

  :global(html.dark) .workflow-quick-create__actions :deep(.workflow-quick-create__btn:hover) {
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-bg-card) 86%);
  }

  .workflow-panel--right .workflow-card :deep(.el-card__body) {
    padding: 6px 8px 8px;
  }

  .workflow-panel--right .workflow-card :deep(.el-card__header) {
    border-bottom: none !important;
    padding: 5px 8px 4px !important;
    font-size: 11px !important;
    font-weight: 650;
    background: transparent !important;
  }

  .workflow-panel--right .workflow-card:not(.workflow-card--dsl) {
    box-shadow: 0 1px 5px rgb(15 23 42 / 5%) !important;
  }

  :global(html.dark) .workflow-panel--right .workflow-card:not(.workflow-card--dsl) {
    box-shadow: 0 1px 8px rgb(0 0 0 / 28%) !important;
  }

  .workflow-panel--right .workflow-card-title__icon {
    font-size: 11px;
  }

  :deep(.workflow-node) {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    border-radius: var(--radius-content);
    padding: 3px 4px;
    box-sizing: border-box;
    overflow: hidden;
    cursor: default;
    user-select: none;
    backdrop-filter: blur(8px);
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--color-bg-card) 94%, #fff 6%),
      color-mix(in srgb, var(--color-bg-card) 82%, var(--color-bg-canvas) 18%)
    );
    box-shadow:
      0 6px 14px rgb(15 23 42 / 8%),
      0 0 0 1px rgb(148 163 184 / 12%);
    border: 1px solid color-mix(in srgb, var(--color-border-light) 78%, transparent 22%);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      border-color 0.18s ease;
    transform-origin: center center;
  }

  :global(html.dark) :deep(.workflow-node) {
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--color-bg-card) 94%, #000 6%),
      color-mix(in srgb, var(--color-bg-card) 76%, var(--color-bg-canvas) 24%)
    );
    box-shadow:
      0 8px 18px rgb(0 0 0 / 38%),
      0 0 0 1px rgb(255 255 255 / 7%);
    border-color: color-mix(in srgb, var(--color-border-light) 58%, transparent 42%);
  }

  :deep(.workflow-node__top) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2px;
    margin-bottom: 1px;
    flex-shrink: 0;
    min-height: 0;
  }

  :deep(.workflow-node__kind) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    border-radius: var(--radius-content);
    font-size: 6px;
    letter-spacing: 0.02em;
    font-weight: 750;
    color: var(--workflow-accent);
    background: color-mix(in srgb, var(--workflow-accent) 16%, transparent);
    line-height: 1.2;
    max-width: 70%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.workflow-node__order) {
    font-size: 6px;
    color: var(--workflow-soft);
    font-weight: 650;
    opacity: 0.9;
    flex-shrink: 0;
  }

  :deep(.workflow-node__title) {
    font-size: 8px;
    line-height: 1.2;
    font-weight: 650;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    word-break: break-word;
    min-height: 0;
    flex: 1;
  }

  :deep(.workflow-node__footer--micro) {
    display: flex;
    align-items: center;
    margin-top: 1px;
    padding-top: 0;
    flex-shrink: 0;
    min-height: 0;
  }

  :deep(.workflow-node__code) {
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 6px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--workflow-soft);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
    min-width: 0;
    opacity: 0.92;
  }

  @media (max-width: 1400px) {
    .workflow-layout {
      grid-template-columns: var(--workflow-left-w) var(--workflow-splitter-w) minmax(0, 1fr);
      grid-template-rows: auto auto;
      row-gap: 10px;
    }

    .workflow-splitter--right {
      display: none;
    }

    .workflow-panel--left {
      grid-column: 1;
      grid-row: 1;
    }

    .workflow-splitter--left {
      grid-column: 2;
      grid-row: 1;
    }

    .workflow-canvas-shell {
      grid-column: 3;
      grid-row: 1;
    }

    .workflow-panel--right {
      grid-column: 1 / -1;
      grid-row: 2;
      position: static;
    }

    .workflow-toolbar__section--actions {
      align-items: center;
      justify-content: flex-start;
      width: 100%;
    }

    .workflow-toolbar__actions {
      justify-content: flex-start;
    }

    .workflow-toolbar__section--object {
      width: 100%;
    }

    .workflow-toolbar__controls--object .workflow-select {
      min-width: min(180px, 100%);
      max-width: none;
    }
  }

  @media (max-width: 1120px) {
    .workflow-layout {
      grid-template-columns: 1fr;
      grid-template-rows: none;
      row-gap: 0;
      min-height: auto;
    }

    .workflow-splitter--left,
    .workflow-splitter--right {
      display: none;
    }

    .workflow-panel--left,
    .workflow-canvas-shell,
    .workflow-panel--right {
      grid-column: 1;
      grid-row: auto;
    }

    .workflow-panel--left,
    .workflow-panel--right {
      position: static;
      max-height: none;
    }

    .workflow-canvas {
      min-height: min(72vh, 640px);
    }

    .workflow-canvas-hint {
      text-align: left;
    }
  }
</style>

<!--
  X6 HTML 节点在 SVG foreignObject 内，Vue scoped + :deep 往往无法作用到该子树；
  选中态必须用无 scoped 规则，且仅限定在 .workflow-designer-page 下。
-->
<style>
  .workflow-designer-page .x6-graph g[data-shape='workflow-node'] foreignObject {
    overflow: visible !important;
  }

  .workflow-designer-page .x6-graph g[data-shape='workflow-node'] .workflow-node {
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
    transform-origin: center center;
  }

  .workflow-designer-page
    .x6-graph
    g[data-shape='workflow-node']
    .workflow-node.workflow-node--selected {
    transform: scale(1.12);
    overflow: visible !important;
    z-index: 5;
    box-shadow:
      0 12px 30px rgb(15 23 42 / 18%),
      0 0 0 2px rgb(22 119 255 / 0.55);
    border-color: rgb(22 119 255 / 0.42);
  }

  html.dark
    .workflow-designer-page
    .x6-graph
    g[data-shape='workflow-node']
    .workflow-node.workflow-node--selected {
    box-shadow:
      0 14px 34px rgb(0 0 0 / 48%),
      0 0 0 2px rgba(147, 197, 253, 0.88);
    border-color: rgba(147, 197, 253, 0.55);
  }
</style>
