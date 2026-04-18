/**
 * Workflow Designer — panel splitter resize logic.
 */
import { ref } from 'vue'

const WORKFLOW_LEFT_W_KEY = 'batch-console:workflow-designer:leftPanelPx'
const WORKFLOW_RIGHT_W_KEY = 'batch-console:workflow-designer:rightPanelPx'
const LEFT_PANEL_MIN = 152
const LEFT_PANEL_MAX = 360
const RIGHT_PANEL_MIN = 176
const RIGHT_PANEL_MAX = 400
const DEFAULT_LEFT_PANEL = 220
const DEFAULT_RIGHT_PANEL = 252

function readStoredPanelWidth(key: string, fallback: number, min: number, max: number) {
  if (typeof window === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  const n = raw ? Number.parseInt(raw, 10) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function useWorkflowSplitter() {
  const leftPanelPx = ref(DEFAULT_LEFT_PANEL)
  const rightPanelPx = ref(DEFAULT_RIGHT_PANEL)
  const splitterDrag = ref<'left' | 'right' | null>(null)
  let splitterStartX = 0
  let splitterStartLeft = 0
  let splitterStartRight = 0

  function onSplitterMove(e: MouseEvent) {
    if (!splitterDrag.value) return
    const dx = e.clientX - splitterStartX
    if (splitterDrag.value === 'left') {
      leftPanelPx.value = Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, splitterStartLeft + dx))
    } else {
      /* 向右拖窄右侧栏，中间画布更多 */
      rightPanelPx.value = Math.min(
        RIGHT_PANEL_MAX,
        Math.max(RIGHT_PANEL_MIN, splitterStartRight - dx),
      )
    }
  }

  function onSplitterUp() {
    splitterDrag.value = null
    window.removeEventListener('mousemove', onSplitterMove)
    window.removeEventListener('mouseup', onSplitterUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    try {
      localStorage.setItem(WORKFLOW_LEFT_W_KEY, String(leftPanelPx.value))
      localStorage.setItem(WORKFLOW_RIGHT_W_KEY, String(rightPanelPx.value))
    } catch {
      /* ignore quota / privacy mode */
    }
  }

  function onSplitterDown(kind: 'left' | 'right', e: MouseEvent) {
    splitterStartX = e.clientX
    splitterStartLeft = leftPanelPx.value
    splitterStartRight = rightPanelPx.value
    splitterDrag.value = kind
    window.addEventListener('mousemove', onSplitterMove)
    window.addEventListener('mouseup', onSplitterUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  /** Restore persisted widths from localStorage. Call in onMounted. */
  function restorePanelWidths() {
    leftPanelPx.value = readStoredPanelWidth(
      WORKFLOW_LEFT_W_KEY,
      DEFAULT_LEFT_PANEL,
      LEFT_PANEL_MIN,
      LEFT_PANEL_MAX,
    )
    rightPanelPx.value = readStoredPanelWidth(
      WORKFLOW_RIGHT_W_KEY,
      DEFAULT_RIGHT_PANEL,
      RIGHT_PANEL_MIN,
      RIGHT_PANEL_MAX,
    )
  }

  function cleanupSplitter() {
    window.removeEventListener('mousemove', onSplitterMove)
    window.removeEventListener('mouseup', onSplitterUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  return {
    leftPanelPx,
    rightPanelPx,
    splitterDrag,
    onSplitterDown,
    restorePanelWidths,
    cleanupSplitter,
  }
}
