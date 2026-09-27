<template>
  <div class="tool-panel">
    <div class="tool-panel__intro">
      <h3>{{ t('operationsToolkit.cron.title') }}</h3>
      <p>{{ t('operationsToolkit.cron.description') }}</p>
    </div>
    <el-form label-position="top" class="tool-form">
      <el-form-item :label="t('operationsToolkit.cron.expression')">
        <CronExprInput
          v-model="expression"
          :placeholder="t('operationsToolkit.cron.placeholder')"
        />
      </el-form-item>
    </el-form>
    <el-alert
      type="info"
      :closable="false"
      :title="t('operationsToolkit.cron.authorityNote')"
      show-icon
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import CronExprInput from '@/components/common/CronExprInput.vue'

  const { t } = useI18n({ useScope: 'global' })
  const expression = ref('0 0 2 * * ?')
</script>

<style scoped src="./operations-toolkit.css"></style>
