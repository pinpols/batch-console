# 01 — 租户配置整包导入

## 测的接口
- POST `/api/console/config/tenant-package/excel/upload` —— 整包导入向导
- POST `/api/console/config/tenant-init` —— 初始化新租户
- POST `/api/console/config/tenant-copy` —— 跨租户复制

## 文件
- `ta-tenant-config-package-test.xlsx` → 给 ta 用
- `tb-tenant-config-package-test.xlsx` → 给 tb 用
- `tc-tenant-config-package-test.xlsx` → 给 tc 用

**来源**:原文件维护在 `file-batch-system/docs/test-data/test-full-coverage-import-suite/`。
本目录是**实文件副本**(纳入 batch-console git),如 BE 仓库修改 Excel,需手动同步:
```bash
SRC=../file-batch-system/docs/test-data/test-full-coverage-import-suite
cp $SRC/{ta,tb,tc}-tenant-config-package-test.xlsx \
   batch-console/e2e-data/01-tenant-config-import/
```

## FE 触发路径
**配置管理 → 配置批量导入** (`/config/tenant-package`)

## 验证点
- 上传 → 预览 → 确认 三步流程
- 各 sheet(JobDef/Queue/Calendar/FileTpl 等)逐项 ✓ / ✗ 显示
- 部分失败时仍能继续(事务边界正确)
- 导入后到对应列表页能看到数据
