# 统一文档站超长证据发布与导航复验

日期：2026-10-26。两仓为 `fix/wdi-current`，前端 HEAD `662d254`、后端 HEAD `f3d5e400d`；结论针对当前脏工作树，不代表提交、CI、部署或生产验收。

## 问题与处理

原构建完成编译和渲染，但两份后端历史证据的单页 JS 与统一搜索索引超出既有预算。没有删除证据或扩大预算：`docs-prepare.mjs` 仅将显式清单内的生成副本按完整 Markdown 块分卷，权威执行记录正文保留。原路径发布目录，完整章节锚点映射由可信主题读取元数据；每卷有原文行范围及前后卷／目录导航。工程标准与 ADR 一样采用标题索引，正文完整发布；当前设计、API、产品指南与运行手册继续全文索引。

第一版构建通过，但浏览器发现 Markdown HTML 禁用使内嵌脚本和锚点标签显示为文本，旧链接没有跳转。修复为页面元数据加主题导航，保持 HTML 禁用，并限制同目录、同基名分卷目的地。第二版真实浏览器已验证首卷旧锚点、末卷旧锚点、查询参数与锚点保留，以及 014→013→014 和完整目录跳转。

实际点击原文“执行证据记录”又发现两条既有导航使用了错误 slug。只修正配对后端执行日志的两条导航引用：数字开头增加实际 `_` 前缀，早期章节补实际分隔符；执行证据正文不变。修正后的最终构建与点击结果追加于本记录，不继承第二版的旧摘要。

## 方法与资产

- `scripts/lib/docs-publication.mjs`：原始字节分配、完整块边界、重复／自定义锚点保留；不能安全拆分的超大块、HTML 容器、引用式链接明确失败。
- `scripts/tests/docs-publication.test.mjs`：4 项 Node 回归，覆盖正文完整性、块边界、锚点与导航目的地限制；由正式 `docs:build` 自动执行。
- 主题 `publicationNavigation.mjs`：仅根据元数据在本文分卷间跳转，拒绝外部 URL、路径穿越和其他文档目的地；保留查询参数及 hash。
- [长期发布方法](../engineering/unified-documentation-site.md)、[脚本路由](../engineering/script-skill-routing.md)和文档治理 Skill 同步更新，未另建同义 Skill。预检覆盖新增库、测试和主题。

## 验证与边界

第二版 `npm run docs:build` 退出 0，4 项发布回归通过；普通 chunk 最大 raw 796588／gzip 205166 字节，搜索 raw 4271276／gzip 1177555 字节，均低于现行 850000／220000 与 4500000／1230000 预算。最终数字以[完整性证据](assets/document-publication-2026-10-26/integrity-evidence.json)为准。

两源分别发布 10／14 卷，原始标题 ID 22／748 个全部保留；按原文逐字节重组和已渲染 HTML 标题核对无遗漏或重复。截图已人工查看，目录与目标章节清楚，无原始脚本泄漏：

- [完整目录](assets/document-publication-2026-10-26/publication-directory.png)
- [原文旧锚点](assets/document-publication-2026-10-26/publication-original-anchor.png)
- [浏览器目标读回](assets/document-publication-2026-10-26/browser-first-anchor.log)

构建沿用既有死链降级策略，第二版 `neutralized=1770`，不声称全站零死链。初始独立预览存在 `/favicon.ico` 404，不算应用异常已修复。该证据仅证明本地发布内容、预算及本次导航；未验证生产 Nginx 登录入口。原始失败记录保留在[此前联调报告](2026-10-26-workflow-failed-node-replay.md#统一文档站构建边界)。

## 修正导航后的最终结果

第三版完整构建退出0，4项回归通过，体积门禁通过。普通chunk最大raw 796588／gzip 205184字节；搜索raw 4268016／gzip 1177574字节。原文重组、生成Markdown和渲染HTML逐一核对，10／14卷及22／748个锚点均完整。执行日志导航修正后摘要为`2020ea6782c03afee0db41e6d180118a53fdfbbafc5fd7d93fae8fd9d8c6de42`；另一原文摘要未变。

两条正文链接均已在最新预览实际点击，最终回到分卷001且分别命中“1. 早期阶段证据（截至 2026-10-15）”与“2. 按批次追加的执行证据”：见[第一条读回](assets/document-publication-2026-10-26/browser-early-anchor-final.log)和[第二条读回](assets/document-publication-2026-10-26/browser-body-anchor-final.log)。前文截图记录第二版页面布局及当时摘要；最终摘要与完整性以最新JSON为准，不把旧截图冒充第三版。第三版既有降级记录为`neutralized=1772`，没有宣称全站链接均有效。专属浏览器及5181预览已关闭。

本批首轮完整`verify:local`退出0，198文件／1131项测试通过，覆盖率语句63.59%／分支56.93%／函数53.64%／行65.34%，构建、预算与生产依赖0漏洞通过。收口另发现死信页租户读取竞态，正在同一主计划内修复并复跑受影响门禁；文档发布处理项已关闭，整体功能目标不由该记录独立关闭。

后续死信读取竞态已先红后绿修复，最终完整本地门禁198文件／1134项通过；最新前端构建DISPATCH真实复验1/1、0重试、77项零残留通过。第五轮磁盘空间失败和第六轮最终成功分别记录在[DISPATCH报告](2026-10-26-dispatch-worker-pipeline-progress.md#最终构建后的读取隔离与复验)。当前403来源及12个现行Skill格式均复核完成，主矩阵统一维护17项功能范围结论。
