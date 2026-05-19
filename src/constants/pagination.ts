/**
 * 表格分页全局默认。
 *
 * - DEFAULT_PAGE_SIZE: 列表首次加载与各业务页面 `pageSize = ref(...)` 的默认值。
 * - DEFAULT_PAGE_SIZES: el-pagination `page-sizes` 下拉选项,首项与 DEFAULT_PAGE_SIZE 一致。
 *
 * 个别页面(详情内嵌小表、移动端 segmented 列表)可以覆盖,但不要再硬编码 20/50,
 * 统一从这里 import,避免「默认 N 一页」改动时漏点。
 */
export const DEFAULT_PAGE_SIZE = 15
export const DEFAULT_PAGE_SIZES: readonly number[] = [15, 30, 50, 100]
