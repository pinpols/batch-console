export interface ProgressStreamHandlers<T> {
  snapshot: (data: T) => void
  ready: () => void
  error: () => void
  reset: () => void
}
