/**
 * 首次登录后的界面导览:用 driver.js 标记 3 个核心入口。
 *
 * 触发:用户资料加载完成 + 当前用户/租户/版本没完成过 → 在概览页自动启动一次。
 * 重看:Header 用户菜单提供入口,只重置当前身份的完成标记。
 *
 * 选择 driver.js 而非 vue-tour:driver.js 5KB 无 Vue 依赖,
 * 直接读 DOM 选择器,跟 SPA 路由生命周期解耦。
 */
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { logRoute } from '@/utils/logger'
import { i18n } from '@/locales'
import { STORAGE_KEYS } from '@/constants/storageKeys'
import { ONBOARDING_GUIDE_VERSION } from './onboardingModel'

const STORAGE_KEY = STORAGE_KEYS.onboardingDone

export interface OnboardingTourIdentity {
  userId: string
  tenantId: string
}

export interface TourStep {
  /** CSS 选择器,标在已存在的 DOM 节点上 */
  element: string
  /** 标题(中文,单行)*/
  title: string
  /** 内容(中文,可两三句)*/
  description: string
}

function completionKey(identity: OnboardingTourIdentity): string {
  const value = `${identity.userId || 'anonymous'}:${identity.tenantId || 'no-tenant'}`
  return `${STORAGE_KEY}:${ONBOARDING_GUIDE_VERSION}:${encodeURIComponent(value)}`
}

// 首步必须是"选择租户":所有业务数据按租户隔离,未选租户时全站为空。
// 界面 Tour 只解释导航骨架,真正的业务激活任务由概览页的引导中心承接。
// 文案在调用时按当前 locale 解析(普通函数不能用 useI18n,走 i18n.global.t)。
// 锚点统一用 data-onboarding,不依赖样式类名或 i18n 后的 aria-label。
function defaultSteps(): TourStep[] {
  const t = i18n.global.t
  return [
    {
      element: '[data-onboarding="tenant"]',
      title: t('onboarding.step1Title'),
      description: t('onboarding.step1Desc'),
    },
    {
      element: '[data-onboarding="command-palette"]',
      title: t('onboarding.step2Title'),
      description: t('onboarding.step2Desc'),
    },
    {
      element: '[data-onboarding="onboarding-center"]',
      title: t('onboarding.step3Title'),
      description: t('onboarding.step3Desc'),
    },
  ]
}

export function shouldShowOnboarding(identity: OnboardingTourIdentity): boolean {
  return localStorage.getItem(completionKey(identity)) !== '1'
}

export function startOnboarding(
  identity: OnboardingTourIdentity,
  steps: TourStep[] = defaultSteps(),
): boolean {
  // 弹窗/抽屉打开时不启动引导:coach-mark 会盖住正在填写的表单(反人类)。
  // Element Plus 会把关闭后的 overlay 留在 DOM 并设为 display:none,不能仅按节点存在判断。
  const hasVisibleModal = Array.from(
    document.querySelectorAll<HTMLElement>('.el-overlay, .el-drawer, .el-dialog'),
  ).some((element) => {
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    // Drawer 关闭后子节点仍可能保持 display:flex,但祖先 overlay 已 display:none。
    // getClientRects 为空才能准确识别这类“样式可见、实际无布局框”的残留节点。
    return element.getClientRects().length > 0
  })
  if (hasVisibleModal) {
    logRoute('onboarding:skip', { kind: 'onboarding', reason: 'modal open' })
    return false
  }
  // 校验 DOM 节点存在,否则跳过该步;driver.js 找不到 element 会直接报错挂掉
  const validSteps = steps.filter((s) => document.querySelector(s.element))
  if (validSteps.length === 0) {
    logRoute('onboarding:skip', { kind: 'onboarding', reason: 'no DOM anchors' })
    return false
  }

  logRoute('onboarding:start', { kind: 'onboarding', stepCount: validSteps.length })
  let completed = false
  const d = driver({
    showProgress: true,
    nextBtnText: i18n.global.t('onboarding.nextBtn'),
    prevBtnText: i18n.global.t('onboarding.prevBtn'),
    doneBtnText: i18n.global.t('onboarding.doneBtn'),
    progressText: '{{current}} / {{total}}',
    overlayOpacity: 0.55,
    smoothScroll: true,
    steps: validSteps.map((s) => ({
      element: s.element,
      popover: { title: s.title, description: s.description, side: 'bottom' },
    })),
    onDoneClick: (_element, _step, { driver: currentDriver }) => {
      completed = true
      localStorage.setItem(completionKey(identity), '1')
      currentDriver.destroy()
    },
    onCloseClick: (_element, _step, { driver: currentDriver }) => {
      currentDriver.destroy()
    },
    onDestroyed: () => {
      logRoute(completed ? 'onboarding:done' : 'onboarding:dismissed', {
        kind: 'onboarding',
      })
    },
  })
  d.drive()
  return true
}

export function resetOnboarding(identity: OnboardingTourIdentity) {
  localStorage.removeItem(completionKey(identity))
}
