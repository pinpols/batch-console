<template>
  <div class="tool-panel">
    <div class="tool-panel__intro">
      <h3>{{ t('operationsToolkit.file.title') }}</h3>
      <p>{{ t('operationsToolkit.file.description') }}</p>
    </div>
    <div class="tool-action-row">
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        :limit="1"
        :on-change="inspect"
        :on-exceed="replaceFile"
      >
        <el-button type="primary" plain :icon="FileSearch">
          {{ t('operationsToolkit.file.choose') }}
        </el-button>
      </el-upload>
      <span class="tool-muted">{{ t('operationsToolkit.file.localOnly') }}</span>
    </div>

    <EmptyState
      v-if="!fileInfo"
      :title="t('operationsToolkit.file.emptyTitle')"
      :description="t('operationsToolkit.file.emptyDescription')"
    />
    <template v-else>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item :label="t('operationsToolkit.file.name')">{{
          fileInfo.name
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('operationsToolkit.file.size')">{{
          formatBytes(fileInfo.size)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('operationsToolkit.file.encoding')">{{
          fileInfo.inspection.encoding
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('operationsToolkit.file.bom')">{{
          yesNo(fileInfo.inspection.hasBom)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('operationsToolkit.file.lineEnding')">{{
          fileInfo.inspection.lineEnding
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('operationsToolkit.file.delimiter')">{{
          delimiterLabel(fileInfo.inspection.delimiter)
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('operationsToolkit.file.sampleLines')">{{
          fileInfo.inspection.sampledLines
        }}</el-descriptions-item>
        <el-descriptions-item :label="t('operationsToolkit.file.binary')">{{
          yesNo(fileInfo.inspection.likelyBinary)
        }}</el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="fileInfo.inspection.likelyBinary"
        type="warning"
        :closable="false"
        :title="t('operationsToolkit.file.binaryWarning')"
        show-icon
      />
      <div class="tool-result-bar">
        <span>{{ t('operationsToolkit.file.sha256') }}</span>
        <CopyableText v-if="checksum" :text="checksum" />
        <el-button v-else link type="primary" :loading="hashing" @click="calculateHash">
          {{ t('operationsToolkit.file.calculateHash') }}
        </el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { SearchCode as FileSearch } from '@lucide/vue'
  import type { UploadFile, UploadFiles, UploadRawFile } from 'element-plus'
  import { ElMessage } from 'element-plus'
  import CopyableText from '@/components/common/CopyableText.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import {
    inspectFileSample,
    sha256Hex,
    type FileSampleInspection,
  } from '@/utils/operationsToolkit'

  const SAMPLE_BYTES = 128 * 1024
  const MAX_HASH_BYTES = 64 * 1024 * 1024
  const { t } = useI18n({ useScope: 'global' })
  const selectedFile = ref<File | null>(null)
  const fileInfo = ref<{ name: string; size: number; inspection: FileSampleInspection } | null>(
    null,
  )
  const checksum = ref('')
  const hashing = ref(false)

  async function inspect(uploadFile: UploadFile) {
    const raw = uploadFile.raw
    if (!raw) return
    selectedFile.value = raw
    checksum.value = ''
    const bytes = new Uint8Array(await raw.slice(0, SAMPLE_BYTES).arrayBuffer())
    fileInfo.value = { name: raw.name, size: raw.size, inspection: inspectFileSample(bytes) }
  }

  function replaceFile(files: File[], _uploadFiles: UploadFiles) {
    const raw = files[0] as UploadRawFile | undefined
    if (raw) void inspect({ name: raw.name, size: raw.size, raw } as UploadFile)
  }

  async function calculateHash() {
    const file = selectedFile.value
    if (!file) return
    if (file.size > MAX_HASH_BYTES) {
      ElMessage.warning(t('operationsToolkit.file.hashTooLarge'))
      return
    }
    hashing.value = true
    try {
      checksum.value = await sha256Hex(file)
    } finally {
      hashing.value = false
    }
  }

  function formatBytes(size: number) {
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`
    return `${(size / 1024 / 1024).toFixed(1)} MiB`
  }
  function yesNo(value: boolean) {
    return value ? t('common.yes') : t('common.no')
  }
  function delimiterLabel(value: FileSampleInspection['delimiter']) {
    if (!value) return t('operationsToolkit.file.notDetected')
    if (value === '\t') return t('operationsToolkit.file.tab')
    return value
  }
</script>

<style scoped src="./operations-toolkit.css"></style>
