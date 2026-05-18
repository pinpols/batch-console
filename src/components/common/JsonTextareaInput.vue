<template>
  <div
    class="json-textarea-input"
    :class="{
      'json-textarea-input--dragover': dragover,
      'json-textarea-input--loaded': !!modelValue?.toString().trim(),
    }"
    @dragover.prevent="dragover = true"
    @dragenter.prevent="dragover = true"
    @dragleave.prevent="dragover = false"
    @drop.prevent="onDropFile"
    @paste="onPasteFile"
  >
    <el-input
      :model-value="modelValue"
      type="textarea"
      :rows="rows"
      :placeholder="effectivePlaceholder"
      :spellcheck="false"
      :disabled="disabled"
      class="json-textarea-input__textarea"
      @update:model-value="(v) => emit('update:modelValue', v)"
    />
    <div class="json-textarea-input__bar">
      <div class="json-textarea-input__left">
        <el-button :icon="UploadFilled" size="small" :disabled="disabled" @click="onFilePick">
          选择 JSON 文件
        </el-button>
        <span v-if="fileName" class="json-textarea-input__file">
          <el-icon><Document /></el-icon>
          {{ fileName }}
          <span v-if="fileSize" class="json-textarea-input__size"
            >({{ formatBytes(fileSize) }})</span
          >
        </span>
        <span v-else class="json-textarea-input__tip"> 或拖入 / ⌘V 粘贴文件 </span>
      </div>
      <div class="json-textarea-input__right">
        <span v-if="parseStatus.kind === 'error'" class="json-textarea-input__parse-err">
          <el-icon><Warning /></el-icon>
          {{ parseStatus.message }}
        </span>
        <span v-else-if="parseStatus.kind === 'ok'" class="json-textarea-input__parse-ok">
          <el-icon><Check /></el-icon>
          JSON 合法 · {{ parseStatus.summary }}
        </span>
        <el-button
          v-if="modelValue?.toString().trim()"
          link
          type="info"
          size="small"
          :disabled="disabled"
          @click="onClear"
        >
          清空
        </el-button>
      </div>
    </div>
    <input
      ref="fileInputEl"
      type="file"
      accept="application/json,.json"
      hidden
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
  /**
   * 通用 JSON 文本输入框 — 支持三合一输入(粘贴文本 / 拖入文件 / 选择文件)+ 实时解析提示。
   *
   * v-model:
   *   <JsonTextareaInput v-model="form.payloadJson" />
   *
   * 设计要点:
   *   - 不强校验 JSON 合法性,只解析后给视觉反馈(parse err 红字 / 合法显示摘要)
   *   - 大文件限制 (maxBytes prop,默认 5 MB) 防误传超大 bundle
   *   - 文件类型限制 .json(扩展名 + MIME 双判)
   *   - paste 事件:有文件走文件路径,纯文本不拦截让 el-input 原生 paste 接管
   */
  import { computed, onMounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import { UploadFilled, Document, Warning, Check } from '@element-plus/icons-vue'

  const props = withDefaults(
    defineProps<{
      modelValue?: string
      rows?: number
      placeholder?: string
      disabled?: boolean
      /** 文件大小上限,bytes (默认 5MB) */
      maxBytes?: number
      /** 期望根 JSON 类型:object / array / any */
      expect?: 'object' | 'array' | 'any'
    }>(),
    {
      modelValue: '',
      rows: 8,
      placeholder: '',
      disabled: false,
      maxBytes: 5 * 1024 * 1024,
      expect: 'any',
    },
  )

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'file-loaded', file: File): void
  }>()

  const dragover = ref(false)
  const fileInputEl = ref<HTMLInputElement>()
  const fileName = ref('')
  const fileSize = ref(0)

  const defaultSeed = computed(() => (props.expect === 'array' ? '[]' : '{}'))

  function ensureDefault() {
    if (props.disabled) return
    if (!props.modelValue || !props.modelValue.toString().trim()) {
      emit('update:modelValue', defaultSeed.value)
    }
  }
  onMounted(ensureDefault)

  const effectivePlaceholder = computed(
    () => props.placeholder || '把 .json 文件拖进来 / 点「选择文件」/ ⌘V 粘贴 / 直接键入',
  )

  type ParseStatus =
    | { kind: 'idle' }
    | { kind: 'ok'; summary: string }
    | { kind: 'error'; message: string }

  const parseStatus = computed<ParseStatus>(() => {
    const raw = props.modelValue?.toString().trim()
    if (!raw) return { kind: 'idle' }
    try {
      const parsed = JSON.parse(raw)
      if (props.expect === 'array' && !Array.isArray(parsed)) {
        return { kind: 'error', message: '期望根是 JSON 数组' }
      }
      if (
        props.expect === 'object' &&
        (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      ) {
        return { kind: 'error', message: '期望根是 JSON 对象' }
      }
      const summary = Array.isArray(parsed)
        ? `数组 ${parsed.length} 项`
        : typeof parsed === 'object' && parsed !== null
          ? `对象 ${Object.keys(parsed).length} 字段`
          : `${typeof parsed} 值`
      return { kind: 'ok', summary }
    } catch (err) {
      return { kind: 'error', message: (err as Error).message.replace(/^JSON\.parse: /, '') }
    }
  })

  function onFilePick() {
    fileInputEl.value?.click()
  }

  async function loadFile(file: File) {
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      ElMessage.warning(`仅支持 .json 文件,当前: ${file.name || file.type || '未知'}`)
      return
    }
    if (file.size > props.maxBytes) {
      ElMessage.error(`文件超过 ${Math.round(props.maxBytes / 1024 / 1024)} MB,请精简后再导入`)
      return
    }
    try {
      const text = await file.text()
      emit('update:modelValue', text)
      emit('file-loaded', file)
      fileName.value = file.name
      fileSize.value = file.size
      ElMessage.success(`已加载 ${file.name}`)
    } catch (err) {
      ElMessage.error(`文件读取失败:${(err as Error).message}`)
    }
  }

  async function onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) await loadFile(file)
    input.value = ''
  }

  async function onDropFile(ev: DragEvent) {
    dragover.value = false
    const file = ev.dataTransfer?.files?.[0]
    if (file) await loadFile(file)
  }

  async function onPasteFile(ev: ClipboardEvent) {
    const file = ev.clipboardData?.files?.[0]
    if (file) {
      ev.preventDefault()
      await loadFile(file)
    }
    // 纯文本 paste 不拦截,let el-input 原生 paste 接管
  }

  function onClear() {
    emit('update:modelValue', defaultSeed.value)
    fileName.value = ''
    fileSize.value = 0
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 / 1024).toFixed(2)} MB`
  }
</script>

<style scoped>
  .json-textarea-input {
    position: relative;
    border: 1px dashed var(--color-border-subtle);
    border-radius: 8px;
    padding: 4px 4px 0;
    transition:
      border-color 0.18s,
      background 0.18s;
    width: 100%;
  }
  .json-textarea-input--dragover {
    border-color: var(--color-primary);
    background: var(--color-primary-light-9, rgba(64, 158, 255, 0.06));
  }
  .json-textarea-input--loaded {
    border-style: solid;
    border-color: var(--color-border-light);
  }

  .json-textarea-input__textarea :deep(.el-textarea__inner) {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
    line-height: 1.55;
  }

  .json-textarea-input__bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 6px 6px;
    border-top: 1px solid var(--color-border-subtle);
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .json-textarea-input__left,
  .json-textarea-input__right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
  }

  .json-textarea-input__file {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-success);
    font-family: 'SF Mono', Monaco, monospace;
  }
  .json-textarea-input__size {
    color: var(--color-text-tertiary);
  }
  .json-textarea-input__tip {
    color: var(--color-text-tertiary);
  }

  .json-textarea-input__parse-err {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-danger);
  }
  .json-textarea-input__parse-ok {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-success);
  }
</style>
