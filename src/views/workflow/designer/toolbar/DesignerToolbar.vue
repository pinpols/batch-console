<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import {
    ArrowLeft,
    RotateCcw as RefreshLeft,
    RotateCw as RefreshRight,
    ArrowUpDown as Rank,
    ArrowUpDown as Sort,
    Sparkles as MagicStick,
    Files,
    MoreHorizontal as More,
    Share2 as Share,
    FileText as Document,
    CircleCheck,
    Check as Select,
  } from 'lucide-vue-next'
  import { useDesignerStore } from '../store/useDesignerStore'
  import ShortcutHelpButton from './ShortcutHelpButton.vue'
  import NodeSearchBox from './NodeSearchBox.vue'

  const { t } = useI18n()
  const router = useRouter()
  const store = useDesignerStore()

  // 设计器是全屏路由(无侧边栏),需显式返回入口;回工作流定义列表
  function goBack() {
    void router.push('/workflow/definitions')
  }

  const props = withDefaults(
    defineProps<{
      saving?: boolean
      canSave?: boolean
      /** dagre 布局方向(Polish 阶段:可在 TB/LR 切换);默认 TB 维持向后兼容 */
      layoutDirection?: 'TB' | 'LR'
      /** JSON 同步面板当前展开状态(用于 button aria-pressed),默认折叠 */
      jsonPanelOpen?: boolean
    }>(),
    { saving: false, canSave: true, layoutDirection: 'TB', jsonPanelOpen: false },
  )

  const emit = defineEmits<{
    (e: 'autoLayout'): void
    (e: 'validate'): void
    (e: 'save'): void
    (e: 'exportMermaid'): void
    (e: 'openQuickPalette'): void
    (e: 'openTemplateLibrary'): void
    (e: 'toggleLayoutDirection'): void
    (e: 'toggleJson'): void
    (e: 'focusNode', nodeId: string): void
  }>()

  function onMoreCommand(command: string) {
    if (command === 'templates') emit('openTemplateLibrary')
    if (command === 'mermaid') emit('exportMermaid')
    if (command === 'json') emit('toggleJson')
  }

  // 保存按钮在有未保存变更时更醒目(danger pill 语义 = "需要保存")
  const saveButtonType = computed<'primary' | 'danger'>(() =>
    store.dirty && props.canSave ? 'danger' : 'primary',
  )
</script>

<template>
  <div
    class="designer-toolbar"
    role="toolbar"
    :aria-label="t('workflowDesignerSpike.toolbarAriaLabel')"
  >
    <!-- 分组:返回 -->
    <div class="designer-toolbar__group">
      <el-button :icon="ArrowLeft" :title="t('common.backToList')" @click="goBack">
        <span class="designer-toolbar__btn-text">{{ t('common.backToList') }}</span>
      </el-button>
    </div>

    <el-divider direction="vertical" />

    <!-- 分组:编辑(undo / redo) -->
    <div class="designer-toolbar__group">
      <el-button-group>
        <el-button
          :icon="RefreshLeft"
          :disabled="!store.canUndo"
          :title="t('workflowDesignerSpike.actionUndo')"
          @click="store.undo()"
        >
          <span class="designer-toolbar__btn-text">{{
            t('workflowDesignerSpike.actionUndo')
          }}</span>
        </el-button>
        <el-button
          :icon="RefreshRight"
          :disabled="!store.canRedo"
          :title="t('workflowDesignerSpike.actionRedo')"
          @click="store.redo()"
        >
          <span class="designer-toolbar__btn-text">{{
            t('workflowDesignerSpike.actionRedo')
          }}</span>
        </el-button>
      </el-button-group>
    </div>

    <el-divider direction="vertical" />

    <!-- 分组:布局(auto-layout / layout-direction) -->
    <div class="designer-toolbar__group">
      <el-button-group>
        <el-button
          :icon="Rank"
          :title="t('workflowDesignerSpike.actionAutoLayout')"
          @click="$emit('autoLayout')"
        >
          <span class="designer-toolbar__btn-text">{{
            t('workflowDesignerSpike.actionAutoLayout')
          }}</span>
        </el-button>
        <el-button
          :icon="Sort"
          :title="t('workflowDesignerPolish.actionLayoutDirection', { dir: layoutDirection })"
          @click="$emit('toggleLayoutDirection')"
        >
          <span class="designer-toolbar__btn-text">{{
            t('workflowDesignerPolish.actionLayoutDirection', { dir: layoutDirection })
          }}</span>
        </el-button>
      </el-button-group>
    </div>

    <el-divider direction="vertical" />

    <!-- 分组:视图。快捷添加保留直显，低频工具收进菜单减少工具栏拥挤。 -->
    <div class="designer-toolbar__group">
      <el-button
        :icon="MagicStick"
        :title="t('workflowDesignerPolish.actionQuickPalette')"
        @click="$emit('openQuickPalette')"
      >
        <span class="designer-toolbar__btn-text">{{
          t('workflowDesignerPolish.actionQuickPalette')
        }}</span>
      </el-button>
      <el-dropdown trigger="click" @command="onMoreCommand">
        <el-button :icon="More" :title="t('common.more')">
          <span class="designer-toolbar__btn-text">{{ t('common.more') }}</span>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="templates">
              <el-icon><Files /></el-icon>
              {{ t('workflowDesignerPolish.actionTemplates') }}
            </el-dropdown-item>
            <el-dropdown-item command="mermaid">
              <el-icon><Share /></el-icon>
              {{ t('workflowDesignerSpike.actionMermaid') }}
            </el-dropdown-item>
            <el-dropdown-item command="json">
              <el-icon><Document /></el-icon>
              {{ t('workflowDesignerJson.toolbarButton') }}
              <span v-if="jsonPanelOpen" class="designer-toolbar__menu-state">●</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <el-divider direction="vertical" />

    <!-- 分组:校验保存(validate / save) -->
    <div class="designer-toolbar__group">
      <el-button
        :icon="CircleCheck"
        :title="t('workflowDesignerMvp.actionValidate')"
        @click="$emit('validate')"
      >
        <span class="designer-toolbar__btn-text">{{
          t('workflowDesignerMvp.actionValidate')
        }}</span>
      </el-button>
      <el-button
        class="designer-toolbar__save-btn"
        :type="saveButtonType"
        :icon="Select"
        :loading="saving"
        :disabled="!canSave"
        :title="t('workflowDesignerSpike.actionSave')"
        @click="$emit('save')"
      >
        <span class="designer-toolbar__btn-text">{{ t('workflowDesignerSpike.actionSave') }}</span>
      </el-button>
    </div>

    <div class="designer-toolbar__spacer" />

    <el-tag v-if="store.dirty" type="warning" size="small">
      {{ t('workflowDesignerSpike.dirtyTag') }}
    </el-tag>
    <NodeSearchBox class="designer-toolbar__search" @focus="$emit('focusNode', $event)" />
    <ShortcutHelpButton class="designer-toolbar__help" />
  </div>
</template>

<style scoped>
  .designer-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-overlay, #fff);
    min-width: 0;
  }
  .designer-toolbar__group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .designer-toolbar__spacer {
    flex: 1 1 auto;
    min-width: 0;
  }
  .designer-toolbar__search {
    min-width: 0;
    max-width: 220px;
  }
  .designer-toolbar__menu-state {
    margin-left: 8px;
    color: var(--el-color-primary);
    font-size: 10px;
  }
  /* 保存按钮最突出:更大触达 + dirty 时 danger pill 提醒 */
  .designer-toolbar__save-btn {
    font-weight: 600;
  }
  /* 窄屏:工具栏换行,文字按钮折叠为纯 icon(title/tooltip 兜底语义) */
  @media (max-width: 1024px) {
    .designer-toolbar {
      flex-wrap: wrap;
      row-gap: 8px;
    }
    .designer-toolbar__btn-text {
      display: none;
    }
    .designer-toolbar__spacer {
      flex-basis: 100%;
      height: 0;
    }
    .designer-toolbar__search {
      flex: 1 1 180px;
      max-width: none;
    }
  }
</style>
