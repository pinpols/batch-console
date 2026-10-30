# 前后端Skill界面元数据与按需参考整理

日期：2026-10-26。两仓为`fix/wdi-current`；前端HEAD `662d254`、后端HEAD `f3d5e400d`，均含大量已有暂存和未暂存改动。本轮仅补Skill结构及维护说明，保留其他任务改动，不提交或推送，不修改应用、API、运行配置或个人偏好。

## 实际决定

| 项目 | 处理与边界 |
|---|---|
| 前端界面元数据 | 使用官方skill-creator生成原先缺少的10份`agents/openai.yaml`，包含中文显示名、短说明与明确引用本Skill的默认调用提示；前端现行12个Skill全部具备界面元数据。 |
| 原有元数据 | 后端27份与前端原有2份保留原字节，不更改界面字段、调用策略、工具依赖，也不机械添加可选字段。 |
| 前端参考 | 将测试Skill的运行进度真实验收详细方法完整提取到[按需参考](../../.agents/skills/frontend-testing-ci/references/runtime-progress-acceptance.md)，入口保留适用条件。 |
| 后端参考 | 将文档治理Skill的证据保留和全量提炼方法完整提取到[按需参考](../../../file-batch-system/.agents/skills/documentation-governance/references/evidence-preservation-and-extraction.md)，原入口标题及DOC-1／DOC-2锚点保留。 |
| 其余技能 | 短入口继续引用权威文档；已有references保持职责和入口，不为目录数量复制手册或创建空文件。个人偏好不复制到各Skill。 |

当前共39个Skill：前端12、后端27，均有界面元数据。references按需存在于前端2个、后端23个Skill，共29份参考文件；数量是本次结构快照，不是后续每个Skill必须具备的目录要求。自动任务匹配继续依据`SKILL.md`的`description`，界面显示名不是`$skill`命令别名。

## 原方法与维护入口

两段提取正文与原Skill对应内容逐字节一致，保留故障前提、反例、环境／权限／清理条件和证据层级。提取不是重新认证历史PASS；参考中的可执行命令也不自动授权真实环境写入。详细摘要及逐文件角色见[本轮范围表](skill-metadata-reference-coverage-2026-10-26.csv)。

前端[使用指南](../engineering/agent-skills-guide.md)、[脚本路由](../engineering/script-skill-routing.md)、规范Changelog与报告索引同步；后端[使用指南](../../../file-batch-system/docs/standards/agent-skills-guide.md)、规范Changelog及原治理审计记录补充本轮事实。没有新增或改名Skill，因此不重复修改AGENTS技能目录。

前端历史文档／脚本来源表追加本轮新增资产及原未单列的界面元数据，原摘要与上轮验收结论保留。12份界面元数据包含新增10份与原有2份；连同新参考和本报告，本轮补登记14项。原记录分母按对应审计时点解释，本次新增登记不等于重新审查整个当前工作树。工作期间已有其他任务新增业务修复报告及修改既有文档，本轮只验证本任务Skill及维护说明的结构、调用边界和原方法保留，不覆盖并行任务正文、不继承旧清单对其他变更的验收。

## 检查与证据边界

本轮检查39个Skill格式、全部界面YAML、参考入口及新参考的路径／锚点、原29份元数据不变、两段提取正文守恒，以及前后端适用文档守卫。结构校验和文档检查不证明所有技能在所有业务场景下的行为有效性。本轮未启动真实服务、应用测试或故障注入。

| 实际检查 | 结果 |
|---|---|
| 官方`quick_validate.py`逐Skill检查 | 前端12／后端27，共39项通过 |
| 界面YAML、默认提示、策略与依赖 | 39份通过；新增10份均引用本Skill，未添加策略或依赖；原29份逐字节不变 |
| references入口及新提取方法 | 29份非空且有所属入口；新参考路径与原锚点可达，两段提取正文摘要一致 |
| 前端`check:docs`／`check:changelog` | 通过；文档检查75篇当前资料，不替代本轮116行范围表；Changelog脚本另配合人工核对规范记录 |
| 后端文档结构／代码文档引用／日期策略／Changelog同步 | 四项均通过 |
| `npm run docs:build` | 退出0；4项分卷回归及既有chunk／搜索预算通过，日志`/private/tmp/wdi-skills-docs-build-20261026.log` |

本轮范围表记录116个实际输入／输出资产的角色与当前摘要，避免把元数据当执行脚本，也不覆盖原历史来源摘要。文档站沿用既有死链降级策略，本轮`neutralized=1840`，不声称全站零死链；本轮未改变发布器、应用功能或生成类型。未提交、推送或创建PR。
