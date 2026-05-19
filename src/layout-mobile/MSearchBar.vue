<template>
  <div class="m-searchbar" :class="{ 'm-searchbar--focused': focused }">
    <el-icon class="m-searchbar__icon"><Search /></el-icon>
    <input
      ref="inputRef"
      v-model="localValue"
      type="search"
      :placeholder="placeholder || t('common.search')"
      class="m-searchbar__input"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="search"
      @focus="focused = true"
      @blur="focused = false"
      @input="onInput"
    />
    <button
      v-if="localValue"
      type="button"
      class="m-searchbar__clear"
      :aria-label="t('common.clear')"
      @click="onClear"
    >
      <el-icon><CircleCloseFilled /></el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { CircleCloseFilled, Search } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })

  const props = withDefaults(
    defineProps<{
      modelValue: string
      placeholder?: string
      /** 输入防抖 ms,默认 250。设 0 关闭防抖 */
      debounce?: number
    }>(),
    { placeholder: '', debounce: 250 },
  )

  const emit = defineEmits<{
    (e: 'update:modelValue', v: string): void
    (e: 'search', v: string): void
  }>()

  const inputRef = ref<HTMLInputElement | null>(null)
  const focused = ref(false)
  const localValue = ref(props.modelValue)

  // 外部改值时同步进来
  watch(
    () => props.modelValue,
    (v) => {
      if (v !== localValue.value) localValue.value = v
    },
  )

  let timer: ReturnType<typeof setTimeout> | null = null
  function onInput() {
    emit('update:modelValue', localValue.value)
    if (timer) clearTimeout(timer)
    if (props.debounce > 0) {
      timer = setTimeout(() => emit('search', localValue.value), props.debounce)
    } else {
      emit('search', localValue.value)
    }
  }

  function onClear() {
    localValue.value = ''
    emit('update:modelValue', '')
    emit('search', '')
    inputRef.value?.focus()
  }

  defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<style scoped>
  /* iOS SearchBar:fill-tertiary 灰底 / 圆角 10px / 左 search icon / 右 clear x;
     focus 时 2px iOS-blue ring,跟 .el-input__wrapper 风格一致 */
  .m-searchbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    min-height: 36px;
    background: var(--ios-fill-tertiary);
    border-radius: 10px;
    transition: box-shadow 0.15s ease;
  }

  .m-searchbar--focused {
    box-shadow: 0 0 0 2px var(--ios-blue);
  }

  .m-searchbar__icon {
    color: var(--ios-label-tertiary);
    font-size: 16px;
    flex-shrink: 0;
  }

  .m-searchbar__input {
    flex: 1;
    min-width: 0;
    height: 32px;
    border: none;
    background: transparent;
    outline: none;
    font-size: 15px;
    color: var(--ios-label-primary);
    font-family: inherit;
    letter-spacing: -0.01em;
    -webkit-appearance: none;
  }

  .m-searchbar__input::placeholder {
    color: var(--ios-label-tertiary);
  }

  /* 去掉 type=search 自带的浏览器原生 clear icon,我们自己渲染 */
  .m-searchbar__input::-webkit-search-cancel-button,
  .m-searchbar__input::-webkit-search-decoration {
    -webkit-appearance: none;
    display: none;
  }

  .m-searchbar__clear {
    border: none;
    background: transparent;
    color: var(--ios-label-tertiary);
    padding: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    transition: opacity 0.1s ease;
  }

  .m-searchbar__clear :deep(.el-icon) {
    font-size: 18px;
  }

  .m-searchbar__clear:active {
    opacity: 0.5;
  }
</style>
