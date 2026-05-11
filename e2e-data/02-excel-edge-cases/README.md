# 02 — Excel 边界用例

测 Excel 导入器的错误回显与韧性。**待补**:从 ta 包改坏 3 份。

## 计划文件

| 文件 | 错在哪 | 期望 FE 行为 |
|---|---|---|
| `bad-missing-required-col.xlsx` | jobCode 列缺失 | 预览时整 sheet 报"缺必填列",阻断 |
| `bad-invalid-enum.xlsx` | executionMode 写成 `INCR`(非合法 enum) | 行级红字,展示 BE 错误 + 行号 |
| `bad-too-large.xlsx` | 5000+ 行 | 上传成功但提示"超大文件,建议拆分";导入分批 |
| `alert-routings-quick-import.xlsx` | 5 条合法路由 | POST `/config/alert-routings/excel/quick-import` 200 |

## 怎么生成
```bash
# (TBD) 写脚本基于 ta 包派生:
# - 删 jobCode 列
# - 把第 3 行 executionMode 改 INCR
# - 复制行扩到 5500
```

## FE 触发路径
**配置管理 → Excel 维护** (`/config/excel/job-definitions` 等)
