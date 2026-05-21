# FE 验收 backlog(2026-05-21)

## 工具链 / 环境(不修主代码)
- [ ] `vite preview` 默认端口 5173 与 dev server 冲突,实际跑到 5174;skill 文档说的 4173 是 vite 默认,但本项目 `vite.config.ts preview.port=5173`。归档:验收脚本应判断动态端口。

## 代码 debt(可独立 PR,本轮非阻断)
- [ ] PipelineDefinitionList 步骤色用了 4 个裸 hex(`#3b82f6` / `#8b5cf6` / `#06b6d4` / `#10b981`),应迁到 design token。设计 debt,不阻断验收。
- [ ] `e2e/cross-navigation.spec.ts:18` 「点击待审批卡片」上轮 smoke 偶发失败,本轮全量未复现;若再出现观察是否是 BE seed 数据竞态。

## 他人 commit 引入违约
- 无

## 本会话引入但已修
- [x] `e2e/navigation.spec.ts` 测试用了旧菜单组名 / 没处理 1280×720 侧栏 collapse
- [x] `e2e/cross-navigation.spec.ts` `status=` → `statuses=` 同步
- [x] `src/types/api.generated.ts` 同步到最新 BE OpenAPI(包含 V148/V149 后的 admin 端点)

## flaky / 性能(独立 PR)
- 无新增(本轮 681 e2e 全过)
