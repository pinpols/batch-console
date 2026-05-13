<template>
  <div class="dr-preset">
    <div class="dr-preset__chips">
      <el-radio-group
        v-hover-radio-activate="true"
        :model-value="activePreset"
        size="small"
        @change="onPresetChange"
      >
        <el-radio-button v-for="p in presets" :key="p.key" :value="p.key" :label="p.key">
          {{ p.label }}
        </el-radio-button>
      </el-radio-group>
    </div>
    <el-date-picker
      v-if="activePreset === 'custom'"
      :model-value="modelValue ?? null"
      :type="type"
      :value-format="resolvedFormat"
      :range-separator="t('dateRangePicker.rangeSeparator')"
      :start-placeholder="
        type === 'daterange' ? t('dateRangePicker.startDate') : t('dateRangePicker.startTime')
      "
      :end-placeholder="
        type === 'daterange' ? t('dateRangePicker.endDate') : t('dateRangePicker.endTime')
      "
      class="dr-preset__picker"
      @update:model-value="onPickerChange"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })

  /**
   * 时间范围预设 chip + 自定义日期选择器。
   * 解决"列表筛选时间范围空、用户每次手动选 / 没'今天''最近 7 天'快捷"的体检痛点。
   *
   * 用法:
   *   <DateRangePresetPicker
   *     v-model="timeRange"
   *     default-preset="today"
   *   />
   *   timeRange = ['2026-05-10 00:00:00', '2026-05-10 23:59:59']  // string[2] | null
   *
   * 切到自定义会展开 datetimerange picker;切回 today/7d/... 会自动算出区间发出去。
   */

  type PresetKey = 'today' | '7d' | '30d' | 'thisMonth' | 'all' | 'custom'

  interface Preset {
    key: PresetKey
    label: string
    range?: () => [Date, Date]
  }

  const props = withDefaults(
    defineProps<{
      modelValue: [string, string] | null | undefined
      defaultPreset?: PresetKey
      /** 显式自定义 value-format;不传时按 type 推断('YYYY-MM-DD' / 'YYYY-MM-DD HH:mm:ss') */
      valueFormat?: string
      /** datetimerange = 含时分秒;daterange = 仅日期(列表筛选用日期足够) */
      type?: 'datetimerange' | 'daterange'
      /** 是否显示"全部"chip(不传时间区间) */
      includeAll?: boolean
    }>(),
    {
      defaultPreset: 'today',
      type: 'datetimerange',
      includeAll: true,
    },
  )

  const resolvedFormat = computed(
    () => props.valueFormat ?? (props.type === 'daterange' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'),
  )

  const emit = defineEmits<{
    (e: 'update:modelValue', v: [string, string] | null): void
  }>()

  function startOfDay(d: Date) {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }
  function endOfDay(d: Date) {
    const x = new Date(d)
    x.setHours(23, 59, 59, 999)
    return x
  }
  function daysAgo(n: number) {
    const x = new Date()
    x.setDate(x.getDate() - n)
    return x
  }

  const presets = computed<Preset[]>(() => {
    const base: Preset[] = [
      {
        key: 'today',
        label: t('dateRangePicker.today'),
        range: () => [startOfDay(new Date()), endOfDay(new Date())],
      },
      {
        key: '7d',
        label: t('dateRangePicker.last7d'),
        range: () => [startOfDay(daysAgo(6)), endOfDay(new Date())],
      },
      {
        key: '30d',
        label: t('dateRangePicker.last30d'),
        range: () => [startOfDay(daysAgo(29)), endOfDay(new Date())],
      },
      {
        key: 'thisMonth',
        label: t('dateRangePicker.thisMonth'),
        range: () => {
          const now = new Date()
          return [startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), endOfDay(now)]
        },
      },
    ]
    if (props.includeAll) base.push({ key: 'all', label: t('dateRangePicker.all') })
    base.push({ key: 'custom', label: t('dateRangePicker.custom') })
    return base
  })

  // 用 pad('0') / 简单格式化代替 dayjs(避免新增依赖)
  function fmt(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0')
    const date = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    if (props.type === 'daterange') return date
    return date + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
  }

  // 当前 modelValue 反推 active preset
  const activePreset = computed<PresetKey>(() => {
    const v = props.modelValue
    if (!v || !v[0] || !v[1]) return 'all'
    for (const p of presets.value) {
      if (!p.range) continue
      const [s, e] = p.range()
      if (fmt(s) === v[0] && fmt(e) === v[1]) return p.key
    }
    return 'custom'
  })

  function onPresetChange(key: string | number | boolean | undefined) {
    const k = key as PresetKey
    if (k === 'all') {
      emit('update:modelValue', null)
      return
    }
    if (k === 'custom') {
      // 不立即清空,让用户在 picker 里改
      return
    }
    const p = presets.value.find((x) => x.key === k)
    if (!p?.range) return
    const [s, e] = p.range()
    emit('update:modelValue', [fmt(s), fmt(e)])
  }

  function onPickerChange(v: unknown) {
    if (!v || !Array.isArray(v) || v.length < 2) {
      emit('update:modelValue', null)
      return
    }
    emit('update:modelValue', [String(v[0]), String(v[1])])
  }

  // 初始化:如果父组件没传 modelValue,按 defaultPreset 自动 emit 一次
  watch(
    () => props.modelValue,
    (v, old) => {
      if (v === undefined && old === undefined) {
        const p = presets.value.find((x) => x.key === props.defaultPreset)
        if (p?.range) {
          const [s, e] = p.range()
          emit('update:modelValue', [fmt(s), fmt(e)])
        }
      }
    },
    { immediate: true },
  )
</script>

<style scoped>
  .dr-preset {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .dr-preset__picker {
    margin-left: 4px;
  }
</style>
