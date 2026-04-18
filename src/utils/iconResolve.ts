/**
 * 将后端下发的 Element Plus 图标名（字符串）解析为 Vue Component。
 * 用于 ConsoleMenuRegistry 下发的菜单：后端只知道图标名，前端负责 mapping。
 */
import type { Component } from 'vue'
import * as ElIcons from '@element-plus/icons-vue'

const iconMap = ElIcons as unknown as Record<string, Component>

/** 找不到图标时的兜底图标（保证菜单仍可渲染） */
const FALLBACK_ICON: Component = iconMap.Menu ?? iconMap.Operation ?? iconMap.Box

export function resolveIcon(name?: string | null): Component {
  if (!name) return FALLBACK_ICON
  return iconMap[name] ?? FALLBACK_ICON
}
