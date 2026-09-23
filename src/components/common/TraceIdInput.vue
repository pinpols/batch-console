<template>
  <el-input
    v-model="model"
    class="trace-id-input"
    :placeholder="placeholder || t('traceIdInput.placeholder')"
    :prefix-icon="Search"
    :maxlength="128"
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
   * 业务 traceId 最多 128 字符，诊断页使用完整值精确查询；不把业务 ID 强制限定为 W3C 十六进制格式。
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
    emit('update:modelValue', v.trim().slice(0, 128))
  }

  async function onPaste() {
    try {
      const text = await navigator.clipboard.readText()
      const cleaned = text.trim()
      if (!cleaned) {
        ElMessage.warning(t('traceIdInput.emptyClipboard'))
        return
      }
      emit('update:modelValue', cleaned.slice(0, 128))
    } catch {
      ElMessage.warning(t('traceIdInput.pasteFailed'))
    }
  }

  function onGo() {
    const traceId = props.modelValue.trim().slice(0, 128)
    if (!props.goTo || !traceId) return
    router.push({ path: '/observability/trace', query: { traceId } })
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
