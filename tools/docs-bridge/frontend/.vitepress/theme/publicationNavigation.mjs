/** 只允许原记录跳到同目录、同基名的生成分卷，拒绝任意URL或路径穿越。 */
export function publicationRedirect(redirects, pathname, hash, search = '') {
  if (!Array.isArray(redirects) || !hash) return null
  let anchor
  try {
    anchor = decodeURIComponent(hash.slice(1))
  } catch {
    return null
  }
  const name = pathname
    .split('/')
    .at(-1)
    ?.replace(/\.html$/, '')
  if (!name) return null
  const entry = redirects.find((item) => Array.isArray(item) && item[0] === anchor)
  const target = entry?.[1]
  if (
    typeof target !== 'string' ||
    !/^[\w.-]+\.part-\d{3}$/.test(target) ||
    !target.startsWith(`${name}.part-`)
  )
    return null
  return `./${target}${search}${hash}`
}
