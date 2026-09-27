<template>
  <div class="tool-panel">
    <div class="tool-panel__intro">
      <h3>{{ t('operationsToolkit.naming.title') }}</h3>
      <p>{{ t('operationsToolkit.naming.description') }}</p>
    </div>
    <el-form label-position="top" class="tool-form tool-form--grid">
      <el-form-item class="tool-form__wide" :label="t('operationsToolkit.naming.rule')">
        <el-input
          v-model="form.namingRule"
          :placeholder="t('operationsToolkit.naming.rulePlaceholder')"
        />
        <div class="tool-form__help">{{ t('operationsToolkit.naming.placeholders') }}</div>
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.naming.format')">
        <el-select v-model="form.fileFormatType">
          <el-option v-for="format in formats" :key="format" :label="format" :value="format" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.naming.bizType')">
        <el-input v-model="form.bizType" clearable />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.naming.bizDate')">
        <el-date-picker v-model="form.bizDate" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.naming.batchNo')">
        <el-input v-model="form.batchNo" clearable />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.naming.region')">
        <el-input v-model="form.region" clearable />
      </el-form-item>
      <el-form-item :label="t('operationsToolkit.naming.version')">
        <el-input v-model="form.version" clearable />
      </el-form-item>
    </el-form>
    <div class="tool-action-row tool-action-row--end">
      <el-button type="primary" :loading="loading" @click="preview">
        {{ t('operationsToolkit.naming.preview') }}
      </el-button>
    </div>
    <div v-if="fileName" class="tool-result-bar tool-result-bar--strong">
      <span>{{ t('operationsToolkit.naming.result') }}</span>
      <CopyableText :text="fileName" />
    </div>
    <el-alert
      type="info"
      :closable="false"
      :title="t('operationsToolkit.naming.authorityNote')"
      show-icon
    />
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { previewFileTemplateName } from '@/api/system'
  import CopyableText from '@/components/common/CopyableText.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { todayBusinessDate } from '@/utils/datetime'

  const { t } = useI18n({ useScope: 'global' })
  const tenant = useTenantStore()
  const formats = ['DELIMITED', 'EXCEL', 'FIXED_WIDTH', 'JSON', 'XML'] as const
  const form = reactive({
    namingRule: '${bizType}_${bizDate}_${batchNo}',
    fileFormatType: 'DELIMITED',
    bizType: '',
    bizDate: todayBusinessDate(),
    batchNo: '',
    region: '',
    version: '',
  })
  const loading = ref(false)
  const fileName = ref('')

  async function preview() {
    if (!tenant.tenantId || !form.bizDate) {
      ElMessage.warning(t('operationsToolkit.naming.required'))
      return
    }
    loading.value = true
    try {
      const result = await previewFileTemplateName({ tenantId: tenant.tenantId, ...form })
      fileName.value = result.fileName
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped src="./operations-toolkit.css"></style>
