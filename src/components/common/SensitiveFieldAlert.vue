<template>
  <el-alert
    v-if="hits.length > 0"
    type="warning"
    :closable="false"
    show-icon
    class="sensitive-field-alert"
    :class="{ 'sensitive-field-alert--inline': inline }"
    :title="t('sensitiveFieldAlert.title', { n: hits.length })"
  >
    <template #default>
      <div class="sensitive-field-alert__body">
        <div class="sensitive-field-alert__hint">{{ t('sensitiveFieldAlert.hint') }}</div>
        <ul class="sensitive-field-alert__list">
          <li v-for="path in hits" :key="path">
            <code>{{ path }}</code>
          </li>
        </ul>
      </div>
    </template>
  </el-alert>
  <slot v-else name="empty" />
</template>

<script setup lang="ts">
  /**
   * Lane G — 凭据字段警示组件。
   *
   * 实时扫描 v-model 数据(对象 / JSON 字符串均吞),命中 BE `SensitiveDataValidator`
   * 关键字时显示警告并列出所有命中路径,提示用户改走环境变量。
   *
   * 0 命中时不渲染主体;调用方可用 `#empty` 插槽自定义空态。
   *
   * 关键字与 BE 同步:见 `src/utils/sensitiveKeys.ts` 注释。
   */
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElAlert } from 'element-plus'
  import { detectSensitiveKeys } from '@/utils/sensitiveKeys'

  const props = withDefaults(
    defineProps<{
      /** 待扫描的数据(对象 / JSON 字符串)。 */
      value: Record<string, unknown> | string | null | undefined
      /** 内联紧凑展示(高度更小,适合表单顶部)。 */
      inline?: boolean
      /**
       * 跳过的路径前缀;与 BE 豁免对齐,例如 HTTP executor 的 `auth.*`(协议字段)。
       */
      exemptPaths?: string[]
    }>(),
    {
      inline: false,
      exemptPaths: () => [],
    }
  )

  const { t } = useI18n({ useScope: 'global' })

  const hits = computed(() =>
    detectSensitiveKeys(props.value, { exemptPaths: props.exemptPaths })
  )
</script>

<style scoped>
  .sensitive-field-alert {
    margin-bottom: var(--space-sm, 12px);
  }

  .sensitive-field-alert--inline {
    margin-bottom: 8px;
    font-size: 12px;
  }

  .sensitive-field-alert__body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sensitive-field-alert__hint {
    line-height: 1.5;
  }

  .sensitive-field-alert__list {
    margin: 0;
    padding-left: 18px;
    list-style: disc;
  }

  .sensitive-field-alert__list code {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
    font-size: 12px;
    padding: 1px 6px;
    background: rgb(255 255 255 / 60%);
    border-radius: 4px;
  }
</style>
