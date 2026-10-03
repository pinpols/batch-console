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
 * 颜色对齐运行时设计 token 的 primary / success / warning / danger。
 * ECharts canvas 不能稳定继承 CSS 变量,这里保留一份等价值并集中维护。
 */
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
const PALETTE = ['#1668e3', '#22845a', '#b57816', '#d64543', '#7c6bd6', '#218b99', '#b85b8c']

registerTheme('console-light', {
  color: PALETTE,
  textStyle: { fontFamily: FONT, color: '#1b1e26' },
  title: { textStyle: { color: '#1b1e26', fontWeight: 600 }, left: 'center' },
  legend: { textStyle: { color: '#5b6270' } },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: 'rgba(15, 23, 42, 0.1)',
    textStyle: { color: '#1b1e26' },
    extraCssText: 'box-shadow: 0 8px 24px rgba(15,23,42,0.1); border-radius: 8px;',
  },
  grid: {
    left: 40,
    right: 16,
    top: 32,
    bottom: 32,
    outerBoundsMode: 'same',
    outerBoundsContain: 'axisLabel',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.16)' } },
    axisTick: { show: false },
    axisLabel: { color: '#5b6270' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#5b6270' },
    splitLine: { lineStyle: { color: 'rgba(15, 23, 42, 0.07)', type: 'dashed' } },
  },
  line: { smooth: true, symbol: 'circle', symbolSize: 6 },
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
})

registerTheme('console-dark', {
  color: PALETTE,
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FONT, color: '#e9ebf0' },
  title: { textStyle: { color: '#e9ebf0', fontWeight: 600 }, left: 'center' },
  legend: { textStyle: { color: '#9aa1ae' } },
  tooltip: {
    backgroundColor: 'rgba(27, 29, 35, 0.96)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    textStyle: { color: '#e9ebf0' },
    extraCssText: 'box-shadow: 0 10px 28px rgba(0,0,0,0.34); border-radius: 8px;',
  },
  grid: {
    left: 40,
    right: 16,
    top: 32,
    bottom: 32,
    outerBoundsMode: 'same',
    outerBoundsContain: 'axisLabel',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
    axisTick: { show: false },
    axisLabel: { color: '#9aa1ae' },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: '#9aa1ae' },
    splitLine: { lineStyle: { color: 'rgba(154, 161, 174, 0.18)', type: 'dashed' } },
  },
  line: { smooth: true, symbol: 'circle', symbolSize: 6 },
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
})
