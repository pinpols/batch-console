<template>
  <Teleport to="body">
    <Transition name="jdd-slide">
      <aside v-if="visible" class="jdd" role="dialog" :aria-label="headLabel">
        <!-- 头部:小 label + 状态 pill + ✕,下面 mono 大标题(dump: proto-jobs_edit.html OVERLAY) -->
        <div class="jdd__head">
          <div class="jdd__head-row">
            <span class="jdd__kind">{{ headLabel }}</span>
            <span v-if="pill" class="jdd__pill" :class="pill.on ? 'is-on' : 'is-off'">
              <span class="jdd__pill-dot" />
              {{ pill.text }}
            </span>
            <span class="jdd__spacer" />
            <button
              type="button"
              class="jdd__close"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              &#x2715;
            </button>
          </div>
          <div class="jdd__title">{{ title }}</div>
        </div>

        <!-- 滚动主体:各分区由父级 slot 提供 -->
        <div class="jdd__body">
          <slot />
        </div>

        <!-- 底部操作:查看态=关闭/导出/编辑;编辑/新建态=取消/保存 -->
        <div class="jdd__foot">
          <template v-if="mode === 'view'">
            <el-button @click="emit('close')">{{ t('common.close') }}</el-button>
            <span class="jdd__spacer" />
            <el-button :loading="exporting" @click="emit('export')">
              {{ t('jobDefinitionList.actionExportBundle') }}
            </el-button>
            <el-tooltip
              :content="canEdit ? t('jobDefinitionList.actionEdit') : t('common.permissionDenied')"
              placement="top"
            >
              <span>
                <el-button type="primary" :disabled="!canEdit" @click="emit('edit')">
                  {{ t('jobDefinitionList.actionEdit') }}
                </el-button>
              </span>
            </el-tooltip>
          </template>
          <template v-else>
            <el-button @click="emit('cancel')">{{ t('jobDefinitionList.drawerCancel') }}</el-button>
            <span class="jdd__spacer" />
            <el-button type="primary" :loading="saving" @click="emit('save')">
              {{ saveLabel }}
            </el-button>
          </template>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  /**
   * 作业定义右侧 560px 抽屉(三态:view / edit / create)。
   *
   * 纯 chrome 组件:头部 / 滚动主体 / 底部操作照
   * docs/redesign/proto-jobs_view.html|_edit.html|_create.html 的 OVERLAY dump;
   * 业务内容(字段分区 / 表单)由父级通过默认 slot 注入,
   * 关闭前的脏数据守卫由父级在 close / cancel 事件里做。
   */
  import { watch, onBeforeUnmount } from 'vue'
  import { useI18n } from 'vue-i18n'

  const props = defineProps<{
    visible: boolean
    mode: 'view' | 'edit' | 'create'
    /** 头部小 label(dump: 「作业定义」) */
    headLabel: string
    /** mono 大标题:view/edit = jobCode;create = 「新建 · 作业定义」 */
    title: string
    /** 状态 pill(启用/停用);create 态传 null 不显示 */
    pill?: { text: string; on: boolean } | null
    saving?: boolean
    exporting?: boolean
    canEdit?: boolean
    saveLabel?: string
  }>()

  const emit = defineEmits<{
    close: []
    cancel: []
    save: []
    edit: []
    export: []
  }>()

  const { t } = useI18n({ useScope: 'global' })

  // Esc 关闭(走父级 close → 脏数据守卫);仅抽屉可见时监听
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') emit('close')
  }
  watch(
    () => props.visible,
    (v) => {
      if (v) document.addEventListener('keydown', onKeydown)
      else document.removeEventListener('keydown', onKeydown)
    },
    { immediate: true },
  )
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
  /* ── 抽屉容器(dump: width 560px / max-width 92vw / bg-card / border-left / shadow-pop) ── */
  .jdd {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-popover);
    width: 560px;
    max-width: 92vw;
    background: var(--color-bg-card);
    border-left: 1px solid var(--color-border);
    box-shadow: var(--shadow-pop, 0 8px 24px rgba(0, 0, 0, 0.45));
    display: flex;
    flex-direction: column;
  }

  .jdd-slide-enter-active,
  .jdd-slide-leave-active {
    /* 更顺的减速缓动(ease-out-expo 系),滑入更有质感 */
    transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .jdd-slide-enter-from,
  .jdd-slide-leave-to {
    transform: translateX(100%);
  }

  /* ── 头部(dump: padding 20px 24px 16px / border-bottom) ── */
  .jdd__head {
    flex-shrink: 0;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .jdd__head-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .jdd__kind {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--color-text-tertiary);
    text-transform: uppercase;
  }

  .jdd__pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }

  .jdd__pill.is-on {
    color: var(--color-success);
    background: color-mix(in srgb, var(--color-success) 12%, transparent);
  }

  .jdd__pill.is-off {
    color: var(--color-text-tertiary);
    background: var(--color-bg-elevated);
  }

  .jdd__pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentcolor;
  }

  .jdd__spacer {
    flex: 1;
  }

  .jdd__close {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 16px;
  }

  .jdd__close:hover {
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }

  .jdd__title {
    margin-top: 10px;
    font-family: var(--font-mono);
    font-size: 17px;
    font-weight: 600;
    color: var(--color-text-primary);
    word-break: break-all;
  }

  /* ── 滚动主体(dump: padding 20px 24px 28px) ── */
  .jdd__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 24px 28px;
  }

  /* ── 底部操作(dump: padding 14px 24px / border-top / gap 8px) ── */
  .jdd__foot {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 24px;
    border-top: 1px solid var(--color-border);
  }

  .jdd__foot :deep(.el-button + .el-button) {
    margin-left: 0;
  }
</style>
