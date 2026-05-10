<template>
  <div class="row-actions">
    <!-- 主操作:第 1 个 primary action 直显 -->
    <el-button
      v-for="a in primaryActions"
      :key="a.key"
      size="small"
      :type="a.danger ? 'danger' : 'primary'"
      :plain="!a.solid"
      :loading="!!a.loading"
      :disabled="!!a.disabled"
      @click.stop="trigger(a)"
    >
      {{ a.label }}
    </el-button>

    <!-- 次操作折叠到"更多"dropdown -->
    <el-dropdown v-if="moreActions.length" trigger="click" @command="onCommand">
      <el-button size="small" plain class="row-actions__more">
        更多
        <el-icon class="row-actions__caret"><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="a in moreActions"
            :key="a.key"
            :command="a.key"
            :disabled="!!a.disabled"
            :divided="!!a.divided"
            :class="{ 'row-actions__danger-item': a.danger }"
          >
            <el-icon v-if="a.icon" class="row-actions__item-icon"
              ><component :is="a.icon"
            /></el-icon>
            {{ a.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { Component } from 'vue'
  import { ArrowDown } from '@element-plus/icons-vue'

  /**
   * 行操作的统一抽象。一个 primary 主按钮 + N 个次操作折进"更多"下拉。
   * 解决"一行 6 个 plain 按钮挤一起、没主次"的体检痛点。
   *
   * 用法:
   *   <RowActions
   *     :actions="[
   *       { key: 'detail', label: '详情', primary: true, onClick: () => view(row) },
   *       { key: 'edit', label: '编辑', onClick: () => edit(row) },
   *       { key: 'toggle', label: row.enabled ? '停用' : '启用', onClick: () => toggle(row) },
   *       { key: 'delete', label: '删除', danger: true, divided: true, onClick: () => del(row) },
   *     ]"
   *   />
   *
   * 规则:
   * - 标 primary: true 的会成为主按钮(直显);多个 primary 都直显
   * - 没 primary 的:第一个非 danger / 非 disabled 的当主按钮
   * - 其余进 dropdown,danger 项加红色 + 可加 divided 隔开
   * - 全部 disabled 时不渲染主按钮(避免假可点)
   */

  export interface RowAction {
    /** 唯一 key,用于 dropdown command */
    key: string
    /** 显示文字 */
    label: string
    /** 标记为主操作(直显) */
    primary?: boolean
    /** 危险操作(主按钮变红 / 下拉项变红) */
    danger?: boolean
    /** 主按钮 plain → solid */
    solid?: boolean
    /** 禁用 */
    disabled?: boolean
    /** loading 态(只在主按钮位置有效) */
    loading?: boolean
    /** dropdown 项前的图标 */
    icon?: Component
    /** dropdown 项前画一条分隔线(典型:把 danger 项隔出来) */
    divided?: boolean
    /** 点击回调 */
    onClick: () => void | Promise<void>
  }

  const props = defineProps<{ actions: RowAction[] }>()

  const visibleActions = computed(() => props.actions.filter(Boolean))

  const primaryActions = computed(() => {
    const explicit = visibleActions.value.filter((a) => a.primary)
    if (explicit.length) return explicit
    // 没显式 primary:挑第一个非 danger / 非 disabled 当主
    const first = visibleActions.value.find((a) => !a.danger && !a.disabled)
    return first ? [first] : []
  })

  const moreActions = computed(() => {
    const primaryKeys = new Set(primaryActions.value.map((a) => a.key))
    return visibleActions.value.filter((a) => !primaryKeys.has(a.key))
  })

  function trigger(a: RowAction) {
    if (a.disabled) return
    void a.onClick()
  }

  function onCommand(key: string) {
    const a = visibleActions.value.find((x) => x.key === key)
    if (a) trigger(a)
  }
</script>

<style scoped>
  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .row-actions__more {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .row-actions__caret {
    font-size: 11px;
  }

  .row-actions__item-icon {
    margin-right: 4px;
    vertical-align: -2px;
  }

  :global(.row-actions__danger-item) {
    color: var(--el-color-danger) !important;
  }

  :global(.row-actions__danger-item:hover) {
    background: color-mix(in srgb, var(--el-color-danger) 12%, transparent) !important;
  }
</style>
