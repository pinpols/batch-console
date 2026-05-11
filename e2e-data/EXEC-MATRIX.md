# 执行顺序、互斥关系、清理策略

## 1. 依赖关系图

```
                        00-tenant-lifecycle (Always FIRST,造租户壳)
                                │
                ┌───────────────┴───────────────┐
                ↓                               ↓
       01-tenant-config-import         (单独 system 租户即可,无需 ta/tb/tc)
       (Excel 导入,补完 ta/tb/tc 的         ↓
        JobDef/Queue/FileTpl 等)        08-system-level
                │                       10-rbac-users
                │                       07-outbox-stuck (BE seed)
                ↓
   ┌────────────┼────────────┬───────────┐
   ↓            ↓            ↓           ↓
03-instance  04-approvals  05-release  06-file-pipeline
状态机        待审批         发布六步     文件流
   │            │            │           │
   └─→ 09-self-service ←─┘   │           │
       (依赖 03 的 instance)  │           │
                              │           │
            02-excel-edge-cases (独立,任意时机插)
```

**强依赖**(上游不跑,下游空表 / 必失败):

| 下游 | 强依赖上游 | 依赖什么 |
|---|---|---|
| 01- | 00- | ta/tb/tc 已存在 |
| 03/04/05/06 | 01- | JobDef/Queue/FileTpl 等 |
| 09- | 03- | 至少 1 个 SUCCESS instance + 1 个 FAILED instance |
| 04- 配置审批 tab | 05- step 2 | 1 条 SUBMITTED 的 ConfigRelease |

## 2. 互斥/竞争关系(并行跑会互相污染)

| A | 与 B 互斥的原因 | 怎么办 |
|---|---|---|
| **04-Catch-up approve** | **03-instance** | catch-up 通过会自动建 instance,污染 03 的实例池统计 | 04 完成后再跑 03,或反之 |
| **05-publish 全量发布** | **03/04/06**(任何依赖配置的) | 配置切版本,运行时 worker 加载新版,中间态可能让 03 失败 | 同租户内串行;或在专用租户(th)做 publish |
| **00-delete 租户** | **任何依赖该租户的场景** | 数据清空 | 删除前先确认无待办 instance/approval |
| **批量 toggle JobDef** | **03-trigger** | toggle disabled 后不能 trigger | 跑 03 前确认目标 jobDef enabled |
| **08-rotate APIKey** | 任何用 APIKey 的脚本 | 旧 key 立即失效 | 系统级测试串行;不和业务测试同环境 |
| **10-用户 disable/reset-password** | 同用户其它登录会话 | 立即踢登录 | 用专用测试用户,不动 admin |

**安全并行**(无共享状态,可同时跑):
- 02-excel-edge-cases ⇄ 任何
- 07-outbox-stuck ⇄ 任何业务场景
- 08-system-level(在 system 租户)⇄ 03~06(在 ta/tb/tc 租户)
- ta vs tb vs tc:**租户隔离设计**保证业务接口跨租户互不影响 → 同一类场景可在三租户并行跑

## 3. 租户分工策略(避免交叉污染)

| 租户 | 角色 | 谁动谁 |
|---|---|---|
| **system** | 系统级测试专用 | 08/10/07 |
| **default-tenant** | 配置模板源(给 init/copy 用) | **只读**,任何场景禁写 |
| **ta** | 业务主测,稳定基线 | 03/04/05/06 都在这里 |
| **tb** | 配置变更测试(publish 等高破坏力) | 05- 全量发布跑这里,不影响 ta |
| **tc** | 空态/边界测试 | 故意保留少量数据;测空列表/初始化等 |
| **td/te/tf/tg/th**(临时) | 00-lifecycle 自己造的 | 跑完即删 |

## 4. 清理策略

### 三档力度

#### A. 软重置(测一次场景后,租户保留,数据回到 baseline)
适用:跑完 03-instance、04-approvals,只想清掉本次产生的实例/审批

```bash
./cleanup-soft.sh ta       # 删 ta 内本测试会话产生的 instance/approval/release
```
实现:用 admin token 调:
- DELETE 待审批 PENDING approvals(by 时间窗口)
- 软删 RUNNING/FAILED instances(BE 一般有"丢弃"接口)
- 删除 SUBMITTED/DRAFT ConfigRelease

#### B. 配置重置(回到 01-Excel 导入后的状态)
适用:测了 05-publish 把配置改乱,想回到 baseline

```bash
./cleanup-config.sh ta     # 重导入 ta-tenant-config-package-test.xlsx
```
实现:
1. POST `/config/sync/import` 整包覆盖
2. 或:先 DELETE 该租户全部 jobDef/queue 再 reimport

#### C. 硬清理(删除所有临时租户 + 还原永久租户)
适用:整轮测试结束,留干净环境给下一轮

```bash
./cleanup-hard.sh
```
实现:
1. 遍历删除 td/te/tf/tg/th(POST suspend → DELETE)
2. 跳过 ta/tb/tc(永久基线,只软重置)
3. 系统级清理:删测试 APIKey/Webhook/Tag/Notification/User
4. 输出:租户列表只剩 system + default-tenant + ta/tb/tc

### 命名约定(让脚本能识别"自己造的")

所有测试期产生的实体都打前缀 / tag:
- 租户 ID:`td/te/tf/tg/th`(已经是固定后缀)
- APIKey name:`test-api-key-*`
- Webhook name:`test-webhook-*`
- Tag:`test-tag-*`
- Notification channel code:`test-channel-*`
- 用户名:`test-user-*` 或 `op-{tenantId}`(批量造的)

cleanup 脚本只删带 `test-` 前缀的,误伤为零。

### 清理时机

| 时机 | 动作 |
|---|---|
| 每个 scenario 跑完 | 自动 soft-reset(scenario 内置 `--auto-cleanup`) |
| 一轮 CI/手测结束 | 手动 `cleanup-hard.sh` |
| 切环境前 | 强制 hard cleanup |
| 数据库重建后 | 跑 00- + 01- 重新引导 |

## 5. 推荐执行顺序

### 完整一轮(冷启动→收尾)
```bash
00/seed-tenants.sh                # 5 分钟,造 td/te/.../th
01/(手动)上传 ta/tb/tc 3 个 Excel    # 10 分钟,FE 走向导
02/(手动)Excel 错误回显             # 5 分钟
03/(BE seed) seed-job-instances.sh   # 1 分钟
04/(BE seed) seed-pending-approvals.sh  # 1 分钟
05/(手动)发布六步                   # 8 分钟
06/(手动)文件流                     # 5 分钟
07/(BE seed) seed-outbox-stuck.sh   # 1 分钟
08/(手动+脚本)系统级 CRUD            # 10 分钟
09/(手动+payload)自助               # 5 分钟
10/(脚本)RBAC users + 拒绝矩阵       # 10 分钟
─────────────────────────────────
cleanup-hard.sh                  # 1 分钟,收尾
```
全程约 **60 分钟**(初次手动)/ **15 分钟**(脚本化后回归跑)。

### 增量回归(只测改动相关)
- 改 JobDef CRUD → 跑 03 + 04
- 改租户管理 → 跑 00 + 10
- 改文件流 → 跑 06
- 全量回归 → 上面完整一轮
