import { describe, expect, it } from 'vitest'
import {
  buildHorizontalStackedStatusOption,
  buildStatusBarOption,
  buildStatusColumnOption,
  emptyOption,
} from './useChartOptions'

describe('distribution chart options', () => {
  it('renders status counts as a single stacked horizontal bar', () => {
    const option = buildHorizontalStackedStatusOption([
      { name: 'Running', value: 4, color: '#1668e3' },
      { name: 'Failed', value: 0, color: '#d64543' },
    ])
    const series = option.series as { name: string; stack: string; data: number[] }[]

    expect(series).toHaveLength(2)
    expect(series.map(({ data }) => data[0])).toEqual([4, 0])
    expect(series.every(({ stack }) => stack === 'total')).toBe(true)
  })

  it('keeps zero-valued categories visible in the status comparison', () => {
    const option = buildStatusBarOption([
      { name: 'Critical', value: 0, color: '#d64543' },
      { name: 'Other', value: 3, color: '#b57816' },
    ])
    const yAxis = option.yAxis as { data: string[] }
    const series = option.series as { data: { value: number }[] }[]

    expect(yAxis.data).toEqual(['Other', 'Critical'])
    expect(series[0].data.map(({ value }) => value)).toEqual([3, 0])
  })

  it('maps each worker status to its own colored column', () => {
    const option = buildStatusColumnOption([
      { name: 'Online', value: 2, color: '#22845a' },
      { name: 'Draining', value: 0, color: '#b57816' },
    ])
    const xAxis = option.xAxis as { data: string[] }
    const series = option.series as { data: { name: string; value: number }[] }[]

    expect(xAxis.data).toEqual(['Online', 'Draining'])
    expect(series[0].data.map(({ value }) => value)).toEqual([2, 0])
  })

  it('keeps chart axes visible for an empty Cartesian state', () => {
    const option = emptyOption('No data')

    expect(option.xAxis).toMatchObject({ type: 'category', data: [] })
    expect(option.yAxis).toMatchObject({ type: 'value', min: 0, axisLine: { show: true } })
    expect(option.series).toEqual([])
  })

  it('can omit axes for empty charts that do not use Cartesian coordinates', () => {
    const option = emptyOption('No data', { axes: false })

    expect(option.xAxis).toMatchObject({ show: false })
    expect(option.yAxis).toMatchObject({ show: false })
  })
})
