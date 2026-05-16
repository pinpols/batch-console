# BE 修复 backlog (Phase 1 API CRUD 测试发现)

> 由 `e2e-data/api-crud.sh` 在 tx 隔离租户上跑全实体 CRUD 抓到的 BE 端问题。
> **最终 Phase 1 结果**: **PASS 42 / FAIL 0 / SKIP 0** ✅
> 报告: `/tmp/api-crud-report.md`
>
> **已修复**: ISSUE-2 / ISSUE-3 / ISSUE-4 / ISSUE-5 / ISSUE-6 部分
> **待 BE owner 决定**: ISSUE-6 完整版 (其他实体 UPDATE merge) / ISSUE-7 (设计行为)

## BE-ISSUE-2: DataIntegrityViolationException 误报 500

**症状**: DB check / not-null / unique / FK 约束违反时,响应 500 `SYSTEM_ERROR`。应是 400 + 具体字段说明。

**根因**: `ConsoleApiExceptionHandler` 没单独处理 `DataIntegrityViolationException`,fall 到通用 `Exception.class` → 500。

**修复**: 在 `batch-console-api/src/main/java/com/example/batch/console/support/web/ConsoleApiExceptionHandler.java` 加:

```java
import org.springframework.dao.DataIntegrityViolationException;

@ExceptionHandler(DataIntegrityViolationException.class)
public ResponseEntity<?> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
  log.warn("console data integrity violation", ex);
  String message = "数据约束错误";
  Throwable root = ex.getMostSpecificCause();
  if (root != null && root.getMessage() != null) {
    String msg = root.getMessage();
    if (msg.contains("violates check constraint")) {
      int idx = msg.indexOf("\"", msg.indexOf("constraint"));
      if (idx > 0) {
        int end = msg.indexOf("\"", idx + 1);
        if (end > idx) message = "字段值不合法,违反约束: " + msg.substring(idx + 1, end);
      }
    } else if (msg.contains("violates unique constraint")) {
      message = "记录已存在(唯一键冲突)";
    } else if (msg.contains("violates foreign key constraint")) {
      message = "关联数据缺失或无法删除(外键约束)";
    } else if (msg.contains("violates not-null constraint")) {
      // 解析列名:'null value in column "X" of relation'
      int colStart = msg.indexOf("\"");
      int colEnd = msg.indexOf("\"", colStart + 1);
      if (colStart >= 0 && colEnd > colStart) {
        message = "必填字段缺失: " + msg.substring(colStart + 1, colEnd);
      } else {
        message = "必填字段缺失";
      }
    }
  }
  return ResponseEntity.badRequest()
      .body(responseFactory.failure(ResultCode.VALIDATION_ERROR, message));
}
```

**优先级**: 高。生产环境用户填错字段值就看到 500,定位问题难。

---

## BE-ISSUE-3: single-session=true 阻塞 e2e harness

**症状**: `BATCH_CONSOLE_SINGLE_SESSION_ENABLED=true` (默认) 时,任何 admin 登录都会让前一个 JWT 立即失效。e2e 自动化共享 storageState 会全部 redirect 到 /login。

**修复**(任选):
1. **生产**: 在 `singleSessionEnabled=true` 之上加 N 秒 grace period
2. **测试**: 测试环境 `application-local.yml` 改 `single-session-enabled: false`
3. **FE**: 当前 401 自动 silent refresh 已实现? 若否,加 axios 401 interceptor + `/auth/token` refresh

**优先级**: 中(影响 e2e 自动化稳定性,不影响人手测)。

---

## BE-ISSUE-4: file_template_config / file_channel_config 多个 NOT NULL 字段 BE 不默认

**症状**: POST `/file-templates`、POST `/file-channels` 时,DB 的 `NOT NULL DEFAULT X` 字段被 BE 显式塞 `null` → 触发 not-null violation → 500。

**已发现的字段** (来自 V6/V18/V14 等迁移 + Phase 1 跑出的报错):

| 表 | 字段 | DB 默认 | BE 当前行为 |
|---|---|---|---|
| file_template_config | `with_bom` | FALSE | null → 报错 |
| file_template_config | `streaming_enabled` | TRUE | null → 报错 |
| file_template_config | `page_size` | 1000 | null → 报错 |
| file_template_config | `fetch_size` | 1000 | null → 报错 |
| file_template_config | `chunk_size` | 500 | null → 报错 |
| file_template_config | `record_length` | 0 | null → 报错 |
| file_template_config | `header_rows` | 0 | null → 报错 |
| file_template_config | `footer_rows` | 0 | null → 报错 |
| file_template_config | `checksum_type` | 'NONE' | null → 报错 |
| file_template_config | `compress_type` | 'NONE' | null → 报错 |
| file_template_config | `encrypt_type` | 'NONE' | null → 报错 |
| file_template_config | `preview_masking_enabled` | FALSE | null → 报错 |
| file_template_config | `error_line_masking_enabled` | FALSE | null → 报错 |
| file_template_config | `log_masking_enabled` | FALSE | null → 报错 |
| file_template_config | `content_encryption_enabled` | FALSE | null → 报错 |
| file_template_config | `download_requires_approval` | FALSE | null → 报错 |
| file_channel_config | `config_json` | '{}' | null → 报错 |

**根因**: MyBatis mapper 显式传 `null`(因为 Service 把 request.getXxx() 直接传给 param,FE 不传时是 null),DB DEFAULT 不生效(只在 INSERT 完全省略该列时生效)。

**修复**: Application Service 层在 create 时给每个 nullable 字段补默认值,模式参考 `DefaultConsoleResourceQueueApplicationService.create()`:
```java
params.put("max_running_jobs", request.getMaxRunningJobs() != null ? request.getMaxRunningJobs() : 0);
```

需要同样改造:
- `DefaultConsoleFileTemplateApplicationService.create()` (~15 字段)
- `DefaultConsoleFileChannelApplicationService.create()` (~2 字段)

**Workaround**: api-crud.sh 已经把所有这些字段在 payload 里显式传,Phase 1 跑通。但 **UI 用户不可能填这么多隐藏字段**,所以这个 BE bug 必须修。

**优先级**: 高(UI 层创建文件模板/渠道当前就是 500)。

---

## BE-ISSUE-5: FileChannelConfigUpsertParam 缺 id setter

**症状**: POST `/api/console/file-channels` 返回 500,日志:
```
No setter found for the keyProperty 'id' in 'com.example.batch.console.domain.param.FileChannelConfigUpsertParam'
```

**根因**: MyBatis 在 INSERT 之后回写自增 id 到 param 对象,需要 setId() setter。该类 (Java record 或 missing @Setter Lombok) 没有。INSERT SQL 实际可能执行成功,但回写失败 → 500;后续的 list 查不到 (Spring 事务回滚)。

**修复**: 给 `FileChannelConfigUpsertParam.java` 加 setter 或确保 `@Data` Lombok 注解(参考同包 `ResourceQueueUpsertParam` 是怎么做的)。

文件路径(BE 仓):`batch-console-api/src/main/java/com/example/batch/console/domain/param/FileChannelConfigUpsertParam.java`

**优先级**: 高(文件渠道 CREATE 完全不可用)。

---

## BE-ISSUE-6: alert_routing / business_calendar / queue 等 UPDATE 不 merge,DTO 的 @NotBlank 在 PATCH 语义下没意义

**症状**:
- PUT `/alert-routings/{id}` 只传几个字段会报 `null value in column "alert_group"`
- PUT `/calendars/{id}` 只传 `calendarName` 会报 `@NotBlank` 验证错

**根因**: 这些 update 方法把 request 直接传给 mapper update,不与 existing 合并。配额策略和资源队列做了 merge (`request.getXxx() != null ? ... : existing.get("...")`),其他实体没。

**修复**(参考 `DefaultConsoleResourceQueueApplicationService.update()` 的 merge pattern):
- `DefaultConsoleAlertRoutingApplicationService.update()`
- `DefaultConsoleBusinessCalendarApplicationService.update()`
- `DefaultConsoleBatchWindowApplicationService.update()`
- `DefaultConsoleFileTemplateApplicationService.update()`
- `DefaultConsoleFileChannelApplicationService.update()`

**优先级**: 中(workaround: UI 编辑时把 detail 整体传回去,不要 PATCH)。

---

## BE-ISSUE-7: 通知渠道 CREATE 响应缺 id

**症状**: POST `/api/console/notifications/channels` 返回 200,但 `data` 没 `id` 字段。

**根因**: `DefaultConsoleNotificationChannelApplicationService.create()` 可能返回 `void` 或返回的 Map 没 put id。

**影响**: FE 创建后想立即编辑该渠道,拿不到 id,需要重新 list。

**优先级**: 低(UX 不优雅,功能可用)。

---

## Phase 1 已验证 OK 的实体 (39 PASS)

- 资源队列 (LCUT 全过)
- 批次窗口 (LCUT 全过)
- 业务日历 (LCUT 全过)
- 配额策略 (LCUT 全过)
- 告警路由 (LCUT 全过)
- 文件模板 (LCU 全过,无 TOGGLE)
- Job 定义 (LCRU 全过)
- Pipeline 定义 (LCRU 全过)
- API Key (LC 全过)
- Webhook (LCD 全过)
- 通知渠道 (LC,见 BE-ISSUE-7)

**Phase 1 唯一 FAIL**: 文件渠道 CREATE (BE-ISSUE-5)。
