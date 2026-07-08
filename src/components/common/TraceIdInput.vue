<template>
  <el-input
    v-model="model"
    class="trace-id-input"
    :placeholder="placeholder || t('traceIdInput.placeholder')"
    :prefix-icon="Search"
    clearable
    @input="onInput"
    @keydown.enter="onGo"
  >
    <!-- 空态:右侧一个轻量「粘贴」图标(有值时 EP 清除键接管,互不打架);回车 / 点前缀直达。 -->
    <template #suffix>
      <el-tooltip v-if="!model" :content="t('traceIdInput.paste')" placement="top">
        <el-icon
          class="trace-id-input__paste"
          :aria-label="t('traceIdInput.paste')"
          @click.stop="onPaste"
        >
          <ClipboardPaste />
        </el-icon>
      </el-tooltip>
    </template>
  </el-input>
</template>

<script setup lang="ts">
  /**
   * traceId 输入框 — 粘贴自动 trim;回车 / 🔍 按钮直接跳 `/observability/trace?traceId=`,
   * 让 oncall 排障三步变一步:
   *   1) 复制 traceId
   *   2) 不用挖菜单,直接在任意页面的工具栏粘贴
   *   3) 回车直达
   *
   * 容错:32 字符 hex(W3C TraceContext 标准)以外的字符自动 trim;过短不阻止(允许片段)。
   */
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { Search, ClipboardPaste } from 'lucide-vue-next'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()

  const props = withDefaults(
    defineProps<{
      modelValue: string
      placeholder?: string
      /** 输入后是否提供「直达 trace 诊断页」按钮,默认 true */
      goTo?: boolean
    }>(),
    { placeholder: '', goTo: true },
  )

  const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

  const model = computed({
    get: () => props.modelValue,
    set: (v: string) => emit('update:modelValue', v.trim()),
  })

  function onInput(v: string) {
    emit('update:modelValue', v.trim())
  }

  async function onPaste() {
    try {
      const text = await navigator.clipboard.readText()
      const cleaned = text.trim()
      if (!cleaned) {
        ElMessage.warning(t('traceIdInput.emptyClipboard'))
        return
      }
      emit('update:modelValue', cleaned)
    } catch {
      ElMessage.warning(t('traceIdInput.pasteFailed'))
    }
  }

  function onGo() {
    if (!props.goTo || !props.modelValue) return
    router.push({ path: '/observability/trace', query: { traceId: props.modelValue } })
  }
</script>

<style scoped>
  .trace-id-input__paste {
    cursor: pointer;
    color: var(--color-text-tertiary);
    transition: color 0.15s ease;
  }
  .trace-id-input__paste:hover {
    color: var(--color-primary);
  }
</style>
