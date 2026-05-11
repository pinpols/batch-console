/**
 * Workflow Designer — data loading, saving, draft persistence, definition list,
 * submit to backend, DSL preview.
 */
import { computed, onScopeDispose, ref, watch, type Ref, type ShallowRef } from 'vue'
import type { Graph, Edge as X6Edge } from '@antv/x6'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import {
  queryWorkflowDefinitions,
  queryWorkflowEdges,
  queryWorkflowNodes,
} from '@/api/workflowQueries'
import { workflowApi } from '@/api/workflow'
import { useTenantStore } from '@/stores/tenant'
import type { ConsoleWorkflowDefinitionResponse } from '@/types/console-api'
import {
  type WorkflowFormState,
  type WorkflowNodeDraft,
  type WorkflowEdgeDraft,
  type WorkflowDraftPayload,
  type ValidationIssue,
  type WorkflowNodeKind,
  type WorkflowEdgeKind,
  copyWorkflowForm,
  normalizeWorkflowDefinition,
  normalizeWorkflowNode,
  normalizeWorkflowEdge,
  layoutWorkflowNodes,
} from './workflowConstants'

export interface DataDeps {
  graph: ShallowRef<Graph | null>
  graphReady: Ref<boolean>
  graphVersion: Ref<number>
  selectedCellId: Ref<string>
  workflowForm: WorkflowFormState
  currentWorkflowExportNodes: () => WorkflowNodeDraft[]
  currentWorkflowExportEdges: () => WorkflowEdgeDraft[]
  graphNodesSnapshot: () => WorkflowNodeDraft[]
  graphEdgesSnapshot: () => WorkflowEdgeDraft[]
  resetGraph: (
    nodes: WorkflowNodeDraft[],
    edges: WorkflowEdgeDraft[],
    layoutFn: (n: WorkflowNodeDraft[], e: WorkflowEdgeDraft[]) => WorkflowNodeDraft[],
  ) => void
  syncGraphDerivedState: (opts?: { queueDraft?: boolean; skipValidation?: boolean }) => void
  edgeDraftFromGraphCell: (cell: X6Edge) => WorkflowEdgeDraft
}

export function useWorkflowData(deps: DataDeps) {
  const {
    graph,
    graphReady,
    graphVersion,
    workflowForm,
    currentWorkflowExportNodes,
    currentWorkflowExportEdges,
    resetGraph,
    syncGraphDerivedState,
  } = deps

  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()

  const definitionsLoading = ref(false)
  const loadingWorkflow = ref(false)
  const submittingToBackend = ref(false)
  const selectedWorkflowCode = ref('')
  const definitionOptions = ref<ConsoleWorkflowDefinitionResponse[]>([])
  const workflowDefinition = ref<ConsoleWorkflowDefinitionResponse | null>(null)
  const draftSource = ref<'backend' | 'local-draft'>('backend')
  const draftUpdatedAt = ref('')
  const validationIssues = ref<ValidationIssue[]>([])
  /** DSL 折叠面板默认收起，减轻右侧视觉负担 */
  const dslPanelOpen = ref<string[]>([])

  const routeWorkflowCode = computed(() => {
    const code = (route.params.code as string) || (route.query.workflowCode as string) || ''
    return code.trim()
  })

  const currentDraftKey = computed(() =>
    selectedWorkflowCode.value
      ? `workflow-editor:draft:${tenant.tenantId}:${selectedWorkflowCode.value}`
      : '',
  )

  const selectedDefinition = computed(
    () =>
      definitionOptions.value.find((item) => item.workflowCode === selectedWorkflowCode.value) ??
      null,
  )

  const subtitle = computed(() => {
    if (!selectedWorkflowCode.value)
      return '从列表选择 Workflow 后即可在画布上编排节点、条件边和多前驱汇聚。'
    return `当前模型: workflow_node + workflow_edge + DAG join · ${selectedWorkflowCode.value}`
  })

  const draftSavedDisplay = computed(() => {
    const iso = draftUpdatedAt.value.trim()
    const src = draftSource.value
    if (!iso) {
      return {
        main: '—',
        sub: src === 'backend' ? '来自后端，未写本地' : '暂无本地保存',
        tip: '',
      }
    }
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      return { main: iso, sub: '时间格式异常', tip: iso }
    }
    const p = (n: number) => String(n).padStart(2, '0')
    const main = `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    return {
      main,
      sub: '已写入本机浏览器',
      tip: `完整时间：${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} · ${iso}`,
    }
  })

  const dslPreview = computed(() => {
    if (!dslPanelOpen.value.includes('preview')) return ''
    void graphVersion.value
    return JSON.stringify(buildDraftPayload(), null, 2)
  })

  const dslPreviewLines = computed(() =>
    dslPreview.value ? dslPreview.value.split('\n').length : 0,
  )

  // ─── Draft payload ─────────────────────────────────────────────────────────

  function buildDraftPayload(): WorkflowDraftPayload {
    return {
      workflowDefinition: {
        ...workflowForm,
        tenantId: tenant.tenantId,
        version: selectedDefinition.value?.version ?? workflowDefinition.value?.version ?? 1,
        id: selectedDefinition.value?.id ?? workflowDefinition.value?.id ?? null,
      },
      nodes: deps.graphNodesSnapshot().map((node) => {
        const cell = graph.value?.getCellById(node.nodeCode)
        const pos = cell?.isNode() ? (cell as import('@antv/x6').Node).position() : null
        return { ...node, x: pos?.x ?? node.x, y: pos?.y ?? node.y }
      }),
      edges: deps.graphEdgesSnapshot(),
      savedAt: draftUpdatedAt.value || new Date().toISOString(),
    }
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  function validateGraph(): ValidationIssue[] {
    if (!graph.value) return []
    const nodes = currentWorkflowExportNodes()
    const topologyEdges = graph.value
      .getEdges()
      .map((cell) => {
        const e = cell as import('@antv/x6').Edge
        const from = e.getSourceCellId()
        const to = e.getTargetCellId()
        if (!from || !to) return null
        return { from, to, id: String(e.id) }
      })
      .filter((x): x is { from: string; to: string; id: string } => x != null)
    const issues: ValidationIssue[] = []
    const seen = new Set<string>()
    const nodeMap = new Map(nodes.map((node) => [node.nodeCode, node]))
    const pushIssue = (issue: ValidationIssue) => {
      const key = `${issue.level}|${issue.nodeCode || ''}|${issue.edgeId || ''}|${issue.message}`
      if (seen.has(key)) return
      seen.add(key)
      issues.push(issue)
    }

    const starts = nodes.filter((node) => node.nodeType === 'START')
    const ends = nodes.filter((node) => node.nodeType === 'END')
    if (starts.length === 0) pushIssue({ level: 'error', message: '缺少 START 节点' })
    if (starts.length > 1) {
      pushIssue({
        level: 'error',
        message: '存在多个 START 节点',
        nodeCode: starts[1]?.nodeCode ?? starts[0]?.nodeCode,
      })
    }
    if (ends.length === 0) pushIssue({ level: 'error', message: '缺少 END 节点' })
    if (ends.length > 1) {
      pushIssue({
        level: 'error',
        message: '存在多个 END 节点',
        nodeCode: ends[1]?.nodeCode ?? ends[0]?.nodeCode,
      })
    }

    for (const edge of topologyEdges) {
      if (!nodeMap.has(edge.from)) {
        pushIssue({
          level: 'error',
          message: `边 ${edge.id} 的 source 不存在: ${edge.from}`,
          edgeId: edge.id,
        })
      }
      if (!nodeMap.has(edge.to)) {
        pushIssue({
          level: 'error',
          message: `边 ${edge.id} 的 target 不存在: ${edge.to}`,
          edgeId: edge.id,
        })
      }
      if (edge.from === edge.to) {
        pushIssue({
          level: 'error',
          message: `边 ${edge.id} 形成了自环`,
          edgeId: edge.id,
        })
      }
    }

    const incomingCount = new Map<string, number>()
    const outgoingCount = new Map<string, number>()
    for (const node of nodes) {
      incomingCount.set(node.nodeCode, 0)
      outgoingCount.set(node.nodeCode, 0)
    }
    for (const edge of topologyEdges) {
      incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1)
      outgoingCount.set(edge.from, (outgoingCount.get(edge.from) ?? 0) + 1)
    }

    for (const node of nodes) {
      if (node.nodeType === 'JOIN' && (incomingCount.get(node.nodeCode) ?? 0) < 2) {
        pushIssue({
          level: 'warning',
          message: `JOIN 节点 ${node.nodeCode} 的前驱少于 2 个`,
          nodeCode: node.nodeCode,
        })
      }
      if (node.nodeType === 'DECISION' && (outgoingCount.get(node.nodeCode) ?? 0) < 2) {
        pushIssue({
          level: 'warning',
          message: `DECISION 节点 ${node.nodeCode} 的分支少于 2 条`,
          nodeCode: node.nodeCode,
        })
      }
    }

    const graphMap = new Map<string, string[]>()
    for (const node of nodes) graphMap.set(node.nodeCode, [])
    for (const edge of topologyEdges) {
      graphMap.get(edge.from)?.push(edge.to)
    }

    const temp = new Set<string>()
    const perm = new Set<string>()
    const dfs = (code: string, path: string[]) => {
      if (perm.has(code)) return
      if (temp.has(code)) {
        const cycleStart = path.indexOf(code)
        const cycleNodes = cycleStart >= 0 ? path.slice(cycleStart).concat(code) : [code]
        pushIssue({
          level: 'error',
          message: `检测到循环引用: ${cycleNodes.join(' -> ')}`,
          nodeCode: code,
        })
        return
      }
      temp.add(code)
      for (const next of graphMap.get(code) ?? []) {
        dfs(next, [...path, code])
      }
      temp.delete(code)
      perm.add(code)
    }
    for (const start of nodes.map((node) => node.nodeCode)) {
      dfs(start, [])
    }

    const reachable = new Set<string>()
    const stack = starts.map((node) => node.nodeCode)
    while (stack.length) {
      const code = stack.pop() as string
      if (reachable.has(code)) continue
      reachable.add(code)
      for (const next of graphMap.get(code) ?? []) stack.push(next)
    }
    for (const node of nodes) {
      if (!reachable.has(node.nodeCode)) {
        pushIssue({
          level: 'warning',
          message: `节点 ${node.nodeCode} 不可从 START 到达`,
          nodeCode: node.nodeCode,
        })
      }
    }

    return issues
  }

  // ─── Draft persistence ─────────────────────────────────────────────────────

  /** 草稿最大有效期：30 天 */
  const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
  let lastDraftPersistWarningAt = 0
  let draftTimer: number | null = null

  function readDraft(): WorkflowDraftPayload | null {
    if (!currentDraftKey.value) return null
    try {
      const raw = window.localStorage.getItem(currentDraftKey.value)
      if (!raw) return null
      const draft = JSON.parse(raw) as WorkflowDraftPayload
      if (!draft.workflowDefinition || !Array.isArray(draft.nodes) || !Array.isArray(draft.edges)) {
        throw new Error('草稿结构不完整')
      }
      if (draft.savedAt) {
        const savedTime = new Date(draft.savedAt).getTime()
        if (Number.isFinite(savedTime) && Date.now() - savedTime > DRAFT_MAX_AGE_MS) {
          try {
            window.localStorage.removeItem(currentDraftKey.value)
          } catch {
            /* ignore */
          }
          ElMessage.warning('本地草稿已过期（超过 30 天），已自动清除')
          return null
        }
      }
      return draft
    } catch {
      try {
        window.localStorage.removeItem(currentDraftKey.value)
      } catch {
        /* ignore */
      }
      ElMessage.warning('本地草稿数据已损坏，已自动清除，将加载后端数据')
      return null
    }
  }

  function notifyDraftPersistenceFailure(showMessage: boolean) {
    const now = Date.now()
    if (!showMessage && now - lastDraftPersistWarningAt < 8000) return
    lastDraftPersistWarningAt = now
    if (showMessage) {
      ElMessage.error('本地草稿保存失败，请检查浏览器存储权限或空间')
      return
    }
    ElMessage.warning('本地草稿保存失败，请检查浏览器存储权限或空间')
  }

  /**
   * O5:相同内容避免重复写 localStorage。
   * 防抖 350ms 后常常 form 没任何变化(比如只是短暂 focus 输入框又失焦)
   * 也会触发 persistDraft,产生一次无效 JSON.stringify + setItem。
   * 缓存上次写入的 body(去掉 savedAt) 作指纹,相同就跳过 setItem,
   * 但仍更新 draftUpdatedAt 让 UI 显示"刚检查过"。用户手点保存
   * (showMessage=true) 时不做去重,保证 toast 语义准确。
   */
  let _lastPersistedDraftBody = ''
  function persistDraft(showMessage = true) {
    if (!currentDraftKey.value || !graph.value) return
    try {
      const payload = buildDraftPayload()
      const now = new Date().toISOString()
      payload.savedAt = now
      const fullJson = JSON.stringify(payload)
      // 去掉 savedAt 字段做指纹(savedAt 每次都会变)
      const bodyPayload = { ...payload, savedAt: '' }
      const bodyJson = JSON.stringify(bodyPayload)
      const unchanged = !showMessage && bodyJson === _lastPersistedDraftBody
      if (!unchanged) {
        window.localStorage.setItem(currentDraftKey.value, fullJson)
        _lastPersistedDraftBody = bodyJson
      }
      draftSource.value = 'local-draft'
      draftUpdatedAt.value = now
      validationIssues.value = validateGraph()
      if (showMessage) ElMessage.success('草稿已保存到本地浏览器')
    } catch {
      notifyDraftPersistenceFailure(showMessage)
    }
  }

  function saveDraft() {
    persistDraft(true)
  }

  function queueDraftSave() {
    if (!currentDraftKey.value) return
    if (draftTimer != null) window.clearTimeout(draftTimer)
    draftTimer = window.setTimeout(() => {
      draftTimer = null
      persistDraft(false)
    }, 350)
  }

  /**
   * 切租户时跑在 useTenantReload 回调之前:
   *   1) 取消 pending 的 draft 防抖,否则回调会在 tenant 变更后触发,
   *      用旧 form 数据写到新租户的 localStorage key。
   *   2) 用"旧"tenantId 删除该租户下当前 workflow 的草稿。原来 clearDraft
   *      在 useTenantReload 里跑,tenant.tenantId 已经是新值,
   *      删错 key → 旧租户草稿残留。
   *
   * 注:本 watch 注册早于 WorkflowDesigner.vue 里的 useTenantReload,
   * Vue 同 tick 内按注册顺序 flush,本 watch 先跑。
   */
  watch(
    () => tenant.tenantId,
    (_newId, oldId) => {
      if (draftTimer != null) {
        window.clearTimeout(draftTimer)
        draftTimer = null
      }
      if (oldId && selectedWorkflowCode.value) {
        try {
          window.localStorage.removeItem(
            `workflow-editor:draft:${oldId}:${selectedWorkflowCode.value}`,
          )
        } catch {
          /* ignore quota / privacy mode */
        }
      }
    },
  )

  function clearDraft(shouldToast = true) {
    if (currentDraftKey.value) {
      try {
        window.localStorage.removeItem(currentDraftKey.value)
      } catch {
        if (shouldToast) {
          ElMessage.error('本地草稿清除失败，请检查浏览器存储权限')
        }
        return
      }
    }
    _lastPersistedDraftBody = ''
    draftSource.value = 'backend'
    draftUpdatedAt.value = ''
    if (shouldToast) {
      ElMessage.success('本地草稿已清除，正在重新加载后端数据…')
      void loadWorkflow()
    }
  }

  function flushPendingDraft() {
    if (draftTimer != null) {
      window.clearTimeout(draftTimer)
      draftTimer = null
      persistDraft(false)
    }
  }

  // 组件卸载时清掉 pending 的 draft 定时器,避免 stale 回调写入已销毁的 refs
  onScopeDispose(() => {
    if (draftTimer != null) {
      window.clearTimeout(draftTimer)
      draftTimer = null
    }
  })

  // ─── Load definitions ──────────────────────────────────────────────────────

  // token 守卫:切租户时上一个租户的 list 响应晚到,会把旧 defs 塞进新状态、
  // 又触发 selectedWorkflowCode 变更引发二次 loadWorkflow。和 loadWorkflowToken 同一模式。
  let loadDefinitionsToken = 0

  async function loadDefinitions() {
    const token = ++loadDefinitionsToken
    definitionsLoading.value = true
    try {
      const defs = await queryWorkflowDefinitions(tenant.tenantId)
      if (token !== loadDefinitionsToken) return
      definitionOptions.value = defs
      const routeCode = routeWorkflowCode.value
      const nextCode =
        (routeCode && defs.some((item) => item.workflowCode === routeCode)
          ? routeCode
          : defs[0]?.workflowCode) ?? ''
      if (nextCode && nextCode !== selectedWorkflowCode.value) {
        selectedWorkflowCode.value = nextCode
      }
      if (!nextCode) {
        selectedWorkflowCode.value = ''
        workflowDefinition.value = null
      }
    } catch (err) {
      if (token === loadDefinitionsToken) {
        ElMessage.error(`加载定义列表失败：${err instanceof Error ? err.message : '未知错误'}`)
      }
    } finally {
      if (token === loadDefinitionsToken) definitionsLoading.value = false
    }
  }

  // ─── Load workflow ─────────────────────────────────────────────────────────

  let loadWorkflowToken = 0
  /** 草稿恢复期间为 true，阻止 selectedDefinition watcher 用后端数据覆盖草稿 form */
  let suppressDefinitionFormSync = false

  function getSuppressDefinitionFormSync() {
    return suppressDefinitionFormSync
  }
  function clearSuppressDefinitionFormSync() {
    suppressDefinitionFormSync = false
  }

  async function loadWorkflow() {
    if (!selectedWorkflowCode.value) return
    const token = ++loadWorkflowToken
    loadingWorkflow.value = true
    // 切换 workflow 时清掉 O5 指纹,避免跨 workflow 错判"未变化"
    _lastPersistedDraftBody = ''
    try {
      const defs = definitionOptions.value.length
        ? definitionOptions.value
        : await queryWorkflowDefinitions(tenant.tenantId)
      if (token !== loadWorkflowToken) return
      definitionOptions.value = defs
      const def = defs.find((item) => item.workflowCode === selectedWorkflowCode.value)
      if (!def) {
        workflowDefinition.value = null
        resetGraph([], [], layoutWorkflowNodes)
        return
      }
      workflowDefinition.value = def
      copyWorkflowForm(normalizeWorkflowDefinition(def, tenant.tenantId), workflowForm)

      const draft = readDraft()
      if (draft) {
        draftSource.value = 'local-draft'
        draftUpdatedAt.value = draft.savedAt
        suppressDefinitionFormSync = true
        copyWorkflowForm(draft.workflowDefinition, workflowForm)
        workflowDefinition.value = {
          ...def,
          workflowCode: draft.workflowDefinition.workflowCode,
          workflowName: draft.workflowDefinition.workflowName,
          workflowType: draft.workflowDefinition.workflowType,
          enabled: draft.workflowDefinition.enabled,
          description: draft.workflowDefinition.description,
          version: draft.workflowDefinition.version,
        }
        resetGraph(draft.nodes, draft.edges, layoutWorkflowNodes)
        return
      }

      const [nodes, edges] = await Promise.all([
        queryWorkflowNodes(tenant.tenantId, def.id),
        queryWorkflowEdges(tenant.tenantId, def.id),
      ])
      if (token !== loadWorkflowToken) return
      const pickedNodes = nodes
        .filter((item) => item.workflowDefinitionId === def.id)
        .map(normalizeWorkflowNode)
      const pickedEdges = edges
        .filter((item) => item.workflowDefinitionId === def.id)
        .map(normalizeWorkflowEdge)
      draftSource.value = 'backend'
      draftUpdatedAt.value = ''
      resetGraph(pickedNodes, pickedEdges, layoutWorkflowNodes)
    } catch (err) {
      if (token === loadWorkflowToken) {
        ElMessage.error(`加载 Workflow 失败：${err instanceof Error ? err.message : '未知错误'}`)
      }
    } finally {
      if (token === loadWorkflowToken) loadingWorkflow.value = false
    }
  }

  function reloadDefinitions() {
    void loadDefinitions()
  }

  function reloadWorkflow() {
    clearDraft(false)
    void loadWorkflow()
  }

  // ─── Apply definition form ────────────────────────────────────────────────

  function applyDefinitionForm() {
    if (!workflowDefinition.value) return
    workflowDefinition.value = {
      ...workflowDefinition.value,
      workflowCode: workflowForm.workflowCode,
      workflowName: workflowForm.workflowName,
      workflowType: workflowForm.workflowType,
      enabled: workflowForm.enabled,
      description: workflowForm.description,
    }
    persistDraft()
  }

  // ─── Submit to backend ─────────────────────────────────────────────────────

  async function submitToBackend() {
    if (!graph.value || !selectedWorkflowCode.value) return

    const issues = validationIssues.value.filter((i) => i.level === 'error')
    if (issues.length) {
      ElMessage.warning(`存在 ${issues.length} 个校验错误，请修复后再提交`)
      return
    }

    const isUpdate = !!workflowDefinition.value?.id
    try {
      await ElMessageBox.confirm(
        isUpdate
          ? `确认将当前画布内容提交到后端，覆盖「${selectedWorkflowCode.value}」的线上编排？`
          : `确认将「${selectedWorkflowCode.value}」作为新 Workflow 提交到后端？`,
        '提交确认',
        { type: 'warning', confirmButtonText: '确认提交', cancelButtonText: '取消' },
      )
    } catch {
      return
    }

    const nodes = currentWorkflowExportNodes()
    const edges = currentWorkflowExportEdges()
    const body = {
      tenantId: tenant.tenantId,
      workflowCode: workflowForm.workflowCode,
      workflowName: workflowForm.workflowName,
      workflowType: workflowForm.workflowType,
      enabled: workflowForm.enabled,
      description: workflowForm.description,
      nodes: nodes.map((n) => ({
        nodeCode: n.nodeCode,
        nodeName: n.nodeName,
        nodeType: n.nodeType,
        relatedJobCode: n.relatedJobCode || undefined,
        relatedPipelineCode: n.relatedPipelineCode || undefined,
        workerGroup: n.workerGroup || undefined,
        windowCode: n.windowCode || undefined,
        nodeOrder: n.nodeOrder,
        retryPolicy: n.retryPolicy,
        retryMaxCount: n.retryMaxCount,
        timeoutSeconds: n.timeoutSeconds,
        nodeParams: n.nodeParams || undefined,
        enabled: n.enabled,
      })),
      edges: edges.map((e) => ({
        fromNodeCode: e.fromNodeCode,
        toNodeCode: e.toNodeCode,
        edgeType: e.edgeType,
        conditionExpr: e.conditionExpr || undefined,
        enabled: e.enabled,
      })),
    }

    submittingToBackend.value = true
    try {
      const defId = workflowDefinition.value?.id
      if (defId) {
        await workflowApi.update(defId, body)
        ElMessage.success('已提交到后端（更新），正在重新加载…')
      } else {
        const created = await workflowApi.create(body)
        const newId = created.id
        if (workflowDefinition.value) {
          workflowDefinition.value = { ...workflowDefinition.value, id: newId }
        }
        const opt = definitionOptions.value.find(
          (o) => o.workflowCode === selectedWorkflowCode.value,
        )
        if (opt) opt.id = newId
        ElMessage.success('已提交到后端（新建），正在重新加载…')
      }
      if (currentDraftKey.value) {
        try {
          window.localStorage.removeItem(currentDraftKey.value)
        } catch {
          /* ignore */
        }
      }
      draftSource.value = 'backend'
      draftUpdatedAt.value = ''
      await new Promise((r) => setTimeout(r, 500))
      void loadWorkflow()
    } catch (err) {
      ElMessage.error(`提交失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      submittingToBackend.value = false
    }
  }

  // ─── JSON Manifest export / import ─────────────────────────────────────────

  /**
   * 导出当前画布状态为 JSON manifest 文件，schema 与本地草稿一致
   * (workflowDefinition + nodes + edges + savedAt)，可作为版本化配置或跨环境迁移。
   * 文件名 `workflow-<code>-<yyyyMMddHHmm>.json`。
   */
  function exportManifest() {
    const payload = buildDraftPayload()
    const code = payload.workflowDefinition.workflowCode || 'workflow'
    const ts = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fname = `workflow-${code}-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}.json`
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fname
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${fname}`)
  }

  /**
   * 从 JSON 文本恢复画布：用于 paste / file upload。
   * 校验 shape，对齐到当前 workflowCode（不允许跨 workflow 灌入避免误覆盖），
   * 落画布 + 标记为 local-draft + 入 draft 队列。
   */
  function importManifest(jsonText: string): { ok: true } | { ok: false; reason: string } {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return { ok: false, reason: 'JSON 解析失败' }
    }
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'JSON 顶层不是对象' }
    const obj = parsed as Partial<WorkflowDraftPayload>
    if (!obj.workflowDefinition || !Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
      return { ok: false, reason: 'manifest 缺少 workflowDefinition / nodes / edges 字段' }
    }
    const inCode = obj.workflowDefinition.workflowCode
    const curCode = selectedWorkflowCode.value
    if (!curCode) return { ok: false, reason: '请先在工具栏选中目标 workflow，再导入 manifest' }
    if (inCode && inCode !== curCode) {
      return {
        ok: false,
        reason: `manifest 的 workflowCode=${inCode}，与当前选中的 ${curCode} 不一致，拒绝跨流灌入`,
      }
    }
    // 落画布
    copyWorkflowForm(
      obj.workflowDefinition as WorkflowDraftPayload['workflowDefinition'],
      workflowForm,
    )
    resetGraph(
      obj.nodes as WorkflowDraftPayload['nodes'],
      obj.edges as WorkflowDraftPayload['edges'],
      layoutWorkflowNodes,
    )
    draftSource.value = 'local-draft'
    draftUpdatedAt.value = new Date().toISOString()
    queueDraftSave()
    return { ok: true }
  }

  /**
   * 从 File 对象读取 JSON 并 importManifest，给文件上传按钮用。
   */
  async function importManifestFromFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.json')) {
      ElMessage.error('请选择 .json 文件')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      ElMessage.error('manifest 文件超过 5 MB，请检查')
      return
    }
    const text = await file.text()
    const result = importManifest(text)
    if (result.ok) {
      ElMessage.success(`已导入 ${file.name}`)
    } else {
      ElMessage.error(`导入失败：${result.reason}`)
    }
  }

  // ─── Copy DSL ──────────────────────────────────────────────────────────────

  async function copyDsl() {
    const text = JSON.stringify(buildDraftPayload(), null, 2)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        ElMessage.success('DSL 已复制到剪贴板')
        return
      }
    } catch {
      // fall through
    }
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (copied) {
      ElMessage.success('DSL 已复制到剪贴板（兼容模式）')
      return
    }
    ElMessage.error('复制失败，请手动复制右侧 DSL 预览')
  }

  return {
    // refs
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

    // computed
    routeWorkflowCode,
    currentDraftKey,
    selectedDefinition,
    subtitle,
    draftSavedDisplay,
    dslPreview,
    dslPreviewLines,

    // functions
    validateGraph,
    queueDraftSave,
    persistDraft,
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
    buildDraftPayload,
    exportManifest,
    importManifest,
    importManifestFromFile,

    // suppress helpers
    getSuppressDefinitionFormSync,
    clearSuppressDefinitionFormSync,

    // route / router for watchers
    route,
    router,
    tenant,
  }
}

export type WorkflowDataReturn = ReturnType<typeof useWorkflowData>
