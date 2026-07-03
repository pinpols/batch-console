import { computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Pipeline stage 行级进度 ETA 计算。
 *
 * 输入:
 *  - `processed` 已处理行数(null/undefined 视为 0)
 *  - `total` 总行数预估;未知 → null
 *  - `history` 最近心跳采样队列,按时间升序(`[{ ts: epochMs, processed }]`)
 *
 * 输出:
 *  - `etaSeconds`:剩余秒数;以下任一情况返回 null:
 *      1. 已完成(processed >= total)
 *      2. total 未知
 *      3. 采样窗口 < 60s(避免抖动)
 *      4. throughput <= 0(陷入停滞)
 *  - `etaText`:本地化展示文本;ETA 未知时返回 `common.etaUnknown` 占位
 *      已完成态直接返「—」(由调用方决定;此处仍返「—」)
 *
 * 设计书:`file-batch-system/docs/design/pipeline-stage-progress-display.md`(file-batch-system 仓)
 */

export interface ProgressSample {
  ts: number
  processed: number
}

const MIN_WINDOW_MS = 60_000

export interface UseProgressEtaResult {
  etaSeconds: Ref<number | null>
  etaText: Ref<string>
}

export function useProgressEta(
  processed: Ref<number | null | undefined>,
  total: Ref<number | null | undefined>,
  history: Ref<ProgressSample[]>,
): UseProgressEtaResult {
  const { t } = useI18n({ useScope: 'global' })

  const etaSeconds = computed<number | null>(() => {
    const done = processed.value ?? 0
    const target = total.value
    if (target == null || target <= 0) return null
    if (done >= target) return null

    const samples = history.value
    if (!samples || samples.length < 2) return null

    const first = samples[0]
    const last = samples[samples.length - 1]
    const windowMs = last.ts - first.ts
    if (windowMs < MIN_WINDOW_MS) return null

    const delta = last.processed - first.processed
    if (delta <= 0) return null

    const ratePerMs = delta / windowMs
    if (ratePerMs <= 0) return null

    const remaining = target - done
    const remainingMs = remaining / ratePerMs
    return Math.max(1, Math.round(remainingMs / 1000))
  })

  const etaText = computed<string>(() => {
    const sec = etaSeconds.value
    if (sec == null) return t('common.etaUnknown')
    const minutes = Math.max(1, Math.round(sec / 60))
    return t('common.etaPattern', { minutes })
  })

  return { etaSeconds, etaText }
}
