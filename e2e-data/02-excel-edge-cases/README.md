# Excel 异常输入

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [`bad-missing-required-col.xlsx`](./bad-missing-required-col.xlsx)：历史缺少 `job_code` 列输入。
- [`bad-invalid-enum.xlsx`](./bad-invalid-enum.xlsx)：历史非法 `schedule_type` 枚举输入。
- [`bad-too-large.xlsx`](./bad-too-large.xlsx)：历史大行数输入。

## 当前入口与适用性

这些历史工作簿都含已退役的租户 Pipeline sheet，当前上传会先因退役 sheet 被拒绝，不能用来验证缺列、枚举或大小错误的独立分支。当前 [`excel-import.spec.ts`](../../e2e/excel-import.spec.ts)与 [`import-business-ui.spec.ts`](../../e2e/import-business-ui.spec.ts)不使用这些文件；缺列、枚举和大小约束以当前后端模板与校验器为准，不把旧行数或生成器注释当作服务上限。

原始 [`generate.py`](../archive/02-excel-edge-cases/generate.py)已归档，仅用于追溯样本的派生方法。重新生成前先核对模板结构，不能直接覆盖本目录受版本控制的输入。
