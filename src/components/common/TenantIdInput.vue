<template>
  <div class="tenant-id-input">
    <el-input
      v-model="model"
      :placeholder="placeholder || 'bank-corp / mall-mvp'"
      maxlength="64"
      show-word-limit
      @input="onInput"
      @blur="touched = true"
    >
      <template v-if="model" #suffix>
        <el-icon v-if="ok" class="tii-ok"><CircleCheckFilled /></el-icon>
        <el-icon v-else class="tii-err"><WarningFilled /></el-icon>
      </template>
    </el-input>
    <div v-if="touched && model" class="tii-msg" :class="{ 'tii-msg--err': !ok }">
      <template v-if="ok">{{ t('tenantIdInput.ok') }}</template>
      <template v-else>{{ errMsg }}</template>
    </div>
    <div v-else-if="!model" class="tii-hint">
      {{ t('tenantIdInput.hint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * tenantId 输入组件 — 跟后端 ReservedPrefixGuard 配套,前置 hint + 即时校验:
   *
   * - 格式:`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`(跟 @ValidTenantId 一致)
   * - 拒绝保留前缀:e2e- / qa- / dev- / local- / test- / _internal-
   * - 拒绝保留字:system / default / admin
   * - 建议风格:全小写、业务/部门简写、字母开头(`bank-corp` / `mall-mvp`)
   *
   * 仅前端 hint,不阻止提交(让 BE 是最终权威);用 v-model 双向,可被 form rules
   * 进一步约束。
   */
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { CircleCheckFilled, WarningFilled } from '@element-plus/icons-vue'

  const { t } = useI18n({ useScope: 'global' })

  const props = withDefaults(
    defineProps<{
      modelValue: string
      placeholder?: string
    }>(),
    { placeholder: '' },
  )

  const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

  const touched = ref(false)

  const model = computed({
    get: () => props.modelValue,
    set: (v: string) => emit('update:modelValue', v),
  })

  // 跟后端 ReservedPrefixGuard 完全对齐
  const RESERVED_PREFIXES = ['e2e-', 'qa-', 'dev-', 'local-', 'test-', '_internal-']
  const RESERVED_IDS = ['system', 'default', 'admin']
  const FORMAT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

  const validation = computed(() => {
    const v = props.modelValue
    if (!v) return { ok: false, errMsg: '' }
    if (!FORMAT_RE.test(v)) {
      return { ok: false, errMsg: t('tenantIdInput.errFormat') }
    }
    const lower = v.toLowerCase()
    if (RESERVED_IDS.includes(lower)) {
      return { ok: false, errMsg: t('tenantIdInput.errReservedId', { id: v }) }
    }
    for (const p of RESERVED_PREFIXES) {
      if (lower.startsWith(p)) {
        return { ok: false, errMsg: t('tenantIdInput.errReservedPrefix', { prefix: p }) }
      }
    }
    return { ok: true, errMsg: '' }
  })

  const ok = computed(() => validation.value.ok)
  const errMsg = computed(() => validation.value.errMsg)

  function onInput(v: string) {
    emit('update:modelValue', v)
  }
</script>

<style scoped>
  .tenant-id-input {
    width: 100%;
  }
  .tii-msg {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-color-success);
  }
  .tii-msg--err {
    color: var(--el-color-danger);
  }
  .tii-hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
  .tii-ok {
    color: var(--el-color-success);
  }
  .tii-err {
    color: var(--el-color-danger);
  }
</style>
