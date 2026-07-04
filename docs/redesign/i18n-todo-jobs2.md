# i18n TODO — JobDefinitionList 三态抽屉 / TenantList redesign(proto-jobs_* / proto-nav-租户实例 对齐)

> 本轮 redesign 禁改 `src/locales/`,以下新 key 已在模板中以 `t()` 正常引用,
> 待统一补进 `src/locales/zh-CN.ts` / `src/locales/en-US.ts`(1:1 对齐,`npm run check:i18n` 验证)。

## 新增 key

| Key | zh-CN 建议 | en-US 建议 | 用在哪 |
|---|---|---|---|
| `jobDefinitionList.jdDrawerKindLabel` | `作业定义` | `Job Definition` | `src/views/job/JobDefinitionList.vue` → `JobDefinitionDrawer` 头部小 label(dump: OVERLAY 头部 uppercase 小字) |
| `jobDefinitionList.jdDrawerCreateTitle` | `新建 · 作业定义` | `New · Job Definition` | 新建态抽屉 mono 大标题(dump: proto-jobs_create.html) |

## 复用的既有 key(无需新增)

- 抽屉底部操作:`common.close`(关闭)/ `jobDefinitionList.actionExportBundle`(导出)/ `jobDefinitionList.actionEdit`(编辑)/ `jobDefinitionList.drawerCancel`(取消)/ `jobDefinitionList.drawerSave`(保存)/ `jobDefinitionList.drawerCreateSubmit`(新增)。
- 状态 pill:`jobDefinitionList.optEnabled` / `jobDefinitionList.optDisabled`。
- 查看态字段分区:全部复用 `jobConfigBasic.group*` / `jobConfigBasic.field*` / `jobDefinitionList.fileTabNotApplicable` / `jobDefinitionList.detailTabRelatedFiles` / `jobDefinitionList.detailTabRuns` / `jobDefinitionList.detailRunsHint` / `runs.*`(与原 detail drawer 的 tab 口径一致)。
- 弃用不删:`jobDefinitionList.detailTitle` / `detailTabOverview` / `drawerEditTitle` / `drawerEditTitleWithCode` / `drawerCreateTitle` 本轮起模板不再引用(三态抽屉换掉了旧三个 el-drawer 的标题),locale 中保留不影响 `check:i18n`。
- TenantList 本轮无新增 key(TENANT mono 列 / 状态 pill / 操作收纳均复用既有文案)。
