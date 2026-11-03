<template>
  <section class="form-block" :class="[`form-block--${layout}`]">
    <header v-if="title || $slots.header" class="form-block__head">
      <slot name="header">
        <h3>{{ title }}</h3>
        <p v-if="description">{{ description }}</p>
      </slot>
    </header>
    <div class="form-block__body" :class="{ 'form-block__body--pair': columns === 2 }">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
  /**
   * 表单分节：标题 + 一句说明 + 字段区。
   * - stacked（默认）：抽屉、对话框内使用，标题在字段上方。
   * - side：整页设置表单使用，标题说明在左、字段在右（窄屏自动堆叠）。
   * 相邻分节之间自动加分隔线；columns=2 时字段两列排布，窄屏回落单列。
   */
  withDefaults(
    defineProps<{
      title?: string
      description?: string
      layout?: 'stacked' | 'side'
      columns?: 1 | 2
    }>(),
    { title: undefined, description: undefined, layout: 'stacked', columns: 1 },
  )
</script>

<style scoped>
  .form-block {
    min-width: 0;
  }

  .form-block + .form-block {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--color-border-light);
  }

  .form-block__head h3 {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .form-block__head p {
    margin: 4px 0 0;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.55;
  }

  .form-block--stacked .form-block__head {
    margin-bottom: 14px;
  }

  .form-block--side {
    display: grid;
    grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
    gap: 16px 40px;
  }

  .form-block--side .form-block__head h3 {
    font-size: var(--font-size-lg);
  }

  .form-block__body {
    min-width: 0;
  }

  /* 两列时每项按自身高度顶部对齐，避免同行另一项较高时控件被拉伸居中而错位 */
  .form-block__body--pair {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    column-gap: 20px;
  }

  /* 两列时整行字段（如说明、JSON）用 .form-block__full 占满 */
  .form-block__body--pair :deep(.form-block__full) {
    grid-column: 1 / -1;
  }

  .form-block__body :deep(.el-form-item:last-child) {
    margin-bottom: 0;
  }

  .form-block__body--pair :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  /* 只拉满字段的直接控件；组合控件（如编码生成器）内部的选择框保持自身宽度 */
  .form-block__body :deep(.el-form-item__content > .el-select),
  .form-block__body :deep(.el-form-item__content > .el-date-editor) {
    width: 100%;
  }

  @media (max-width: 960px) {
    .form-block--side {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 640px) {
    .form-block__body--pair {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
