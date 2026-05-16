/**
 * Chart option builders for the Ops Summary dashboard.
 * Pure functions -- no Vue reactivity, no side-effects.
 */

// ---- time helpers (kept exported for potential reuse) ----

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

function floorToBucket(ts: number, bucketMs: number): number {
  return Math.floor(ts / bucketMs) * bucketMs
}

function buildBuckets(now: number, from: number, bucketMs: number) {
  const buckets: number[] = []
  const start = floorToBucket(from, bucketMs)
  const end = floorToBucket(now, bucketMs)
  for (let t = start; t <= end; t += bucketMs) buckets.push(t)
  return buckets
}

function fmtHM(ts: number) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function rangeConfig(key: '1h' | '6h' | '24h') {
  const now = Date.now()
  if (key === '1h') return { now, from: now - 60 * 60_000, bucketMs: 5 * 60_000 }
  if (key === '6h') return { now, from: now - 6 * 60 * 60_000, bucketMs: 30 * 60_000 }
  return { now, from: now - 24 * 60 * 60_000, bucketMs: 2 * 60 * 60_000 }
}

function toDateKey(ts: number) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---- ECharts option builders ----

function baseGridOption() {
  return {
    backgroundColor: 'transparent',
    grid: { left: 46, right: 18, top: 42, bottom: 44 },
    tooltip: { trigger: 'axis' },
  }
}

export function emptyOption(title: string) {
  return {
    ...baseGridOption(),
    title: {
      text: title,
      left: 'center',
      top: 'middle',
      textStyle: { fontSize: 12, fontWeight: 500 },
    },
    xAxis: { type: 'category', data: [] },
    yAxis: { type: 'value' },
    series: [],
  }
}

export function buildLineOption(params: {
  x: string[]
  series: { name: string; data: number[]; color?: string; area?: boolean }[]
  yAxisName?: string
}) {
  return {
    ...baseGridOption(),
    legend: { top: 6, itemWidth: 10, itemHeight: 10 },
    xAxis: {
      type: 'category',
      data: params.x,
      boundaryGap: false,
      axisLabel: { fontSize: 11, margin: 12 },
    },
    yAxis: { type: 'value', name: params.yAxisName ?? '', nameTextStyle: { fontSize: 11 } },
    series: params.series.map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { width: 2, color: s.color },
      itemStyle: { color: s.color },
      areaStyle: s.area ? { opacity: 0.12, color: s.color } : undefined,
      data: s.data,
    })),
  }
}

export function buildStackBarOption(params: {
  x: string[]
  series: { name: string; data: number[]; color?: string }[]
}) {
  return {
    ...baseGridOption(),
    legend: { top: 6, itemWidth: 10, itemHeight: 10 },
    xAxis: { type: 'category', data: params.x, axisLabel: { fontSize: 11, margin: 12 } },
    yAxis: { type: 'value' },
    series: params.series.map((s) => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      barWidth: 14,
      itemStyle: { color: s.color },
      data: s.data,
    })),
  }
}

export function buildHorizontalTopNOption(items: { name: string; value: number }[], color: string) {
  const rows = [...items].sort((a, b) => b.value - a.value).slice(0, 10)
  const names = rows.map((x) => x.name).reverse()
  const vals = rows.map((x) => x.value).reverse()
  return {
    grid: { left: 120, right: 18, top: 16, bottom: 18 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', axisLabel: { fontSize: 11 } },
    yAxis: { type: 'category', data: names, axisLabel: { fontSize: 11 } },
    series: [
      {
        type: 'bar',
        data: vals,
        barWidth: 12,
        itemStyle: { color, borderRadius: [6, 6, 6, 6] },
      },
    ],
  }
}
