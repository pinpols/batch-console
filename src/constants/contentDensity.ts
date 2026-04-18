/** 与 `src/stores/app.ts` 使用同一存储键，避免漂移 */
export const CONTENT_DENSITY_STORAGE_KEY = 'batch-console:content-density'

export type ContentDensityMode = 'comfortable' | 'compact'

export function readStoredContentDensity(): ContentDensityMode {
  const v = localStorage.getItem(CONTENT_DENSITY_STORAGE_KEY)
  return v === 'compact' ? 'compact' : 'comfortable'
}

export function applyContentDensityToDocument(mode: ContentDensityMode) {
  document.documentElement.dataset.density = mode
}
