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
import { i18n } from '@/locales'

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
// 文案在调用时按当前 locale 解析(普通函数不能用 useI18n,走 i18n.global.t)。
// 注意:element 里的 aria-label 是 DOM 选择器,不做 i18n。
function defaultSteps(): TourStep[] {
  const t = i18n.global.t
  return [
    {
      element: '.tenant-chip',
      title: t('onboarding.step1Title'),
      description: t('onboarding.step1Desc'),
    },
    {
      element: '.icon-button[aria-label="打开命令面板"]',
      title: t('onboarding.step2Title'),
      description: t('onboarding.step2Desc'),
    },
    {
      element: '.icon-button[aria-label="打开文档中心"]',
      title: t('onboarding.step3Title'),
      description: t('onboarding.step3Desc'),
    },
    {
      element: '.username',
      title: t('onboarding.step4Title'),
      description: t('onboarding.step4Desc'),
    },
    {
      element: '.layout-header__fold',
      title: t('onboarding.step5Title'),
      description: t('onboarding.step5Desc'),
    },
  ]
}

export function shouldShowOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== '1'
}

export function startOnboarding(steps: TourStep[] = defaultSteps()) {
  // 弹窗/抽屉打开时不启动引导:coach-mark 会盖住正在填写的表单(反人类)。
  // Element Plus 的 overlay/drawer 仅在打开时挂到 DOM,存在即视为有模态在前台。
  if (document.querySelector('.el-overlay, .el-drawer, .el-dialog')) {
    logRoute('onboarding:skip', { kind: 'onboarding', reason: 'modal open' })
    return
  }
  // 校验 DOM 节点存在,否则跳过该步;driver.js 找不到 element 会直接报错挂掉
  const validSteps = steps.filter((s) => document.querySelector(s.element))
  if (validSteps.length === 0) {
    logRoute('onboarding:skip', { kind: 'onboarding', reason: 'no DOM anchors' })
    return
  }

  logRoute('onboarding:start', { kind: 'onboarding', stepCount: validSteps.length })
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
