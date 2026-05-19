<template>
  <el-input
    v-model="model"
    type="password"
    show-password
    :placeholder="placeholder || t('common.passwordHint')"
    :maxlength="maxlength"
    @input="onChange"
  >
    <template #append>
      <el-tooltip :content="t('common.passwordGenerate')" placement="top">
        <el-button :icon="MagicStick" @click="onGenerate" />
      </el-tooltip>
      <el-tooltip :content="t('common.passwordCopy')" placement="top">
        <el-button :icon="DocumentCopy" :disabled="!model" @click="onCopy" />
      </el-tooltip>
    </template>
  </el-input>
  <div v-if="model && showStrength" class="pwd-meta">
    <div class="pwd-strength" :class="`pwd-strength--${strength.level}`">
      <span class="pwd-strength__bar" :style="{ width: strength.score * 25 + '%' }" />
    </div>
    <span class="pwd-strength__label">{{ t(`common.pwdStrength.${strength.level}`) }}</span>
  </div>
</template>

<script setup lang="ts">
  /**
   * 强密码输入框 — 整合「输入 + 🎲 一键生成 + 📋 复制 + 强度指示」4 件套。
   *
   * 替代 4 处散落实现:UserAccountList create / reset / TenantFormDialog adminPassword /
   * TenantBatchCreateDialog adminPassword。改一处样式 / 长度 / 强度规则,4 处同步。
   *
   * 生成规则:`generatePassword(length)`(已有 utils),16 字符,大小写 + 数字 + 特殊。
   * 复制成功 toast。
   * 强度:基于字符集的简易打分(weak/fair/good/strong),不依赖外部库。
   */
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { MagicStick, DocumentCopy } from '@element-plus/icons-vue'
  import { generatePassword } from '@/utils/passwordGenerator'

  const { t } = useI18n({ useScope: 'global' })

  const props = withDefaults(
    defineProps<{
      modelValue: string
      placeholder?: string
      /** 生成时长度,默认 16 */
      length?: number
      maxlength?: number
      /** 是否显示强度指示条,默认 true */
      showStrength?: boolean
    }>(),
    { placeholder: '', length: 16, maxlength: 256, showStrength: true },
  )

  const emit = defineEmits<{
    (e: 'update:modelValue', v: string): void
    (e: 'generated', v: string): void
  }>()

  const model = computed({
    get: () => props.modelValue,
    set: (v: string) => emit('update:modelValue', v),
  })

  function onChange(v: string) {
    emit('update:modelValue', v)
  }

  function onGenerate() {
    const pw = generatePassword(props.length)
    emit('update:modelValue', pw)
    emit('generated', pw)
    ElMessage.success(t('common.passwordGeneratedToast'))
  }

  async function onCopy() {
    if (!props.modelValue) return
    try {
      await navigator.clipboard.writeText(props.modelValue)
      ElMessage.success(t('common.passwordCopiedToast'))
    } catch {
      ElMessage.warning(t('common.passwordCopyFailed'))
    }
  }

  // 简易强度评估:字符集广度 + 长度。0-4 分,对应 weak/fair/good/strong/strong。
  const strength = computed(() => {
    const pw = props.modelValue
    if (!pw) return { score: 0, level: 'weak' as const }
    let s = 0
    if (pw.length >= 8) s++
    if (pw.length >= 12) s++
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    const score = Math.min(s, 4)
    const level =
      score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : ('strong' as const)
    return { score, level }
  })
</script>

<style scoped>
  .pwd-meta {
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pwd-strength {
    flex: 1;
    height: 4px;
    background: var(--el-fill-color-light);
    border-radius: 2px;
    overflow: hidden;
  }
  .pwd-strength__bar {
    display: block;
    height: 100%;
    transition: width 0.18s ease;
  }
  .pwd-strength--weak .pwd-strength__bar {
    background: var(--el-color-danger);
  }
  .pwd-strength--fair .pwd-strength__bar {
    background: var(--el-color-warning);
  }
  .pwd-strength--good .pwd-strength__bar {
    background: var(--el-color-primary);
  }
  .pwd-strength--strong .pwd-strength__bar {
    background: var(--el-color-success);
  }
  .pwd-strength__label {
    font-size: 11px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
    min-width: 36px;
  }
</style>
