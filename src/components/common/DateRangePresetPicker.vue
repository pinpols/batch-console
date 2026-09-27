<template>
  <div class="dr-preset">
    <el-select
      :model-value="activePreset"
      :placeholder="t('dateRangePicker.custom')"
      class="dr-preset__select"
      @change="onPresetChange"
    >
      <el-option v-for="p in presets" :key="p.key" :label="p.label" :value="p.key" />
    </el-select>
    <InstantRangePicker
      v-if="type === 'datetimerange'"
      :model-value="modelValue"
      :range-separator="t('dateRangePicker.rangeSeparator')"
      :start-placeholder="t('dateRangePicker.startTime')"
      :end-placeholder="t('dateRangePicker.endTime')"
      class="dr-preset__picker"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <el-date-picker
      v-else
      :model-value="modelValue ?? null"
      type="daterange"
      value-format="YYYY-MM-DD"
      :range-separator="t('dateRangePicker.rangeSeparator')"
      :start-placeholder="t('dateRangePicker.startDate')"
      :end-placeholder="t('dateRangePicker.endDate')"
      class="dr-preset__picker"
      @update:model-value="onPickerChange"
    />
  </div>
</template>

<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { displayTimezone } from '@/constants/timezone'
  import { presetDateRange, readBusinessTimezone } from '@/utils/datetime'
  import InstantRangePicker from './InstantRangePicker.vue'

  const { t } = useI18n({ useScope: 'global' })

  /**
   * 日期范围输出 LocalDate 字符串；时间范围输出 UTC Instant 字符串。
   * 选择器墙上时间始终按当前展示时区换算。
   */

  type PresetKey = 'today' | '7d' | '30d' | 'thisMonth' | 'all'

  interface Preset {
    key: PresetKey
    label: string
    range?: () => [string, string]
  }

  const props = withDefaults(
    defineProps<{
      modelValue: [string, string] | null | undefined
      defaultPreset?: PresetKey
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

  const emit = defineEmits<{
    (e: 'update:modelValue', v: [string, string] | null): void
  }>()

  const zone = computed(() =>
    props.type === 'daterange' ? readBusinessTimezone() : displayTimezone.value,
  )
  const presets = computed<Preset[]>(() => {
    const base: Preset[] = [
      {
        key: 'today',
        label: t('dateRangePicker.today'),
        range: () => presetDateRange('today', props.type, zone.value),
      },
      {
        key: '7d',
        label: t('dateRangePicker.last7d'),
        range: () => presetDateRange('7d', props.type, zone.value),
      },
      {
        key: '30d',
        label: t('dateRangePicker.last30d'),
        range: () => presetDateRange('30d', props.type, zone.value),
      },
      {
        key: 'thisMonth',
        label: t('dateRangePicker.thisMonth'),
        range: () => presetDateRange('thisMonth', props.type, zone.value),
      },
    ]
    if (props.includeAll) base.push({ key: 'all', label: t('dateRangePicker.all') })
    return base
  })

  // 反推当前 modelValue 命中哪个 preset;不命中时返回 undefined → 无 chip 高亮,
  // 表示用户在 picker 里挑了自由日期。
  const activePreset = computed<PresetKey | undefined>(() => {
    const v = props.modelValue
    if (!v || !v[0] || !v[1]) return 'all'
    for (const p of presets.value) {
      if (!p.range) continue
      const [s, e] = p.range()
      if (s === v[0] && e === v[1]) return p.key
    }
    return undefined
  })

  function onPresetChange(key: string | number | boolean | undefined) {
    const k = key as PresetKey
    if (k === 'all') {
      emit('update:modelValue', null)
      return
    }
    const p = presets.value.find((x) => x.key === k)
    if (!p?.range) return
    emit('update:modelValue', p.range())
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
          emit('update:modelValue', p.range())
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

  .dr-preset__select {
    width: 130px;
  }

  @media (max-width: 720px) {
    .dr-preset {
      width: 100%;
      align-items: stretch;
    }

    .dr-preset__select,
    .dr-preset__picker {
      width: 100% !important;
      min-width: 0;
    }
  }
</style>
