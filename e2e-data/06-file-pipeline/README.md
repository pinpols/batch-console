# 文件流输入

本页是保留输入与当前测试入口的目录说明。执行范围与准备/清理规则见[本目录总览](../README.md)和[执行说明](../EXEC-MATRIX.md)。

## 保留资产

- [`samples/sample-orders.csv`](./samples/sample-orders.csv)：普通 CSV 样本。
- [`samples/sample-empty.csv`](./samples/sample-empty.csv)：空文件样本。
- [`samples/sample-invalid-encoding.csv`](./samples/sample-invalid-encoding.csv)：无效编码场景的 UTF-16 样本。
- [`payloads/file-redispatch.json`](./payloads/file-redispatch.json)、[`file-archive.json`](./payloads/file-archive.json)、[`arrival-group-action.json`](./payloads/arrival-group-action.json)：历史文件操作请求样本。

## 当前入口与适用性

文件操作消费方见 [`src/api/file.ts`](../../src/api/file.ts)，场景见 [`file-ops.spec.ts`](../../e2e/file-ops.spec.ts)。运行目标、文件到达组、上传与处理状态需要按当前后端契约准备。

空文件或编码错误是否允许上传、在哪里报错以及返回内容，以当前模板、后端与本轮用例断言为准。文件 Pipeline 是系统运行观测，不能从旧请求样本推导租户 Pipeline 定义 CRUD。
