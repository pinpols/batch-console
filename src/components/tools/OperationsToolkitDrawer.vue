<template>
  <el-drawer
    v-model="open"
    direction="rtl"
    size="min(47.5rem, 94vw)"
    append-to-body
    class="operations-toolkit-drawer"
    :title="t('operationsToolkit.title')"
  >
    <el-tabs v-model="activeTab" class="toolkit-tabs">
      <el-tab-pane name="timezone" :label="t('operationsToolkit.tabs.timezone')">
        <TimezoneConverterPanel />
      </el-tab-pane>
      <el-tab-pane name="cron" :label="t('operationsToolkit.tabs.cron')">
        <CronToolPanel />
      </el-tab-pane>
      <el-tab-pane name="file" :label="t('operationsToolkit.tabs.file')">
        <FileInspectorPanel />
      </el-tab-pane>
      <el-tab-pane name="naming" :label="t('operationsToolkit.tabs.naming')">
        <FileNamePreviewPanel />
      </el-tab-pane>
      <el-tab-pane name="retry" :label="t('operationsToolkit.tabs.retry')">
        <RetryTimelinePanel />
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import TimezoneConverterPanel from './TimezoneConverterPanel.vue'
  import CronToolPanel from './CronToolPanel.vue'
  import FileInspectorPanel from './FileInspectorPanel.vue'
  import FileNamePreviewPanel from './FileNamePreviewPanel.vue'
  import RetryTimelinePanel from './RetryTimelinePanel.vue'

  const props = defineProps<{ modelValue: boolean }>()
  const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()
  const { t } = useI18n({ useScope: 'global' })
  const activeTab = ref('timezone')
  const open = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value),
  })

  function show(tab = 'timezone') {
    activeTab.value = tab
    emit('update:modelValue', true)
  }
  defineExpose({ show })
</script>

<style scoped>
  .toolkit-tabs {
    height: 100%;
  }
</style>
