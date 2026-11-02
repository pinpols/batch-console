# 租户配置包输入

本页说明前端仓库保存的租户配置包测试快照。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [`ta-tenant-config-package-test.xlsx`](./ta-tenant-config-package-test.xlsx)
- [`tb-tenant-config-package-test.xlsx`](./tb-tenant-config-package-test.xlsx)
- [`tc-tenant-config-package-test.xlsx`](./tc-tenant-config-package-test.xlsx)

## 来源与同步

这三份文件是[后端测试包](../../../file-batch-system/test-data/tenant-config-packages/README.md)中同名文件的逐字节快照，更新后端样本时应同时复制并核对 SHA-256；它们不会自动同步。当前快照包含 10 个数据 sheet，不含已退役的租户 Pipeline sheet。[`upload-full-chain.spec.ts`](../../e2e/upload-full-chain.spec.ts)优先使用后端 ta 样本，后端仓库不可用时回退到本目录的 ta 快照。

更新后运行 `PYTHONDONTWRITEBYTECODE=1 python3 e2e-data/01-tenant-config-import/test_tenant_package_fixtures.py`：独立检查三份文件的 sheet 契约；配对后端目录存在时额外比对三份文件的 SHA-256，不存在时该比对明确跳过。后端还应运行其 `scripts/sim/fix-fixture-xlsx.py --check`。接口消费见 [`src/api/tenantPackageExcel.ts`](../../src/api/tenantPackageExcel.ts)。

快照包含平台资源字段和测试环境端点，完整包应用需要平台管理员并核对目标租户及环境依赖。静态检查和 mock 不能证明真实上传、预览、应用或业务执行成功；真实导入必须另行在授权环境验证。
