<script setup lang="ts">
  /**
   * Workflow DAG 设计器顶层容器(MVP 阶段)。
   *
   * 布局:
   *   ┌─────────────────────────────────────────────────────────┐
   *   │ Toolbar(undo / redo / 自动布局 / 校验 / 保存 / Mermaid) │
   *   ├─────────────────────────────────────────────────────────┤
   *   │ ErrorBanner(校验错误数 + 展开)                          │
   *   │ LockBanner(他人持锁只读提示)                            │
   *   ├────────┬────────────────────────────┬───────────────────┤
   *   │ Palette│ Canvas(X6)+ mini-map     │ Inspector          │
   *   └────────┴────────────────────────────┴───────────────────┘
   *
   * 数据流:
   * - mount → workflowDesignerApi.getFull(:id) → 填 store.meta + reset(snapshot) →
   *   useLockManager.acquire → setLock(isMine / readonly)
   * - 保存 → validateDag → 有错弹 drawer;无错走 putFull(/full) + markClean
   * - 锁丢失(续期失败/被夺) → setLock 只读 + banner
   * - onUnmounted → useLockManager 内置 release + beforeunload sendBeacon 兜底
   */

  import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { PanelRightOpen } from 'lucide-vue-next'
  import { useTenantStore } from '@/stores/tenant'
  import { useDesignerStore } from './store/useDesignerStore'
  import type { DesignerNodeType } from './types'
  import { exportMermaid } from './codec/mermaidExporter'
  import { graphToDefinition } from './codec/graphToDefinition'
  import { definitionToGraph } from './codec/definitionToGraph'
  import { toWorkflowSaveEdges, toWorkflowSaveNodes } from './codec/workflowSaveMapper'
  import { validateDag } from './validators/dagValidators'
  import { workflowDesignerApi } from '@/api/workflowDesigner'
  import { workflowApi } from '@/api/workflow'
  import { useLockManager } from '@/composables/useLockManager'
  import { logRoute } from '@/utils/logger'
  import DagCanvas from './canvas/DagCanvas.vue'
  import { findVacantNodePosition } from './canvas/nodePlacement'
  import DesignerToolbar from './toolbar/DesignerToolbar.vue'
  import NodePalette from './toolbar/NodePalette.vue'
  import NodeInspector from './inspector/NodeInspector.vue'
  import QuickPalette from './palette/QuickPalette.vue'
  import TemplateLibrary from './templates/TemplateLibrary.vue'
  import JsonSyncPanel from './toolbar/JsonSyncPanel.vue'

  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const tenantStore = useTenantStore()

  const store = useDesignerStore()
  const canvasRef = ref<InstanceType<typeof DagCanvas> | null>(null)
  const mermaidDialogVisible = ref(false)
  const mermaidText = ref('')
  const errorDrawerVisible = ref(false)
  const saving = ref(false)
  const loading = ref(false)

  const workflowId = computed<number | null>(() => {
    const raw = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
    if (typeof raw !== 'string' || raw.trim() === '') return null
    const id = Number(raw)
    return Number.isNaN(id) ? null : id
  })

  const lockMgr = useLockManager({
    onLost: (reason) => {
      ElMessage.warning(t(`workflowDesignerMvp.lock.lost_${reason}`))
    },
  })

  const errorCount = computed(() => store.validationErrors.length)

  /** 校验错误项点击 → 关抽屉 + 画布居中并选中该节点 */
  function locateNode(nodeId: string) {
    errorDrawerVisible.value = false
    canvasRef.value?.focusNode(nodeId)
  }

  function locateEdge(edgeId: string) {
    errorDrawerVisible.value = false
    canvasRef.value?.focusEdge(edgeId)
  }

  /**
   * 本地化单条校验错误。原本在模板内联 `t(e.messageKey, (e.args ?? {}) as ...)`,模板里的 `{}`
   * 会被 prettier 3.8 的 vue 解析器误判为 mustache 提前闭合 → 整个 `<li>` 报 "Unexpected closing
   * tag" 卡 pre-commit。抽成方法,模板只 `{{ localizeError(e) }}`,绕开该解析坑。
   */
  function localizeError(e: { messageKey: string; args?: Record<string, unknown> }): string {
    return t(e.messageKey, e.args ?? {})
  }
  const readonlyBanner = computed(() => {
    const lock = store.lock
    return lock && !lock.isMine && lock.lockedBy ? lock : null
  })

  // Polish 阶段:Ctrl+K 节点 palette / 模板库 / dagre 布局方向开关
  const quickPaletteVisible = ref(false)
  const templateLibraryVisible = ref(false)
  const layoutDirection = ref<'TB' | 'LR'>('TB')
  const canvasCenter = ref<{ x: number; y: number }>({ x: 320, y: 200 })
  const jsonPanelCollapsed = ref(true)
  const paletteCollapsed = ref(true)
  const inspectorExpanded = ref(false)
  const focusMode = ref(false)

  const selectedElementKey = computed(() => Array.from(store.selectedIds).sort().join('|'))
  const inspectorVisible = computed(() => !focusMode.value && inspectorExpanded.value)

  watch(selectedElementKey, (key) => {
    inspectorExpanded.value = key.length > 0 && !focusMode.value
    if (key.length > 0) paletteCollapsed.value = true
  })

  function toggleJsonPanel() {
    jsonPanelCollapsed.value = !jsonPanelCollapsed.value
  }

  function toggleFocusMode() {
    focusMode.value = !focusMode.value
    if (focusMode.value) jsonPanelCollapsed.value = true
    else inspectorExpanded.value = selectedElementKey.value.length > 0
    nextTick(() => canvasRef.value?.fitToViewport())
  }

  function togglePalette() {
    paletteCollapsed.value = !paletteCollapsed.value
    if (!paletteCollapsed.value) inspectorExpanded.value = false
  }

  function openInspector() {
    paletteCollapsed.value = true
    inspectorExpanded.value = true
  }

  /** 从画布读取当前视口中心(画布逻辑坐标),graph 未就绪时保持上次值。 */
  function refreshCanvasCenter() {
    const c = canvasRef.value?.getViewportCenter()
    if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) {
      canvasCenter.value = { x: c.x, y: c.y }
    }
  }

  function openQuickPalette() {
    refreshCanvasCenter()
    quickPaletteVisible.value = true
  }

  /** 点击节点库添加:按节点尺寸寻找视口中心附近的空位,避免连接桩被重叠节点遮挡。 */
  function onPaletteAdd(type: DesignerNodeType) {
    if (!store.editable) {
      ElMessage.warning(t('workflowDesignerMvp.lock.readonlyGuard'))
      return
    }
    refreshCanvasCenter()
    const position = findVacantNodePosition(type, canvasCenter.value, store.nodes)
    const code = `${type.toLowerCase()}_${String(Date.now()).slice(-4)}`
    store.addNode({
      nodeCode: code,
      nodeName: code,
      nodeType: type,
      x: position.x,
      y: position.y,
    })
  }
  function openTemplateLibrary() {
    templateLibraryVisible.value = true
  }
  function toggleLayoutDirection() {
    if (!store.editable) {
      ElMessage.warning(t('workflowDesignerMvp.lock.readonlyGuard'))
      return
    }
    layoutDirection.value = layoutDirection.value === 'TB' ? 'LR' : 'TB'
    canvasRef.value?.autoLayout(layoutDirection.value)
  }

  /**
   * 根据当前路由加载画布。
   *
   * `/workflow/designer` 与 `/workflow/designer/:id` 使用同一个路由记录，Vue Router
   * 会复用组件实例。新建成功后仅靠 `router.replace` 不会再次触发 `onMounted`，因此必须
   * 由路由参数监听来完成新建态→已有定义态的重新加载与真实编辑锁获取。
   */
  async function loadWorkflow(id: number | null) {
    loading.value = true
    await lockMgr.release()
    store.reset({ nodes: [], edges: [] })
    store.setLock(null)
    if (id == null) {
      // P3 新建模式:无 id → 无远端锁。模拟自己持锁让画布 / 表单可编辑(editable=true),
      // 保存时再调创建 API 拿真 id 并跳转到 /workflow/designer/{newId}。
      store.setMeta({
        id: null,
        tenantId: tenantStore.tenantId,
        workflowType: 'DAG',
        enabled: true,
        version: 0,
      })
      store.setLock({
        isMine: true,
        lockedBy: tenantStore.tenantId || 'me',
        expiresAt: '',
      })
      logRoute('[designer] mounted (new)', { tenantId: tenantStore.tenantId })
      loading.value = false
      return
    }
    try {
      const detail = await workflowDesignerApi.getFull(id, tenantStore.tenantId)
      // 反序列化 BE detail → designer snapshot。BE 的 ConsoleWorkflowNodeResponse
      // 字段名(relatedJobCode / relatedPipelineCode / nodeParams JSON 等)与设计书的
      // attrs key(jobCode / pipelineCode 等)之间走显式映射 + attrs 透传保底。
      const defJson = {
        nodes: (detail.nodes ?? []).map((n) => {
          const raw = n as unknown as Record<string, unknown>
          const nodeParamsRaw = typeof raw.nodeParams === 'string' ? raw.nodeParams : ''
          let parsedParams: Record<string, unknown> = {}
          if (nodeParamsRaw) {
            try {
              const obj = JSON.parse(nodeParamsRaw)
              if (obj && typeof obj === 'object') parsedParams = obj as Record<string, unknown>
            } catch {
              // 非 JSON 静默忽略
            }
          }
          return {
            nodeCode: n.nodeCode,
            nodeName: n.nodeName,
            nodeType: n.nodeType,
            // attrs 形态:把 BE 列名平翻成 inspector 期待的 key
            ...parsedParams,
            // 持久化列是权威来源；旧 nodeParams 只作为兼容回退，避免保存时把旧 JSON
            // 中的值覆盖当前已更新的显式列。
            jobCode: raw.relatedJobCode ?? parsedParams.jobCode,
            pipelineCode: raw.relatedPipelineCode ?? parsedParams.pipelineCode,
            workerGroup: raw.workerGroup ?? parsedParams.workerGroup,
            windowCode: raw.windowCode ?? parsedParams.windowCode,
            nodeOrder: raw.nodeOrder ?? parsedParams.nodeOrder,
            retryPolicy: raw.retryPolicy ?? parsedParams.retryPolicy,
            maxRetries: raw.retryMaxCount ?? parsedParams.maxRetries,
            timeoutSeconds: raw.timeoutSeconds ?? parsedParams.timeoutSeconds,
            crossDayDependencies: raw.crossDayDependencies ?? parsedParams.crossDayDependencies,
            crossDayDependencyTimeoutSeconds:
              raw.crossDayDependencyTimeoutSeconds ?? parsedParams.crossDayDependencyTimeoutSeconds,
            enabled: raw.enabled ?? parsedParams.enabled,
          }
        }),
        edges: (detail.edges ?? []).map((e) => {
          const raw = e as unknown as Record<string, unknown>
          return {
            sourceNodeCode: typeof raw.fromNodeCode === 'string' ? raw.fromNodeCode : '',
            targetNodeCode: typeof raw.toNodeCode === 'string' ? raw.toNodeCode : '',
            label: typeof raw.conditionExpr === 'string' ? raw.conditionExpr : undefined,
            edgeType: raw.edgeType,
            enabled: raw.enabled,
          }
        }),
      }
      store.reset(definitionToGraph(defJson))
      store.setMeta({
        id: detail.id,
        tenantId: detail.tenantId,
        workflowCode: detail.workflowCode,
        workflowName: detail.workflowName,
        workflowType: detail.workflowType,
        enabled: detail.enabled,
        description: detail.description,
        version: detail.version,
      })
      await nextTick()
      canvasRef.value?.fitToViewport()
      await lockMgr.acquire(id, tenantStore.tenantId)
    } catch (err) {
      logRoute('[designer] load failed', { err: String(err) })
      ElMessage.error(t('workflowDesignerMvp.loadFailed'))
    } finally {
      loading.value = false
    }
  }

  watch(
    workflowId,
    (id) => {
      void loadWorkflow(id)
    },
    { immediate: true },
  )

  // useLockManager 内部已在 onBeforeUnmount 兜底 release + beforeunload sendBeacon

  onMounted(() => {
    window.addEventListener('keydown', onGlobalKeyDown)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onGlobalKeyDown)
  })

  function onAutoLayout() {
    if (!store.editable) {
      ElMessage.warning(t('workflowDesignerMvp.lock.readonlyGuard'))
      return
    }
    canvasRef.value?.autoLayout(layoutDirection.value)
  }

  async function onUndo() {
    store.undo()
    await nextTick()
    canvasRef.value?.fitToViewport()
  }

  async function onRedo() {
    store.redo()
    await nextTick()
    canvasRef.value?.fitToViewport()
  }

  /**
   * 全局键盘快捷键(Polish 阶段)。
   * - Ctrl+K / Cmd+K → 打开 QuickPalette(拦截浏览器默认 chrome search)
   * - Ctrl+S / Cmd+S → 触发保存(prevent 浏览器原生保存对话框)
   * - Ctrl+A / Cmd+A → 全选所有节点(画布上下文)
   * - Ctrl+D / Cmd+D → 复制选中节点(右下偏移 40px)
   *
   * 注:Ctrl+Z/Y 由 DagCanvas 内部处理(画布编辑上下文),保持兼容。
   */
  function onGlobalKeyDown(ev: KeyboardEvent) {
    const meta = ev.ctrlKey || ev.metaKey
    if (!meta) return
    const key = ev.key.toLowerCase()
    const tag = (ev.target as HTMLElement | null)?.tagName ?? ''
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA'
    if (key === 'k') {
      ev.preventDefault()
      openQuickPalette()
      return
    }
    if (key === 's') {
      ev.preventDefault()
      void onSave()
      return
    }
    if (key === 'a' && !inInput) {
      ev.preventDefault()
      store.setSelection(store.nodes.map((n) => n.id))
      return
    }
    if (key === 'd' && !inInput) {
      ev.preventDefault()
      duplicateSelection()
    }
  }

  /**
   * 复制选中节点 — 粘贴到右下偏移 40px。
   * 复制不带边(避免歧义引用),nodeCode 自动生成新后缀。
   */
  function duplicateSelection() {
    if (!store.editable) return
    const ids = Array.from(store.selectedIds)
    if (ids.length === 0) return
    const newIds: string[] = []
    const suffixBase = String(Date.now()).slice(-4)
    for (const id of ids) {
      const n = store.nodes.find((nn) => nn.id === id)
      if (!n) continue
      const newCode = `${n.nodeCode}_dup_${suffixBase}`
      const sizeCenter = { x: n.x + 110, y: n.y + 90 }
      const position = findVacantNodePosition(n.nodeType, sizeCenter, store.nodes)
      store.addNode({
        nodeCode: newCode,
        nodeName: n.nodeName,
        nodeType: n.nodeType,
        x: position.x,
        y: position.y,
        attrs: { ...(n.attrs ?? {}) },
      })
      newIds.push(newCode)
    }
    if (newIds.length > 0) store.setSelection(newIds)
  }

  function runValidation(): boolean {
    const errs = validateDag(store.snapshot)
    store.setValidationErrors(errs)
    return errs.length === 0
  }

  function onValidate() {
    if (runValidation()) {
      ElMessage.success(t('workflowDesignerMvp.validateOk'))
    } else {
      errorDrawerVisible.value = true
    }
  }

  const isNewWorkflow = computed(() => workflowId.value == null)

  /**
   * P3 新建闭环:无 id 时调创建 API。
   * 设计器暂无元信息编辑面板(P5-P8 范围外),故 workflowCode / workflowName 用
   * prompt 兜底收集(已有则复用 meta)。创建成功后跳转到带 id 的设计器路由(组件重挂载)。
   */
  async function createNewWorkflow(): Promise<boolean> {
    let workflowCode = store.meta.workflowCode
    let workflowName = store.meta.workflowName
    if (!workflowCode || !workflowName) {
      try {
        const codeRes = await ElMessageBox.prompt(
          t('workflowDesignerMvp.create.codePrompt'),
          t('workflowDesignerMvp.create.title'),
          {
            confirmButtonText: t('common.ok'),
            cancelButtonText: t('common.cancel'),
            inputValue: workflowCode,
            inputPattern: /^[A-Za-z0-9_-]+$/,
            inputErrorMessage: t('workflowDesignerMvp.create.codeInvalid'),
          },
        )
        workflowCode = codeRes.value.trim()
        const nameRes = await ElMessageBox.prompt(
          t('workflowDesignerMvp.create.namePrompt'),
          t('workflowDesignerMvp.create.title'),
          {
            confirmButtonText: t('common.ok'),
            cancelButtonText: t('common.cancel'),
            inputValue: workflowName || workflowCode,
          },
        )
        workflowName = nameRes.value.trim() || workflowCode
      } catch {
        return false
      }
    }
    const def = graphToDefinition(store.snapshot)
    const body = {
      tenantId: store.meta.tenantId || tenantStore.tenantId,
      workflowCode,
      workflowName,
      workflowType: store.meta.workflowType || 'DAG',
      enabled: store.meta.enabled,
      nodes: toWorkflowSaveNodes(def.nodes),
      edges: toWorkflowSaveEdges(def.edges),
    }
    const created = await workflowApi.create(body)
    store.markClean()
    ElMessage.success(t('workflowDesignerMvp.saveOk'))
    // 跳转到带 id 的设计器路由 → 组件重挂载并 acquire 真实锁
    await router.replace({ path: `/workflow/designer/${created.id}` })
    return true
  }

  async function onSave() {
    if (!store.editable) {
      ElMessage.warning(t('workflowDesignerMvp.lock.cannotSaveReadonly'))
      return
    }
    if (!runValidation()) {
      errorDrawerVisible.value = true
      return
    }
    if (isNewWorkflow.value) {
      saving.value = true
      try {
        await createNewWorkflow()
      } catch (err) {
        logRoute('[designer] create failed', { err: String(err) })
        ElMessage.error(t('workflowDesignerMvp.create.failed'))
      } finally {
        saving.value = false
      }
      return
    }
    saving.value = true
    try {
      const def = graphToDefinition(store.snapshot)
      // BE WorkflowDefinitionFullUpdateRequest 是 nested:{ definition: SaveRequest, expectedVersion, lockToken }
      // SaveRequest 内含 tenantId / workflowCode / workflowName / workflowType / enabled / nodes / edges
      // expectedVersion 与 lockToken 是顶层(乐观锁 + 锁归属预留)
      const body = {
        definition: {
          tenantId: store.meta.tenantId,
          workflowCode: store.meta.workflowCode,
          workflowName: store.meta.workflowName,
          workflowType: store.meta.workflowType,
          enabled: store.meta.enabled,
          nodes: toWorkflowSaveNodes(def.nodes),
          edges: toWorkflowSaveEdges(def.edges),
        },
        expectedVersion: store.meta.version,
      }
      // 此处必非新建态(isNewWorkflow 已早返),workflowId 必为有效 number
      const updated = await workflowDesignerApi.putFull(workflowId.value as number, body)
      store.setMeta({ version: updated.version })
      store.markClean()
      ElMessage.success(t('workflowDesignerMvp.saveOk'))
    } catch (err) {
      const ax = err as { response?: { status?: number; data?: Record<string, unknown> } }
      const status = ax?.response?.status
      if (status === 409) {
        const payload =
          (ax.response?.data?.data as Record<string, unknown>) ?? ax.response?.data ?? {}
        const lockedBy = typeof payload?.lockedBy === 'string' ? payload.lockedBy : ''
        if (lockedBy) {
          await ElMessageBox.alert(
            t('workflowDesignerMvp.lock.editingBy', { who: lockedBy }),
            t('workflowDesignerMvp.lock.conflictTitle'),
            { confirmButtonText: t('common.ok') },
          )
        } else {
          await ElMessageBox.alert(
            t('workflowDesignerMvp.versionConflict'),
            t('workflowDesignerMvp.versionConflictTitle'),
            { confirmButtonText: t('common.ok') },
          )
        }
      } else {
        // 非 409 的保存失败(如 BE 配置期校验拒绝:跨 workflow 嵌套环检测等)此前只 log、无任何
        // 用户提示 —— 用户点保存却"没反应"。改为弹出 BE 返回的具体原因(CommonResponse.message),
        // 取不到再回退通用文案。
        const beMsg =
          (typeof ax?.response?.data?.message === 'string' && ax.response.data.message) || ''
        ElMessage.error(beMsg || t('workflowDesignerMvp.saveFailed'))
        logRoute('[designer] save failed', { status, err: String(err) })
      }
    } finally {
      saving.value = false
    }
  }

  function onExportMermaid() {
    mermaidText.value = exportMermaid(store.snapshot)
    mermaidDialogVisible.value = true
  }
</script>

<template>
  <div v-loading="loading" class="workflow-designer">
    <DesignerToolbar
      :saving="saving"
      :can-save="store.editable"
      :layout-direction="layoutDirection"
      :json-panel-open="!jsonPanelCollapsed"
      :focus-mode="focusMode"
      @auto-layout="onAutoLayout"
      @undo="onUndo"
      @redo="onRedo"
      @validate="onValidate"
      @save="onSave"
      @export-mermaid="onExportMermaid"
      @open-quick-palette="openQuickPalette"
      @open-template-library="openTemplateLibrary"
      @toggle-layout-direction="toggleLayoutDirection"
      @toggle-json="toggleJsonPanel"
      @focus-node="locateNode"
      @toggle-focus-mode="toggleFocusMode"
    />
    <div
      v-if="readonlyBanner"
      class="workflow-designer__banner workflow-designer__banner--readonly"
    >
      {{ t('workflowDesignerMvp.lock.readonlyBanner', { who: readonlyBanner.lockedBy }) }}
    </div>
    <div
      v-if="errorCount > 0"
      class="workflow-designer__banner workflow-designer__banner--error"
      role="button"
      tabindex="0"
      :aria-label="t('workflowDesignerMvp.errorBannerAria')"
      @click="errorDrawerVisible = true"
      @keydown.enter="errorDrawerVisible = true"
    >
      {{ t('workflowDesignerMvp.errorBanner', { count: errorCount }) }}
    </div>
    <JsonSyncPanel
      v-if="!jsonPanelCollapsed"
      v-model:collapsed="jsonPanelCollapsed"
      :readonly="!store.editable"
    />
    <div
      class="workflow-designer__body"
      :class="{
        'workflow-designer__body--palette-expanded': !paletteCollapsed && !focusMode,
        'workflow-designer__body--inspector-visible': inspectorVisible,
        'workflow-designer__body--focus': focusMode,
      }"
    >
      <NodePalette
        v-if="!focusMode"
        :collapsed="paletteCollapsed"
        @toggle="togglePalette"
        @add="onPaletteAdd"
      />
      <section class="workflow-designer__canvas-shell">
        <div class="workflow-designer__canvas-status">
          <span>{{ store.meta.workflowCode || t('workflowDesignerMvp.untitledWorkflow') }}</span>
          <el-tag size="small" effect="plain">
            {{ store.nodes.length }} nodes / {{ store.edges.length }} edges
          </el-tag>
          <el-tag size="small" type="info" effect="plain"> {{ layoutDirection }} </el-tag>
        </div>
        <DagCanvas ref="canvasRef" />
        <el-tooltip
          v-if="!inspectorVisible && !focusMode"
          :content="t('workflowDesignerMvp.layout.openInspector')"
          placement="left"
        >
          <el-button
            class="workflow-designer__open-inspector"
            circle
            :icon="PanelRightOpen"
            :aria-label="t('workflowDesignerMvp.layout.openInspector')"
            @click="openInspector"
          />
        </el-tooltip>
        <div v-if="store.nodes.length === 0" class="workflow-designer__empty-canvas">
          <div class="workflow-designer__empty-title">
            {{ t('workflowDesignerMvp.canvasEmptyTitle') }}
          </div>
          <div class="workflow-designer__empty-desc">
            {{ t('workflowDesignerMvp.canvasEmptyDesc') }}
          </div>
          <div class="workflow-designer__empty-actions">
            <el-button type="primary" @click="openQuickPalette">
              {{ t('workflowDesignerPolish.actionQuickPalette') }}
            </el-button>
            <el-button @click="openTemplateLibrary">
              {{ t('workflowDesignerPolish.actionTemplates') }}
            </el-button>
          </div>
        </div>
      </section>
      <NodeInspector v-if="inspectorVisible" @close="inspectorExpanded = false" />
    </div>

    <el-drawer
      v-model="errorDrawerVisible"
      :title="t('workflowDesignerMvp.errorDrawerTitle')"
      direction="rtl"
      size="380px"
    >
      <ul class="error-list">
        <li
          v-for="(e, idx) in store.validationErrors"
          :key="idx"
          class="error-list__item"
          :class="{ 'error-list__item--locatable': !!e.nodeId || !!e.edgeId }"
          :role="e.nodeId || e.edgeId ? 'button' : undefined"
          :tabindex="e.nodeId || e.edgeId ? 0 : undefined"
          @click="e.nodeId ? locateNode(e.nodeId) : e.edgeId && locateEdge(e.edgeId)"
          @keydown.enter="e.nodeId ? locateNode(e.nodeId) : e.edgeId && locateEdge(e.edgeId)"
        >
          <span v-if="e.nodeId" class="error-list__node">[{{ e.nodeId }}]</span>
          <span v-else-if="e.edgeId" class="error-list__node">[{{ e.edgeId }}]</span>
          {{ localizeError(e) }}
        </li>
      </ul>
    </el-drawer>

    <QuickPalette
      v-model:visible="quickPaletteVisible"
      :center-x="canvasCenter.x"
      :center-y="canvasCenter.y"
    />
    <TemplateLibrary v-model:visible="templateLibraryVisible" />

    <el-dialog
      v-model="mermaidDialogVisible"
      :title="t('workflowDesignerSpike.mermaidDialogTitle')"
      width="600px"
    >
      <el-input
        v-model="mermaidText"
        type="textarea"
        :rows="12"
        readonly
        :aria-label="t('workflowDesignerSpike.mermaidDialogTitle')"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
  .workflow-designer {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: calc(100vh - 60px);
    min-width: 0;
    overflow: hidden;
    background: var(--color-bg-page);
  }
  .workflow-designer__body {
    --designer-palette-width: 56px;
    --designer-inspector-width: 0px;

    display: grid;
    grid-template-columns:
      var(--designer-palette-width) minmax(0, 1fr)
      var(--designer-inspector-width);
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    gap: 0;
    padding: 8px;
    overflow: hidden;
    transition: grid-template-columns 160ms ease;
  }
  .workflow-designer__body--palette-expanded {
    --designer-palette-width: 176px;
  }
  .workflow-designer__body--inspector-visible {
    --designer-inspector-width: 320px;
  }
  .workflow-designer__body--focus {
    --designer-palette-width: 0px;
    --designer-inspector-width: 0px;
  }
  .workflow-designer__body > :deep(.node-palette) {
    grid-column: 1;
  }
  .workflow-designer__canvas-shell {
    grid-column: 2;
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-canvas, #e9eef5);
  }
  .workflow-designer__body > :deep(.node-inspector) {
    grid-column: 3;
  }
  .workflow-designer__canvas-status {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100% - 24px);
    padding: 6px 8px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-card) 92%, transparent);
    box-shadow: 0 8px 20px color-mix(in srgb, #1f2937 8%, transparent);
    color: var(--color-text-secondary);
    font-size: 12px;
  }
  .workflow-designer__canvas-status > span {
    min-width: 0;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 650;
    color: var(--color-text-primary);
  }
  .workflow-designer__open-inspector {
    position: absolute;
    top: 52px;
    right: 12px;
    z-index: 4;
    box-shadow: var(--shadow-sm);
  }
  .workflow-designer__empty-canvas {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    width: min(360px, calc(100% - 48px));
    padding: 18px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-card) 94%, transparent);
    box-shadow: 0 16px 36px color-mix(in srgb, #1f2937 10%, transparent);
    text-align: center;
    transform: translate(-50%, -50%);
  }
  .workflow-designer__empty-title {
    font-size: 15px;
    font-weight: 650;
    color: var(--color-text-primary);
  }
  .workflow-designer__empty-desc {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }
  .workflow-designer__empty-actions {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 14px;
  }
  .workflow-designer__banner {
    padding: 8px 16px;
    font-size: 12px;
    border-bottom: 1px solid var(--color-border-light, #ebeef5);
    cursor: pointer;
  }
  .workflow-designer__banner--readonly {
    background: var(--el-color-warning-light-9);
    color: var(--el-color-warning-dark-2);
    cursor: default;
  }
  .workflow-designer__banner--error {
    background: var(--el-color-danger-light-9);
    color: var(--color-danger, #f56c6c);
  }
  .error-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .error-list__item {
    padding: 8px 16px;
    border-bottom: 1px solid var(--color-border-light, #ebeef5);
    font-size: 12px;
    color: var(--color-text-primary, #303133);
  }
  .error-list__item--locatable {
    cursor: pointer;
  }
  .error-list__item--locatable:hover {
    background: var(--color-bg-subtle, #f5f7fa);
  }
  .error-list__node {
    color: var(--color-danger, #f56c6c);
    margin-right: 4px;
    font-family: monospace;
  }

  @media (max-width: 1100px) {
    .workflow-designer__body--palette-expanded {
      --designer-palette-width: 160px;
    }
    .workflow-designer__body--inspector-visible {
      --designer-inspector-width: 280px;
    }
  }

  @media (max-width: 760px) {
    .workflow-designer {
      min-height: calc(100vh - 48px);
    }

    .workflow-designer__body {
      overflow: auto;
    }
    .workflow-designer__body--palette-expanded {
      --designer-palette-width: 132px;
    }
    .workflow-designer__body--inspector-visible {
      --designer-inspector-width: 250px;
    }
  }
</style>
