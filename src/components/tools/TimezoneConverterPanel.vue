<template>
  <div class="tool-panel">
    <div class="tool-panel__intro">
      <h3>{{ t('operationsToolkit.timezone.title') }}</h3>
      <p>{{ t('operationsToolkit.timezone.description') }}</p>
    </div>
    <el-form label-position="top" class="tool-form tool-form--grid">
      <el-form-item :label="t('operationsToolkit.timezone.wallTime')">
        <el-date-picker
          v-model="wallTime"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          :placeholder="t('operationsToolkit.timezone.wallTimePlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.timezone.sourceTimezone')">
        <el-select v-model="sourceTimezone" filterable>
          <el-option v-for="item in timezoneOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item
        class="tool-form__wide"
        :label="t('operationsToolkit.timezone.targetTimezones')"
      >
        <el-select v-model="targetTimezones" multiple filterable :multiple-limit="4">
          <el-option v-for="item in timezoneOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
    </el-form>

    <el-alert
      v-if="!conversion"
      type="warning"
      :closable="false"
      :title="t('operationsToolkit.timezone.invalid')"
      show-icon
    />
    <template v-else>
      <div class="tool-result-bar">
        <span>{{ t('operationsToolkit.timezone.instant') }}</span>
        <CopyableText :text="conversion.instant" />
      </div>
      <el-table :data="conversion.rows" class="console-table" border>
        <el-table-column
          prop="timezone"
          :label="t('operationsToolkit.timezone.colTimezone')"
          min-width="180"
        />
        <el-table-column
          prop="wallTime"
          :label="t('operationsToolkit.timezone.colWallTime')"
          min-width="180"
        />
        <el-table-column
          prop="offset"
          :label="t('operationsToolkit.timezone.colOffset')"
          width="100"
        />
        <el-table-column :label="t('operationsToolkit.timezone.colSeasonal')" width="130">
          <template #default="{ row }">
            {{
              row.offsetVariesThisYear
                ? t('operationsToolkit.timezone.seasonalVaries')
                : t('operationsToolkit.timezone.seasonalStable')
            }}
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import dayjs from 'dayjs'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { DISPLAY_TIMEZONE_OPTIONS, displayTimezone } from '@/constants/timezone'
  import { convertWallTime, listSupportedTimezones } from '@/utils/operationsToolkit'

  const { t } = useI18n({ useScope: 'global' })
  const timezoneOptions = listSupportedTimezones(DISPLAY_TIMEZONE_OPTIONS)
  const wallTime = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
  const sourceTimezone = ref(displayTimezone.value)
  const targetTimezones = ref(
    Array.from(new Set([displayTimezone.value, 'UTC', 'Asia/Shanghai'])).slice(0, 3),
  )
  const conversion = computed(() =>
    convertWallTime(wallTime.value, sourceTimezone.value, targetTimezones.value),
  )
</script>

<style scoped src="./operations-toolkit.css"></style>
