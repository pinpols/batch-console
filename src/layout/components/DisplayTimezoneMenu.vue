<template>
  <li class="el-dropdown-menu__item timezone-entry" @click.stop>
    <el-dropdown trigger="click" placement="left-start" @command="changeDisplayTimezone">
      <button
        type="button"
        class="timezone-entry__hit"
        :aria-label="timezoneTooltip"
        :title="timezoneTooltip"
      >
        <el-icon><TimezoneIcon /></el-icon>
        <span class="timezone-entry__label">{{ t('layoutHeader.timezoneLabel') }}</span>
        <span class="timezone-entry__offset">{{ timezoneOffsetLabel(currentTimezone) }}</span>
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
  </li>
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
  .timezone-entry {
    padding: 0;
  }

  .timezone-entry :deep(.el-dropdown) {
    display: block;
    width: 100%;
  }

  .timezone-entry__hit {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin: 0;
    padding: 5px 16px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: 22px;
    text-align: left;
    cursor: pointer;
  }

  .timezone-entry__label {
    flex: 1 1 auto;
  }

  .timezone-entry__offset {
    flex: 0 0 auto;
    color: var(--color-text-tertiary);
    font-size: 12px;
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
