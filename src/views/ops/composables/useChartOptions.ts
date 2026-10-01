/**
 * 运行摘要看板的图表配置构造器。
 * 保持纯函数，不依赖 Vue 响应式，也不产生副作用。
 */

// ---- ECharts 配置构造器 ----

function baseGridOption() {
  return {
    backgroundColor: 'transparent',
    grid: { left: 48, right: 24, top: 42, bottom: 56, containLabel: true },
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
  xAxisLabelFormatter?: (value: string, index: number) => string
}) {
  return {
    ...baseGridOption(),
    legend: { top: 6, itemWidth: 10, itemHeight: 10 },
    xAxis: {
      type: 'category',
      data: params.x,
      boundaryGap: false,
      axisLabel: {
        fontSize: 11,
        margin: 12,
        hideOverlap: true,
        formatter: params.xAxisLabelFormatter,
      },
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

export function buildGroupedBarOption(params: {
  x: string[]
  series: { name: string; data: number[]; color?: string }[]
  yAxisName?: string
}) {
  return {
    ...baseGridOption(),
    legend: { top: 6, itemWidth: 10, itemHeight: 10 },
    xAxis: {
      type: 'category',
      data: params.x,
      axisLabel: { fontSize: 11, margin: 12, overflow: 'truncate', width: 80 },
    },
    yAxis: { type: 'value', name: params.yAxisName ?? '', nameTextStyle: { fontSize: 11 } },
    series: params.series.map((series) => ({
      name: series.name,
      type: 'bar',
      data: series.data,
      barMaxWidth: 20,
      itemStyle: { color: series.color },
    })),
  }
}

export function buildPieOption(params: {
  items: { name: string; value: number; color?: string }[]
  /** ring 留空 → 实心饼;给值 → 环形 */
  innerRadius?: string
}) {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 4, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    series: [
      {
        type: 'pie',
        radius: params.innerRadius ? [params.innerRadius, '70%'] : '65%',
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: 600 } },
        data: params.items.map((it) => ({
          name: it.name,
          value: it.value,
          itemStyle: it.color ? { color: it.color } : undefined,
        })),
      },
    ],
  }
}

export function buildGaugeOption(params: {
  value: number
  max?: number
  unit?: string
  color?: string
}) {
  const v = Math.max(0, Math.min(params.value, params.max ?? 100))
  const color = params.color ?? '#54a772'
  return {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: params.max ?? 100,
        progress: { show: true, width: 14, roundCap: true, itemStyle: { color } },
        axisLine: {
          roundCap: true,
          lineStyle: { width: 14, color: [[1, 'rgba(128,128,128,0.16)']] },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        // 隐藏 0-100 刻度数字:小仪表盘上画在弧内会与中心大字重叠成一团噪声,
        // 数值已由中心 detail 表达,刻度无信息增益。
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        detail: {
          valueAnimation: true,
          formatter: `{value}${params.unit ?? ''}`,
          fontSize: 26,
          fontWeight: 700,
          // 随弧色(SLA 高=绿 / 低=告警色),与进度弧呼应;下沉到弧口居中。
          color: 'inherit',
          offsetCenter: [0, '8%'],
        },
        data: [{ value: Math.round(v * 10) / 10 }],
      },
    ],
  }
}

export function buildHorizontalTopNOption(
  items: { name: string; value: number }[],
  color: string,
  valueAxisName = '',
) {
  const rows = [...items].sort((a, b) => b.value - a.value).slice(0, 10)
  const names = rows.map((x) => x.name).reverse()
  const vals = rows.map((x) => x.value).reverse()
  return {
    grid: { left: 16, right: 28, top: 28, bottom: 20, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'value',
      name: valueAxisName,
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { fontSize: 11 },
      axisLabel: { fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: { fontSize: 11, overflow: 'truncate', width: 112 },
    },
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
