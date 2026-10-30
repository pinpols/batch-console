# 租户配置包输入

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [`ta-tenant-config-package-test.xlsx`](./ta-tenant-config-package-test.xlsx)
- [`tb-tenant-config-package-test.xlsx`](./tb-tenant-config-package-test.xlsx)
- [`tc-tenant-config-package-test.xlsx`](./tc-tenant-config-package-test.xlsx)

## 当前入口与适用性

这些是仓库保留的配置包文件，不是自动同步的后端模板。权威来源见[配对后端测试数据](../../../file-batch-system/test-data/README.md)及模板 Schema；接口消费见 [`src/api/tenantPackageExcel.ts`](../../src/api/tenantPackageExcel.ts)。[`upload-full-chain.spec.ts`](../../e2e/upload-full-chain.spec.ts)保留了后端样本候选与本目录回退；实际选择以运行时找到的文件为准；mock 与真实后端模式的证据范围不同。

更新样本时先确认当前 sheet、必填列、枚举与前后端导入契约；文件能被 Excel 打开不能证明可成功导入。
