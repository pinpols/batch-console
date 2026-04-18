import type { CommonMeta } from '@/types'

/** 最近一次成功 JSON 信封中的 meta（供排障展示；blob 请求不更新） */
export const lastApiMeta: { value: CommonMeta | null } = { value: null }

export function setLastApiMeta(meta: CommonMeta | undefined | null) {
  lastApiMeta.value = meta ?? null
}
