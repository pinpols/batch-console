<template>
  <div class="cron-expr-input">
    <el-input
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @update:model-value="onInput"
    />

    <div class="cron-help">
      <!-- 5 个工程常用 preset,一键填入 -->
      <div class="cron-preset-row">
        <span class="cron-preset-label">快速预设:</span>
        <el-button
          v-for="preset in PRESETS"
          :key="preset.expr"
          size="small"
          link
          type="primary"
          :disabled="disabled"
          @click="emit('update:modelValue', preset.expr)"
        >
          {{ preset.label }}
        </el-button>
      </div>

      <!-- 实时解析:校验 + 描述 + 下次执行时间预览 -->
      <div v-if="!modelValue?.trim()" class="cron-empty-hint">
        Quartz 6 字段(秒 分 时 日 月 星期),例:<code>0 0 2 * * ?</code> = 每天 02:00。
        手动调度可留空。
      </div>
      <template v-else>
        <div v-if="parsed.error" class="cron-error">
          <el-icon><Warning /></el-icon>
          {{ parsed.error }}
        </div>
        <div v-else class="cron-ok">
          <div class="cron-desc">
            <el-icon><Check /></el-icon>
            <span>{{ parsed.desc }}</span>
          </div>
          <div v-if="parsed.nextRuns.length" class="cron-next">
            <span class="cron-next__label">最近 3 次执行(本地时区):</span>
            <span class="cron-next__list">
              <span v-for="(t, i) in parsed.nextRuns" :key="i" class="cron-next__time">
                {{ formatNext(t) }}
              </span>
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * Cron 表达式友好输入框 — 公共子组件。
   *
   * 设计取舍:
   *   - 不引第三方 (cron-parser / cronstrue):本组件只覆盖 80% 常见场景,
   *     复杂 Quartz 语法 (#nth / L / W) 显示 "复杂表达式,以 BE 解析为准"。
   *   - 6 字段 Quartz 格式 (秒 分 时 日 月 星期 [年]),与 BE 使用的 Quartz 引擎对齐。
   *   - 5 个 preset 与编辑 drawer 的 JobConfigBasicForm.vue 保持一致。
   *
   * 公开 props/emits 与 el-input 类似 (modelValue / update:modelValue),
   * 可直接 v-model 双向绑定。
   */
  import { computed } from 'vue'
  import { Check, Warning } from '@element-plus/icons-vue'

  const props = withDefaults(
    defineProps<{
      modelValue?: string
      placeholder?: string
      disabled?: boolean
    }>(),
    { modelValue: '', placeholder: '例:0 0 2 * * ?  (每天 02:00)', disabled: false },
  )
  const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

  function onInput(v: string | number | null | undefined) {
    emit('update:modelValue', String(v ?? ''))
  }

  const PRESETS = [
    { label: '每天 02:00', expr: '0 0 2 * * ?' },
    { label: '每小时', expr: '0 0 * * * ?' },
    { label: '每 15 分', expr: '0 */15 * * * ?' },
    { label: '每周一 02:00', expr: '0 0 2 ? * MON' },
    { label: '每月 1 号 02:00', expr: '0 0 2 1 * ?' },
  ] as const

  type ParseResult = {
    error: string
    desc: string
    nextRuns: Date[]
  }

  const parsed = computed<ParseResult>(() => parseCron(props.modelValue?.trim() || ''))

  /**
   * 极简 Quartz cron 解析器。
   * 接受 6 或 7 字段 (秒 分 时 日 月 星期 [年])。
   *
   * 字段允许:数字 / 通配 / 任意位 / 步进 (asterisk-slash-N) / 列表 a,b,c / 范围 a-b / a-b 带步进 / 名字 (MON, JAN)。
   * 不支持:L / W / # / LW — 这类复杂语法直接放过并描述为「复杂表达式」。
   */
  function parseCron(expr: string): ParseResult {
    if (!expr) return { error: '', desc: '', nextRuns: [] }
    const parts = expr.split(/\s+/)
    if (parts.length < 6 || parts.length > 7) {
      return {
        error: `字段数不对 (${parts.length}),Quartz 期望 6 或 7 段:秒 分 时 日 月 星期 [年]`,
        desc: '',
        nextRuns: [],
      }
    }
    const [sec, min, hour, dom, mon, dow] = parts
    // 包含 L/W/# 的高级语法跳过解析,只显描述
    const advancedPattern = /[LW#]/
    if (parts.some((p) => advancedPattern.test(p))) {
      return {
        error: '',
        desc: '复杂表达式(含 L/W/# 高级语法),将以 BE Quartz 引擎解析为准',
        nextRuns: [],
      }
    }
    // 字段合法性快速校验
    const fieldValidators: Array<[string, string, [number, number]]> = [
      [sec, '秒', [0, 59]],
      [min, '分', [0, 59]],
      [hour, '时', [0, 23]],
      [dom, '日', [1, 31]],
      [mon, '月', [1, 12]],
      [dow, '星期', [0, 7]],
    ]
    for (const [val, label, [lo, hi]] of fieldValidators) {
      const err = validateField(val, label, lo, hi)
      if (err) return { error: err, desc: '', nextRuns: [] }
    }
    const desc = describeCron(sec, min, hour, dom, mon, dow)
    const nextRuns = nextFireTimes(sec, min, hour, dom, mon, dow, 3)
    return { error: '', desc, nextRuns }
  }

  const MONTH_NAMES = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ]
  const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  function normalizeToken(
    tok: string,
    lo: number,
    hi: number,
    kind: 'mon' | 'dow' | 'num',
  ): number {
    const upper = tok.toUpperCase()
    if (kind === 'mon') {
      const idx = MONTH_NAMES.indexOf(upper)
      if (idx >= 0) return idx + 1
    } else if (kind === 'dow') {
      const idx = DOW_NAMES.indexOf(upper)
      if (idx >= 0) return idx
    }
    const n = Number(tok)
    if (!Number.isFinite(n)) return Number.NaN
    if (n < lo || n > hi) return Number.NaN
    return n
  }

  function validateField(field: string, label: string, lo: number, hi: number): string {
    if (field === '*' || field === '?') return ''
    // */N
    const stepMatch = field.match(/^\*\/(\d+)$/)
    if (stepMatch) {
      const step = Number(stepMatch[1])
      if (!step || step < 1) return `${label}字段步长非法:${field}`
      return ''
    }
    // a-b 或 a-b/N
    const rangeStepMatch = field.match(/^([\w-]+)-([\w-]+)(?:\/(\d+))?$/)
    if (rangeStepMatch) {
      const kind = label === '月' ? 'mon' : label === '星期' ? 'dow' : 'num'
      const a = normalizeToken(rangeStepMatch[1], lo, hi, kind)
      const b = normalizeToken(rangeStepMatch[2], lo, hi, kind)
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return `${label}字段范围非法:${field}`
      }
      return ''
    }
    // a,b,c
    if (field.includes(',')) {
      for (const tok of field.split(',')) {
        const kind = label === '月' ? 'mon' : label === '星期' ? 'dow' : 'num'
        const n = normalizeToken(tok, lo, hi, kind)
        if (!Number.isFinite(n)) return `${label}字段列表项非法:${tok}`
      }
      return ''
    }
    // 单值
    const kind = label === '月' ? 'mon' : label === '星期' ? 'dow' : 'num'
    const n = normalizeToken(field, lo, hi, kind)
    if (!Number.isFinite(n)) return `${label}字段非法:${field} (期望 ${lo}-${hi})`
    return ''
  }

  function describeCron(
    sec: string,
    min: string,
    hour: string,
    dom: string,
    mon: string,
    dow: string,
  ): string {
    // 5 个 preset 精确匹配
    for (const p of PRESETS) {
      if (p.expr === `${sec} ${min} ${hour} ${dom} ${mon} ${dow}`) {
        return p.label
      }
    }
    const parts: string[] = []
    // 月
    if (mon === '*') parts.push('每月')
    else parts.push(`${mon} 月`)
    // 日 / 星期
    if (dom !== '?' && dom !== '*') {
      parts.push(`${dom} 号`)
    } else if (dow !== '?' && dow !== '*') {
      parts.push(`星期 ${dow}`)
    } else {
      parts.push('每天')
    }
    // 时分秒
    if (sec === '0' && min !== '*' && hour !== '*' && !min.includes('/') && !hour.includes('/')) {
      const h = String(hour).padStart(2, '0')
      const m = String(min).padStart(2, '0')
      parts.push(`${h}:${m}`)
    } else {
      const hourStepMatch = hour.match(/^\*\/(\d+)$/)
      const minStepMatch = min.match(/^\*\/(\d+)$/)
      if (sec === '0' && min === '0' && hour === '*') parts.push('每小时整点')
      else if (sec === '0' && minStepMatch) parts.push(`每 ${minStepMatch[1]} 分钟`)
      else if (sec === '0' && hourStepMatch) parts.push(`每 ${hourStepMatch[1]} 小时`)
      else parts.push(`秒=${sec} 分=${min} 时=${hour}`)
    }
    return parts.join(' · ')
  }

  /**
   * 计算下 N 次执行时间。算法:从「下一秒」开始,逐分钟检查 (满足 hour/dom/mon/dow),
   * 满足后再用秒/分字段过滤。简单粗暴但对 ≤ 1 个月内可命中的 cron 足够。
   * 复杂表达式 / 1 年只触发 1 次的场景跳过预览。
   */
  function nextFireTimes(
    sec: string,
    min: string,
    hour: string,
    dom: string,
    mon: string,
    dow: string,
    count: number,
  ): Date[] {
    const out: Date[] = []
    const now = new Date()
    const start = new Date(now.getTime() + 1000)
    start.setMilliseconds(0)
    const limitMs = 366 * 24 * 60 * 60 * 1000 // 1 年内找不到就放弃
    let cursor = start.getTime()
    const end = cursor + limitMs
    // 步进:秒可能是 0 / */N / 列表;为简化,我们按 1 秒粒度做最多 100 万次扫描(<= 12 天)。
    // 对于「每小时整点」「每 15 分」「每天 02:00」这类常用 cron 完全够用。
    // 若 12 天内仍找不到 → 跳过预览。
    const fastEnd = Math.min(end, cursor + 12 * 24 * 60 * 60 * 1000)
    const setSec = expandField(sec, 0, 59)
    const setMin = expandField(min, 0, 59)
    const setHour = expandField(hour, 0, 23)
    const setMon = expandField(mon, 1, 12)
    const setDom = dom === '?' || dom === '*' ? null : expandField(dom, 1, 31)
    const setDow =
      dow === '?' || dow === '*'
        ? null
        : new Set((expandField(dow, 0, 7) ?? []).map((d) => (d === 7 ? 0 : d)))
    if (!setSec || !setMin || !setHour || !setMon) return out
    while (cursor <= fastEnd && out.length < count) {
      const d = new Date(cursor)
      if (
        setSec.includes(d.getSeconds()) &&
        setMin.includes(d.getMinutes()) &&
        setHour.includes(d.getHours()) &&
        setMon.includes(d.getMonth() + 1) &&
        (setDom == null || setDom.includes(d.getDate())) &&
        (setDow == null || setDow.has(d.getDay()))
      ) {
        out.push(new Date(d))
        cursor += 1000
      } else {
        cursor += 1000
      }
    }
    return out
  }

  function expandField(field: string, lo: number, hi: number): number[] | null {
    if (field === '*' || field === '?') {
      const arr: number[] = []
      for (let i = lo; i <= hi; i++) arr.push(i)
      return arr
    }
    const stepMatch = field.match(/^\*\/(\d+)$/)
    if (stepMatch) {
      const step = Number(stepMatch[1])
      if (!step) return null
      const arr: number[] = []
      for (let i = lo; i <= hi; i += step) arr.push(i)
      return arr
    }
    const rangeStepMatch = field.match(/^([\w-]+)-([\w-]+)(?:\/(\d+))?$/)
    if (rangeStepMatch) {
      const isMonth = lo === 1 && hi === 12
      const isDow = lo === 0 && hi === 7
      const a = normalizeToken(rangeStepMatch[1], lo, hi, isMonth ? 'mon' : isDow ? 'dow' : 'num')
      const b = normalizeToken(rangeStepMatch[2], lo, hi, isMonth ? 'mon' : isDow ? 'dow' : 'num')
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null
      const step = rangeStepMatch[3] ? Number(rangeStepMatch[3]) : 1
      const arr: number[] = []
      for (let i = a; i <= b; i += step) arr.push(i)
      return arr
    }
    if (field.includes(',')) {
      const arr: number[] = []
      const isMonth = lo === 1 && hi === 12
      const isDow = lo === 0 && hi === 7
      for (const tok of field.split(',')) {
        const n = normalizeToken(tok, lo, hi, isMonth ? 'mon' : isDow ? 'dow' : 'num')
        if (!Number.isFinite(n)) return null
        arr.push(n)
      }
      return arr
    }
    const isMonth = lo === 1 && hi === 12
    const isDow = lo === 0 && hi === 7
    const n = normalizeToken(field, lo, hi, isMonth ? 'mon' : isDow ? 'dow' : 'num')
    if (!Number.isFinite(n)) return null
    return [n]
  }

  function formatNext(d: Date): string {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const HH = String(d.getHours()).padStart(2, '0')
    const MM = String(d.getMinutes()).padStart(2, '0')
    const SS = String(d.getSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`
  }
</script>

<style scoped>
  .cron-expr-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .cron-help {
    font-size: 12px;
    color: var(--color-text-secondary);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cron-preset-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
  }
  .cron-preset-label {
    color: var(--color-text-tertiary);
  }

  .cron-empty-hint {
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }
  .cron-empty-hint code {
    background: var(--color-bg-page);
    padding: 0 4px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, monospace;
  }

  .cron-error {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-danger);
  }

  .cron-ok {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cron-desc {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-success);
  }
  .cron-next {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    color: var(--color-text-tertiary);
  }
  .cron-next__label {
    flex-shrink: 0;
  }
  .cron-next__time {
    background: var(--color-bg-page);
    padding: 0 6px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, monospace;
  }
</style>
