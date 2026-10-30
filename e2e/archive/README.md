# 历史 E2E 入口

这些文件保留原始代码供追溯，已于 2026-10-25 从当前入口退役，不运行，也不作为 Playwright 发现范围。

| 文件 | Git 来源 | 退役原因 |
|---|---|---|
| `build-role-storage-states-2026-05-18.cjs` | 初次加入 2026-05-18，`d660a45` | 四角色准备已由 `e2e/global-setup.cjs` 统一处理；独立重新登录 admin 会影响已有会话，并保留过时的 localStorage token 写入。 |
| `basic-test-2026-04-18.mjs` | 初次加入 2026-04-18，`dc0a335` | 旧示例混用 ESM 和 require，未匹配当前 `*.spec.ts` 发现规则；没有现行调用。 |

当前运行入口以 [测试指南](../../docs/testing/README.md)、根 `playwright.config.cjs`、`e2e/global-setup.cjs` 和 `e2e/global-teardown.cjs` 为准。当前账号准备和 storageState 不再由此目录生成。
