<template>
  <el-drawer
    v-model="visible"
    :append-to-body="true"
    direction="rtl"
    :size="drawerSize"
    class="form-drawer"
    :close-on-click-modal="!saving"
    :close-on-press-escape="!saving"
    :before-close="handleBeforeClose"
    @opened="emit('opened')"
    @closed="emit('closed')"
  >
    <template #header="{ titleId, titleClass }">
      <div class="form-drawer__head">
        <h2 :id="titleId" :class="titleClass">{{ title }}</h2>
        <p v-if="description" class="form-drawer__desc">{{ description }}</p>
      </div>
    </template>

    <slot />

    <template v-if="!hideFooter" #footer>
      <div class="form-drawer__footer-extra">
        <slot name="footer-extra" />
      </div>
      <template v-if="readonly">
        <el-button @click="cancel">{{ t('common.close') }}</el-button>
      </template>
      <template v-else>
        <el-button :disabled="saving" @click="cancel">
          {{ cancelText || t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="saving" :disabled="submitDisabled" @click="submit">
          {{ submitText || t('common.save') }}
        </el-button>
      </template>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'

  /**
   * 编辑抽屉壳：统一新增/编辑/查看的标题区、可滚动正文和底部操作区。
   * 表单本身（el-form、校验、提交请求）仍由页面持有；本组件只负责外观、
   * 宽度档位和“保存中不可关闭、不可重复提交”的交互约束。
   */
  type DrawerSize = 'sm' | 'md' | 'lg'

  const SIZE_PX: Record<DrawerSize, string> = { sm: '480px', md: '640px', lg: '880px' }

  const visible = defineModel<boolean>('visible', { required: true })

  const props = withDefaults(
    defineProps<{
      title: string
      /** 标题下的一句说明，告诉用户这个表单会产生什么效果 */
      description?: string
      size?: DrawerSize
      saving?: boolean
      readonly?: boolean
      hideFooter?: boolean
      submitText?: string
      cancelText?: string
      submitDisabled?: boolean
      /** 页面需要在关闭前做额外判断时传入；返回 false 阻止关闭 */
      beforeClose?: () => boolean | Promise<boolean>
    }>(),
    { size: 'md', description: undefined, submitText: undefined, cancelText: undefined },
  )

  const emit = defineEmits<{ submit: []; cancel: []; opened: []; closed: [] }>()
  const { t } = useI18n()

  const drawerSize = computed(() => SIZE_PX[props.size])

  async function canClose(): Promise<boolean> {
    if (props.saving) return false
    return props.beforeClose ? (await props.beforeClose()) !== false : true
  }

  async function handleBeforeClose(done: () => void) {
    if (await canClose()) done()
  }

  async function cancel() {
    if (!(await canClose())) return
    visible.value = false
    emit('cancel')
  }

  function submit() {
    if (props.saving || props.submitDisabled || props.readonly) return
    emit('submit')
  }

  defineExpose({ submit })
</script>

<style scoped>
  .form-drawer__head {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .form-drawer__head h2 {
    margin: 0;
  }

  .form-drawer__desc {
    margin: 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .form-drawer__footer-extra {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-sm);
    min-width: 0;
  }

  .form-drawer__footer-extra:empty {
    display: none;
  }
</style>
