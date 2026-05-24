import { use, registerTheme } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart, GaugeChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
])

/**
 * 品牌主题 'console-light' / 'console-dark',通过 <VChart :theme="..."> 应用。
 * 颜色对齐 tokens.css 的 --color-primary / success / warning / danger,
 * 暗色独立给值,跟 SectionCard 的 --color-bg-card 对比度更稳。
 */
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
const PALETTE = ['#1677ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96']

registerTheme('console-light', {
  color: PALETTE,
  textStyle: { fontFamily: FONT, color: '#1f2937' },
  title: { textStyle: { color: '#1f2937', fontWeight: 600 }, left: 'center' },
  legend: { textStyle: { color: '#475569' } },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: '#e5e7eb',
    textStyle: { color: '#1f2937' },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.08); border-radius: 8px;',
  },
  grid: { left: 40, right: 16, top: 32, bottom: 32, containLabel: true },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#cbd5e1' } },
    axisTick: { show: false },
    axisLabel: { color: '#64748b' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#64748b' },
    splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
  },
  line: { smooth: true, symbol: 'circle', symbolSize: 6 },
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
})

registerTheme('console-dark', {
  color: PALETTE,
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FONT, color: '#e2e8f0' },
  title: { textStyle: { color: '#f1f5f9', fontWeight: 600 }, left: 'center' },
  legend: { textStyle: { color: '#94a3b8' } },
  tooltip: {
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderColor: '#334155',
    textStyle: { color: '#e2e8f0' },
    extraCssText: 'box-shadow: 0 4px 16px rgba(0,0,0,0.32); border-radius: 8px;',
  },
  grid: { left: 40, right: 16, top: 32, bottom: 32, containLabel: true },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#334155' } },
    axisTick: { show: false },
    axisLabel: { color: '#94a3b8' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: 'rgba(148,163,184,0.18)', type: 'dashed' } },
  },
  line: { smooth: true, symbol: 'circle', symbolSize: 6 },
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
})
