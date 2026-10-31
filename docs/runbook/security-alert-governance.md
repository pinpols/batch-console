# GitHub 安全告警治理

面向开发、代码审查、运维与发布负责人。GitHub Security 页的 Code scanning、Dependabot 与 Secret scanning 分开处理;本手册明确修复与关闭依据,不以一次扫描替代上线验收。

## 处理顺序

1. 查询仓库、默认分支、扫描提交和具体告警编号,记录规则、等级、输入来源与危险调用。
2. 先验证真实可达性和现有防护,区分真实缺陷、已有防护的误报与尚缺证据。共享修复先检查直接调用方及正常路径。
3. 在短期分支修复,保留用户改动。同步代码、回归测试及受影响文档;跨 API/权限契约时与后端一起核对。
4. 运行对应本地检查并提交 PR,记录成功、失败、跳过和未执行项。检查 PR CodeQL 分析结果与告警实例,不能只看绿色 workflow。
5. 用户合并后核对 `main` 的扫描提交确实包含修复,再查询开放告警。修复被合并且该实例关闭后才写“已收尾”。

## 前端修复边界

| 问题 | 处理原则 | 验证重点 |
| --- | --- | --- |
| 不可信 HTML / DOM 写入 | 复用 `v-safe-html`、`purifyHtml`;不移除净化 | 恶意输入被过滤,正常格式保留 |
| URL / 跳转 / 外部资源 | 检查协议、来源和路由边界,沿用现有校验工具 | 非法协议与绕过形式被拒绝,合法深链可用 |
| 权限 / 认证 | 使用现有权限模型与 HttpOnly Cookie,后端负责最终授权 | 四角色、跨租户、未登录与正常业务路径 |
| 日志 / 错误提示 | 不暴露凭据、附件内容或敏感响应;保留必要关联信息 | 用户提示可读,诊断信息可追溯 |
| 依赖漏洞 | 核对锁文件、实际使用方式、运行时可达性和修复版本 | 兼容性、构建、审计与现有 SBOM/许可门禁 |
| Secret scanning | 撤销真实泄露凭据并更换配置,删字符串不能完成补救 | 凭据失效与新配置生效,不在报告中复述密钥 |

生成代码与构建产物使用现有扫描排除规则,不得为了清零排除手写业务代码。纯文档告警也应检查示例是否会被复制执行。

## 误报与例外

- 误报必须有输入到危险调用的实际路径、既有防护和定向验证。只因难修或测试通过不能判误报。
- 对具体告警使用 `false positive` 并写明依据;接受风险使用 `won't fix` 且说明负责人、影响和后续处理,不能混淆两者。
- 不批量关闭告警、不删除鉴权/校验、不降低扫描规则、不通过更换函数名隐藏数据流。
- 防护、依赖、调用路径或规则变化后重新核查原判断;例外不代表永久豁免。

## 告警关闭语义

- `fixed` 表示默认分支的后续完整扫描不再报告该实例，可能来自代码修复、依赖更新或明确的非产品资产范围排除；必须结合提交和扫描配置判断，不能一律写成“代码已修复”。
- `dismissed` 才表示人工按 `false positive`、`won't fix` 或 `used in tests` 关闭，必须记录理由和操作者。
- 截至 2026-10-07 的 9 条关闭 CodeQL 中，6 条由随机源、转义或测试契约修复，3 条来自离线设计 HTML 原型的窄路径排除；开放 CodeQL 为 0，且不存在人工 dismiss。

## 2026-10-31 复核记录（Dependabot 21 条）

- 开放 Dependabot 21 条均来自 `package-lock.json`：`undici`（11）、嵌套 `vite`（5）、`fast-uri`（4）、`serialize-javascript`（1）、`minimatch`（1）、`deepmerge`（1）。
- 修复：`fix/security-dependabot-alerts` 通过 overrides 将 `undici` 升至 `6.29.1` / `8.12.3`（jsdom）、vitepress 嵌套 `vite` 升至 `6.4.4+`、`minimatch` `11.0.1+`、`fast-uri` `3.1.9+`、`serialize-javascript` `7.1.3+`；同步 SBOM/许可证与根 `CHANGELOG.md`。
- `deepmerge`（GHSA-gcqx-w48m-w2h4）：npm 最新仍为 `4.3.1`，无修复版本；经 `vite-plugin-pwa` → `workbox-build` 传递，仅构建/PWA 离线包路径、非浏览器运行时。合并后在 Security 页以 `no fix available` 关闭并保留本记录，不人工 bulk dismiss 其它项。
- Dependabot 自动 PR：新增 `.github/dependabot.yml` 且 `open-pull-requests-limit: 0`；关闭 superseded 的机器人 PR `#348`，后续依赖升级走人工季度/安全批次。

## 2026-10-31 复核记录（CodeQL / 早期 Dependabot）

本轮开放告警 8 条：CodeQL 4、Dependabot 4、Secret scanning 0。

### CodeQL 20–23：`js/shell-command-injection-from-environment`

- 位置：`e2e/fixtures/runtime-progress/` 下 `fixture.ts`、`importWorkerPipelineFixture.ts`、`dispatchWorkerPipelineFixture.ts`、`exportWorkflowReplayFixture.ts`，警告级。
- 判读：不是“测试代码就不算”的误报。危险调用确实把环境推导的绝对路径（`__dirname` 推导的后端根、`E2E_*_WORKER_JAR` 指定的 JAR）传进了 `spawn('bash', ['-c', <内联脚本>, ...])`。内联脚本对位置参数做了双引号包裹，实际注入面有限，但“命令串”和“数据”混在一起，后续维护容易引入真实注入。
- 修复：新增 `e2e/fixtures/runtime-progress/start-worker.sh`，统一负责 `cd` 后端根、`source scripts/lib/env-common.sh`、加载本地 JVM 环境后 `exec java`；四个夹具改为 `spawn('bash', [start-worker.sh, ...显式数据参数])`，不再使用 `bash -c`。JVM 参数用 `--java-opt` 传入，应用参数放在 `--` 之后；空数组用 `${arr[@]+"${arr[@]}"}` 兼容 macOS 自带 bash 3.2。
- 定向验证：`bash -n`、`shellcheck -S warning`（`npm run check:shell`）、`npm run check:comments`、`npx eslint` 通过；用假 `java` 桩逐一核对四个夹具最终 JVM/应用参数与改造前一致，包括带空格的 NAS 目录和 `-Djava.io.tmpdir`。
- 未执行：真实后端 runtime-progress E2E 未运行（需要独占后端、JAR、Kafka、对象存储与 NAS，见 `e2e/fixtures/runtime-progress/README.md`），不能据此写成业务验收通过。
- 状态：代码已修复，等 PR 合并后由 main 的完整 CodeQL 扫描确认关闭。

### Dependabot 1–4：`follow-redirects` / `markdown-it`

- 4 条均为 runtime 依赖：axios → `follow-redirects`（High×2），`markdown-it` 直接依赖（High、Low）。
- 判读：锁文件已在 `b3624a5`（2026-10-31）修复：`follow-redirects` 1.16.0 → 1.16.2、`markdown-it` 15.0.2 → 15.0.3（`package.json` 同步为 `^15.0.3`），均高于公告修复版本（1.16.1 / 15.0.3）。
- 定向验证：`package-lock.json` 解析版本与 GitHub 依赖图 SBOM（`follow-redirects 1.16.2`、`markdown-it 15.0.3`）一致。
- 状态：无需再改代码；告警等待 GitHub 下次 Dependabot 扫描自动关闭，不用人工 dismiss。

### 残余风险

- `npm audit` 仍有 dev-only High（`undici` 经 jsdom、`vite` 经 vitepress），当前无可用修复版本，不在 Dependabot runtime 告警内；按季度依赖治理跟踪，不能外推为 runtime 风险已清零。

## 本地与 GitHub 核查

```bash
npm run check:docs
npm run typecheck
npm run check:i18n
npm run check:comments
npm run test:unit -- <受影响测试文件>
gh run list --repo pinpols/batch-console --workflow codeql --branch main --limit 3
gh api 'repos/pinpols/batch-console/code-scanning/alerts?state=open&ref=refs/heads/main&per_page=100' --paginate
```

按变更补充 lint、API drift、构建和真实后端联测;不要求纯文档修改执行全量业务测试。Dependabot / Secret scanning 另查对应 Security 页或 API,CodeQL 清零不能替代它们。

## 后续门禁原则

维持现有 PR / main CodeQL,优先处理新增或重新打开告警。历史项按明确计划逐步消化。新增自动守护先报告,再基线增量阻断;不得在缺乏稳定规则和可复现证据时对全部历史文件强制失败。

每次交付记录告警编号、规则、修复提交、PR、定向验证、扫描提交、状态与残余风险。PR 扫描通过、合并和 main 告警关闭是三个独立事实。

依赖更新采用季度集中治理：自动扫描与告警持续运行，但 Renovate/Dependabot 不自动创建修复 PR。季度工作流只生成盘点和一张 Issue，由维护者建立一张人工 PR；可达的 Critical/High 漏洞仍按紧急安全例外立即处理。

后端采用对应 `docs/runbook/security-scan.md` 处理 Java 日志、私有落盘、授权与租户边界。前端不复制后端权限决策或存储治理实现。
