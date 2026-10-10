import { STORAGE_KEYS } from './storageKeys'

export const CONTENT_DENSITY_STORAGE_KEY = STORAGE_KEYS.contentDensity

export type ContentDensityMode = 'comfortable' | 'compact'

export function readStoredContentDensity(): ContentDensityMode {
  const v = localStorage.getItem(CONTENT_DENSITY_STORAGE_KEY)
  return v === 'compact' ? 'compact' : 'comfortable'
}

export function applyContentDensityToDocument(mode: ContentDensityMode) {
  document.documentElement.dataset.density = mode
}
