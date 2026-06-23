/**
 * 首次登录后的引导 tour:用 driver.js 标记 5 个核心入口。
 *
 * 触发:用户登录成功 + localStorage 没标记过 → 自动启动一次。
 * 重看:Header 用户菜单提供"重看引导"入口,清 localStorage 重启。
 *
 * 选择 driver.js 而非 vue-tour:driver.js 5KB 无 Vue 依赖,
 * 直接读 DOM 选择器,跟 SPA 路由生命周期解耦。
 */
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { logRoute } from '@/utils/logger'

const STORAGE_KEY = 'batch-console-onboarding-done'

export interface TourStep {
  /** CSS 选择器,标在已存在的 DOM 节点上 */
  element: string
  /** 标题(中文,单行)*/
  title: string
  /** 内容(中文,可两三句)*/
  description: string
}

// 首步必须是"选择租户":所有业务数据按租户隔离,未选租户时全站为空,
// 这是新用户进来的第一个、也是唯一的必做动作,排在最前。低价值的"收起侧栏"放最后。
const DEFAULT_STEPS: TourStep[] = [
  {
    element: '.tenant-chip',
    title: '第一步:选择租户',
    description: '所有数据按租户隔离。先在这里选一个租户,业务页才会有数据;系统管理员可随时切换。',
  },
  {
    element: '.icon-button[aria-label="打开命令面板"]',
    title: '命令面板',
    description: '⌘/Ctrl + K 任何时候唤出,搜索菜单 / 跳转页面 / 切换租户。',
  },
  {
    element: '.icon-button[aria-label="打开文档中心"]',
    title: '文档中心',
    description: '点书本图标可查 ADR / 架构 / 运维手册 / 字段说明,排障必备。',
  },
  {
    element: '.username',
    title: '账户菜单',
    description: '右上角看权限角色 / 退出登录;管理员可以打开"权限自查"。',
  },
  {
    element: '.layout-header__fold',
    title: '收起 / 展开侧边栏',
    description: '左上角按钮控制菜单栏,内容区需要更多空间时可以收起。',
  },
]

export function shouldShowOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== '1'
}

export function startOnboarding(steps: TourStep[] = DEFAULT_STEPS) {
  // 校验 DOM 节点存在,否则跳过该步;driver.js 找不到 element 会直接报错挂掉
  const validSteps = steps.filter((s) => document.querySelector(s.element))
  if (validSteps.length === 0) {
    logRoute('onboarding:skip', { kind: 'onboarding', reason: 'no DOM anchors' })
    return
  }

  logRoute('onboarding:start', { kind: 'onboarding', stepCount: validSteps.length })
  const d = driver({
    showProgress: true,
    nextBtnText: '下一步 →',
    prevBtnText: '← 上一步',
    doneBtnText: '完成',
    progressText: '{{current}} / {{total}}',
    overlayOpacity: 0.55,
    smoothScroll: true,
    steps: validSteps.map((s) => ({
      element: s.element,
      popover: { title: s.title, description: s.description, side: 'bottom' },
    })),
    onDestroyed: () => {
      localStorage.setItem(STORAGE_KEY, '1')
      logRoute('onboarding:done', { kind: 'onboarding' })
    },
  })
  d.drive()
}

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
}
