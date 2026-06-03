// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import { useProgressEta, type ProgressSample } from './useProgressEta'

const messages = {
  'zh-CN': {
    common: {
      etaUnknown: '—',
      etaPattern: 'ETA ~{minutes}min',
    },
  },
  'en-US': {
    common: {
      etaUnknown: '—',
      etaPattern: 'ETA ~{minutes}min',
    },
  },
}

/**
 * 把 composable 包装到一个临时 Vue app 里运行,避免在 setup 外调用 useI18n 报错。
 * 返回 composable 输出,供断言使用。
 */
function runInApp<T>(setup: () => T): T {
  const i18n = createI18n({
    legacy: false,
    locale: 'zh-CN',
    fallbackLocale: 'en-US',
    messages,
  })
  let captured!: T
  const Comp = defineComponent({
    setup() {
      captured = setup()
      return () => h('div')
    },
  })
  const app = createApp(Comp)
  app.use(i18n)
  const root = document.createElement('div')
  app.mount(root)
  return captured
}

describe('useProgressEta', () => {
  it('total 未知时 etaSeconds=null 且文本走 etaUnknown', () => {
    const out = runInApp(() => {
      const processed = ref(100)
      const total = ref<number | null>(null)
      const history = ref<ProgressSample[]>([
        { ts: 0, processed: 0 },
        { ts: 70_000, processed: 100 },
      ])
      return useProgressEta(processed, total, history)
    })
    expect(out.etaSeconds.value).toBeNull()
    expect(out.etaText.value).toBe('—')
  })

  it('采样窗口 < 60s 时不显示 ETA(防抖)', () => {
    const out = runInApp(() => {
      const processed = ref(50)
      const total = ref<number | null>(1000)
      const history = ref<ProgressSample[]>([
        { ts: 0, processed: 0 },
        { ts: 30_000, processed: 50 },
      ])
      return useProgressEta(processed, total, history)
    })
    expect(out.etaSeconds.value).toBeNull()
    expect(out.etaText.value).toBe('—')
  })

  it('已知 total + 充足窗口时正常计算 ETA', () => {
    const out = runInApp(() => {
      const processed = ref(600)
      const total = ref<number | null>(1200)
      // 60s 处理 600 行 → rate 10 行/秒 → 剩余 600 行 → 60s ≈ 1min
      const history = ref<ProgressSample[]>([
        { ts: 0, processed: 0 },
        { ts: 60_000, processed: 600 },
      ])
      return useProgressEta(processed, total, history)
    })
    expect(out.etaSeconds.value).toBe(60)
    expect(out.etaText.value).toBe('ETA ~1min')
  })

  it('完成态(processed >= total)→ ETA null', () => {
    const out = runInApp(() => {
      const processed = ref(1000)
      const total = ref<number | null>(1000)
      const history = ref<ProgressSample[]>([
        { ts: 0, processed: 0 },
        { ts: 120_000, processed: 1000 },
      ])
      return useProgressEta(processed, total, history)
    })
    expect(out.etaSeconds.value).toBeNull()
    expect(out.etaText.value).toBe('—')
  })

  it('throughput=0(停滞)→ ETA null,不输出 Infinity', () => {
    const out = runInApp(() => {
      const processed = ref(500)
      const total = ref<number | null>(1000)
      const history = ref<ProgressSample[]>([
        { ts: 0, processed: 500 },
        { ts: 90_000, processed: 500 },
      ])
      return useProgressEta(processed, total, history)
    })
    expect(out.etaSeconds.value).toBeNull()
    expect(out.etaText.value).toBe('—')
  })

  it('采样数 < 2 时 ETA 不显示', () => {
    const out = runInApp(() => {
      const processed = ref(100)
      const total = ref<number | null>(1000)
      const history = ref<ProgressSample[]>([{ ts: 0, processed: 0 }])
      return useProgressEta(processed, total, history)
    })
    expect(out.etaSeconds.value).toBeNull()
    expect(out.etaText.value).toBe('—')
  })
})
