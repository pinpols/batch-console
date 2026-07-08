/**
 * 将后端下发的图标名（字符串）解析为 Vue Component。
 * 后端 ConsoleMenuRegistry / menu.yml 仍用历史的 Element Plus 图标名;前端已统一到
 * Lucide 线性图标(还原设计),故这里把 EP 名映射到 Lucide 等价图标再解析。
 */
import type { Component } from 'vue'
import * as Lucide from 'lucide-vue-next'

const lucide = Lucide as unknown as Record<string, Component>

/** 后端历史 EP 图标名 → 前端 Lucide 图标名(与 navigation.ts 别名一致) */
const EP_TO_LUCIDE: Record<string, string> = {
  ArrowDown: 'ChevronDown',
  ArrowUp: 'ChevronUp',
  CircleCheckFilled: 'CircleCheck',
  CircleClose: 'CircleX',
  CircleCloseFilled: 'CircleX',
  Close: 'X',
  Connection: 'Share2',
  DArrowRight: 'ChevronsRight',
  DataLine: 'Activity',
  DataAnalysis: 'BarChart3',
  Delete: 'Trash2',
  Document: 'FileText',
  DocumentAdd: 'FilePlus',
  DocumentCopy: 'Copy',
  Edit: 'Pencil',
  EditPen: 'PencilLine',
  Expand: 'PanelLeftOpen',
  Fold: 'PanelLeftClose',
  FolderOpened: 'FolderOpen',
  FullScreen: 'Maximize',
  HomeFilled: 'House',
  Histogram: 'BarChart3',
  Key: 'KeyRound',
  Loading: 'LoaderCircle',
  MagicStick: 'Sparkles',
  Memo: 'ClipboardList',
  MoreFilled: 'Ellipsis',
  Operation: 'SlidersHorizontal',
  Promotion: 'Send',
  QuestionFilled: 'CircleHelp',
  Refresh: 'RefreshCw',
  RefreshLeft: 'RotateCcw',
  RefreshRight: 'RotateCw',
  Right: 'ChevronRight',
  Select: 'Check',
  Share: 'Share2',
  Sunny: 'Sun',
  Tools: 'Wrench',
  Top: 'ArrowUp',
  TopRight: 'ArrowUpRight',
  UploadFilled: 'Upload',
  View: 'Eye',
  Warning: 'TriangleAlert',
  WarningFilled: 'TriangleAlert',
  InfoFilled: 'Info',
  ChatLineRound: 'MessageCircle',
  Setting: 'Settings',
  Finished: 'CircleCheckBig',
  MessageBox: 'MessageSquare',
  SetUp: 'Settings2',
  Aim: 'Crosshair',
  Rank: 'ArrowUpDown',
  Sort: 'ArrowUpDown',
  VideoPause: 'Pause',
  VideoPlay: 'Play',
  Coin: 'Coins',
}

/** 找不到图标时的兜底图标（保证菜单仍可渲染） */
const FALLBACK_ICON: Component = lucide.Menu ?? lucide.SlidersHorizontal ?? lucide.Box

export function resolveIcon(name?: string | null): Component {
  if (!name) return FALLBACK_ICON
  const lucideName = EP_TO_LUCIDE[name] ?? name
  return lucide[lucideName] ?? FALLBACK_ICON
}
