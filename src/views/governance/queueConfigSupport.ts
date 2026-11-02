export function optionalText(value: string) {
  const text = value.trim()
  return text ? text : undefined
}

export function clampPage(pageRef: { value: number }, total: number, size: number) {
  const roundedPageCount = Math.ceil(total / size)
  const pageCount = roundedPageCount || 1
  const max = Math.max(1, pageCount)
  if (pageRef.value > max) pageRef.value = max
}
