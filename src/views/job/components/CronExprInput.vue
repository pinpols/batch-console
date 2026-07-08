<template>
  <div class="cron-expr-input">
    <el-input
      :model-value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @update:model-value="onInput"
    />

    <div class="cron-help">
      <!-- 5 个工程常用 preset,一键填入 -->
      <div class="cron-preset-row">
        <span class="cron-preset-label">{{ t('cronExprInput.presetLabel') }}</span>
        <el-button
          v-for="preset in PRESETS"
          :key="preset.expr"
          size="small"
          link
          type="primary"
          :disabled="disabled"
          @click="emit('update:modelValue', preset.expr)"
        >
          {{ preset.label }}
        </el-button>
      </div>

      <!-- 实时解析:cronstrue 翻描述 + BE Quartz 算下次执行 -->
      <div v-if="!modelValue?.trim()" class="cron-empty-hint">
        {{ t('cronExprInput.emptyHintPrefix') }}<code>0 0 2 * * ?</code
        >{{ t('cronExprInput.emptyHintSuffix') }}
      </div>
      <template v-else>
        <div v-if="desc" class="cron-desc">
          <el-icon><Check /></el-icon>
          <span>{{ desc }}</span>
        </div>

        <div v-if="previewError" class="cron-error">
          <el-icon><Warning /></el-icon>
          {{ previewError }}
        </div>
        <div v-else-if="previewLoading" class="cron-next">
          <span class="cron-next__label">{{ t('cronExprInput.previewLoading') }}</span>
        </div>
        <div v-else-if="nextRuns.length" class="cron-next">
          <span class="cron-next__label">{{
            t('cronExprInput.nextRunsLabel', { tz: previewTz || t('cronExprInput.tzLocal') })
          }}</span>
          <span class="cron-next__list">
            <span v-for="(t, i) in nextRuns" :key="i" class="cron-next__time">
              {{ formatNext(t) }}
            </span>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  /**
   * Cron 表达式友好输入框 — 公共子组件。
   *
   * 改造(2026-05-19):
   *   - 描述:cronstrue 库,支持完整 Quartz 语法(? / L / W / # / 范围 / 列表)+ i18n
   *   - 下次执行:BE GET /api/console/system/cron-preview,用 Quartz CronExpression
   *     与真实调度同一份代码,时间精确不漂
   *   - 干掉之前 200+ 行自实现解析器
   *
   * 公开 props/emits 与 el-input 类似,可直接 v-model 双向绑定。
   */
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { Check, TriangleAlert as Warning } from 'lucide-vue-next'
  import cronstrue from 'cronstrue/i18n'
  // @ts-ignore — cronstrue/i18n 子包没有显式 type 声明,运行时存在
  import 'cronstrue/locales/zh_CN'
  import { previewCron } from '@/api/system.cron'

  const { t } = useI18n({ useScope: 'global' })

  const props = withDefaults(
    defineProps<{
      modelValue?: string
      placeholder?: string
      disabled?: boolean
    }>(),
    { modelValue: '', placeholder: '例:0 0 2 * * ?  (每天 02:00)', disabled: false },
  )
  const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

  function onInput(v: string | number | null | undefined) {
    emit('update:modelValue', String(v ?? ''))
  }

  const PRESETS = [
    { label: '每天 02:00', expr: '0 0 2 * * ?' },
    { label: '每小时', expr: '0 0 * * * ?' },
    { label: '每 15 分', expr: '0 */15 * * * ?' },
    { label: '每周一 02:00', expr: '0 0 2 ? * MON' },
    { label: '每月 1 号 02:00', expr: '0 0 2 1 * ?' },
  ] as const

  // ── 描述:cronstrue(中文)。失败兜底英文 / 原表达式 ───────────
  const desc = computed(() => {
    const expr = props.modelValue?.trim()
    if (!expr) return ''
    try {
      return cronstrue.toString(expr, { locale: 'zh_CN', use24HourTimeFormat: true })
    } catch {
      try {
        return cronstrue.toString(expr, { use24HourTimeFormat: true })
      } catch {
        return ''
      }
    }
  })

  // ── 下次执行:BE 防抖调用 ────────────────────────────────
  const nextRuns = ref<Date[]>([])
  const previewTz = ref<string | null>(null)
  const previewError = ref('')
  const previewLoading = ref(false)
  let previewTimer: ReturnType<typeof setTimeout> | null = null
  let previewSeq = 0

  watch(
    () => props.modelValue,
    (expr) => {
      if (previewTimer) clearTimeout(previewTimer)
      const trimmed = expr?.trim() ?? ''
      if (!trimmed) {
        nextRuns.value = []
        previewError.value = ''
        previewLoading.value = false
        return
      }
      previewTimer = setTimeout(() => {
        const seq = ++previewSeq
        previewLoading.value = true
        previewCron(trimmed, 3)
          .then((res) => {
            if (seq !== previewSeq) return // 中途又输入,丢弃过时响应
            if (!res.valid) {
              nextRuns.value = []
              previewError.value = res.error || '解析失败'
              previewTz.value = null
            } else {
              nextRuns.value = res.nextRuns.map((s) => new Date(s))
              previewError.value = ''
              previewTz.value = res.timezone
            }
          })
          .catch(() => {
            // 网络错误时不阻塞描述,只是预览缺失;BE 维护期返 503 由全局 banner 提示
            if (seq !== previewSeq) return
            nextRuns.value = []
            previewError.value = ''
          })
          .finally(() => {
            if (seq === previewSeq) previewLoading.value = false
          })
      }, 300)
    },
    { immediate: true },
  )

  function formatNext(d: Date): string {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const HH = String(d.getHours()).padStart(2, '0')
    const MM = String(d.getMinutes()).padStart(2, '0')
    const SS = String(d.getSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`
  }
</script>

<style scoped>
  .cron-expr-input {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .cron-help {
    font-size: 12px;
    color: var(--color-text-secondary);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cron-preset-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 8px;
  }
  .cron-preset-label {
    color: var(--color-text-tertiary);
  }

  .cron-empty-hint {
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }
  .cron-empty-hint code {
    background: var(--color-bg-page);
    padding: 0 4px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, monospace;
  }

  .cron-error {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-danger);
  }

  .cron-desc {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-success);
  }
  .cron-next {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    color: var(--color-text-tertiary);
  }
  .cron-next__label {
    flex-shrink: 0;
  }
  .cron-next__time {
    background: var(--color-bg-page);
    padding: 0 6px;
    border-radius: 3px;
    font-family: 'SF Mono', Monaco, monospace;
  }
</style>
