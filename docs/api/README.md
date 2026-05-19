# API Documentation

API 文档的唯一源在后端仓库：

- 协议文档：`file-batch-system/docs/api/console-api-protocol.md`
- OpenAPI 规范：`file-batch-system/docs/api/console-api.openapi.yaml`

请勿在此目录维护副本，以避免前后端文档不一致。

## 联调检查顺序

1. 后端新增或修改 Console Controller 后，先在后端仓库运行：

   ```bash
   python3 scripts/ci/check-console-openapi-paths.py
   ```

2. 后端 OpenAPI 通过后，前端再运行：

   ```bash
   npm run gen:api
   npm run gen:api:check
   ```

3. `npm run gen:api:check` 只检查 `src/types/api.generated.ts` 是否与当前 YAML 同步；它不能发现“Controller 已新增但 YAML 漏写”的问题。

## 当前重点

最新前后端契约扫描记录见 [2026-05-19 前后端文档整理与深扫报告](../reports/2026-05-19-前后端文档整理与深扫报告.md)。
