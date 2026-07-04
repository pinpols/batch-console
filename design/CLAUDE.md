# 项目记忆

## 前端仓库
- https://github.com/pinpols/batch-console (owner: pinpols)
- 设计定稿目标路径:`docs/design/batch-console-设计定稿.html`

## 设计源文件
- 唯一权威源:`Batch Console 重设计-v2-多屏.html`(13 页多屏交互原型,2026-07-04)
- 交付时用 super_inline_html 导出离线单文件后再推 Git / 下载

## 关键决策(用户已拍板)
- Workflow:设计器 + 只读视图 两种都做(只读态提示"编辑请走 Excel 包导入")
- 运行实例:双列表(作业运行 + 工作流运行),非统一大表
- IA:IA v3 / 7 组(2026-07-03 定:工作台、运行监控、告警与投递、作业与流程、文件、调度治理、系统管理);低频 admin 页不进侧栏,走 Command Palette
- 术语:统一到实现端(流水线定义/报表中心/作业运行/全部运行/文件列表/租户实例/登录账户/发布管理/变更与同步/权限自查)
