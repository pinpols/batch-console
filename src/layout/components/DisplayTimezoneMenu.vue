<template>
  <el-dropdown trigger="click" placement="bottom-end" @command="changeDisplayTimezone">
    <button
      type="button"
      class="timezone-trigger"
      :aria-label="timezoneTooltip"
      :title="timezoneTooltip"
    >
      <el-icon><TimezoneIcon /></el-icon>
      <span class="timezone-trigger__offset">{{ timezoneOffsetLabel(currentTimezone) }}</span>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item disabled>
          <span class="timezone-menu__label">{{ t('layoutHeader.timezoneLabel') }}</span>
          <span class="timezone-menu__current">{{ currentTimezone }}</span>
          <span class="timezone-menu__hint">{{ t('layoutHeader.timezoneScopeHint') }}</span>
        </el-dropdown-item>
        <el-dropdown-item
          v-for="timezone in timezoneOptions"
          :key="timezone"
          :command="timezone"
          :disabled="timezone === currentTimezone"
        >
          <el-icon v-if="timezone === currentTimezone"><Check /></el-icon>
          <span class="timezone-option">
            <span class="timezone-option__name">{{ timezone }}</span>
            <span class="timezone-option__offset">{{ timezoneOffsetLabel(timezone) }}</span>
          </span>
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Check, Globe2 as TimezoneIcon } from '@lucide/vue'
  import {
    displayTimezone,
    getDisplayTimezoneOptions,
    getTimezoneOffsetLabel,
    writeDisplayTimezone,
  } from '@/constants/timezone'

  const { t } = useI18n({ useScope: 'global' })
  const currentTimezone = displayTimezone
  const timezoneOptions = computed(() => getDisplayTimezoneOptions(currentTimezone.value))
  const timezoneOffsetLabel = getTimezoneOffsetLabel
  const timezoneTooltip = computed(() =>
    t('layoutHeader.timezoneTooltipWithCurrent', { timezone: currentTimezone.value }),
  )

  function changeDisplayTimezone(timezone: string | number | object) {
    if (typeof timezone !== 'string' || timezone === currentTimezone.value) return
    try {
      writeDisplayTimezone(timezone)
      ElMessage.success(t('layoutHeader.timezoneChanged', { timezone }))
    } catch {
      ElMessage.error(t('layoutHeader.invalidTimezone'))
    }
  }
</script>

<style scoped>
  .timezone-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 32px;
    height: 32px;
    padding-inline: 5px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-button);
    background: color-mix(in srgb, var(--color-bg-elevated) 74%, transparent);
    color: var(--color-text-secondary);
    cursor: pointer;
    outline: none;
  }

  .timezone-trigger:hover,
  .timezone-trigger:focus-visible {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border) 60%);
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-bg-elevated) 90%);
  }

  .timezone-trigger__offset {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
  }

  .timezone-menu__label,
  .timezone-menu__current {
    display: block;
  }

  .timezone-menu__hint {
    display: block;
    max-width: 250px;
    margin-top: 6px;
    color: var(--color-text-tertiary);
    font-size: 11px;
    line-height: 1.5;
    white-space: normal;
  }

  .timezone-menu__current {
    margin-top: 2px;
    color: var(--color-text-tertiary);
    font-size: 11px;
    font-weight: 400;
  }

  .timezone-option {
    display: inline-flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 18px;
    min-width: 188px;
  }

  .timezone-option__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .timezone-option__offset {
    flex: 0 0 auto;
    color: var(--color-text-tertiary);
    font-size: 11px;
  }
</style>
