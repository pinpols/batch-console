<template>
  <div class="step-footer">
    <!-- 左侧说明：提交为什么不可用、或建议先预览，避免按钮灰着却没有原因 -->
    <p v-if="hint" class="step-footer__hint" role="status">
      <Info :size="14" aria-hidden="true" />
      <span>{{ hint }}</span>
    </p>
    <div class="step-footer__actions">
      <el-button v-if="showCancel" :disabled="cancelDisabled" @click="emit('cancel')">
        {{ cancelText || t('common.cancel') }}
      </el-button>
      <el-button
        plain
        :icon="ScanSearch"
        :loading="previewLoading"
        :disabled="previewDisabled"
        @click="emit('preview')"
      >
        {{ previewText }}
      </el-button>
      <el-button
        :type="submitTone"
        :icon="submitTone === 'danger' ? Play : Send"
        :loading="submitLoading"
        :disabled="submitDisabled"
        :native-type="submitForm ? 'submit' : 'button'"
        :form="submitForm || undefined"
        @click="!submitForm && emit('submit')"
      >
        {{ submitText }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import { Info, Play, ScanSearch, Send } from '@lucide/vue'

  /**
   * “先预览、再提交”类抽屉的底部操作区（批次日重放、区间重放、租户配置初始化 / 复制）。
   * 预览是次要操作（浅底 + 预览图标）；提交按影响选主色或危险色（正式执行写入配置用危险色）；
   * 左侧 hint 说明提交为何不可用或给出建议。业务校验与请求仍由页面持有。
   */
  withDefaults(
    defineProps<{
      previewText: string
      submitText: string
      previewLoading?: boolean
      previewDisabled?: boolean
      submitLoading?: boolean
      submitDisabled?: boolean
      /** 提交按钮语义色：常规提交用 primary，不可撤销的正式执行用 danger */
      submitTone?: 'primary' | 'danger'
      /** 关联原生表单 id 时，提交按钮走表单 submit（保留回车提交与表单校验） */
      submitForm?: string
      hint?: string
      showCancel?: boolean
      cancelText?: string
      cancelDisabled?: boolean
    }>(),
    {
      previewLoading: false,
      previewDisabled: false,
      submitLoading: false,
      submitDisabled: false,
      submitTone: 'primary',
      submitForm: '',
      hint: '',
      showCancel: true,
      cancelText: '',
      cancelDisabled: false,
    },
  )
  const emit = defineEmits<{ cancel: []; preview: []; submit: [] }>()
  const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
  .step-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-sm, 8px) var(--space-md, 12px);
    width: 100%;
  }

  .step-footer__hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: 1 1 220px;
    min-width: 0;
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm, 13px);
    line-height: 1.5;
  }

  .step-footer__hint svg {
    flex: 0 0 auto;
    color: var(--color-primary-text);
  }

  .step-footer__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-sm, 8px);
  }

  .step-footer__actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }
</style>
