# BE Patch Bundle (D 档 P5)

> 这些 BE 改动我已写到 `../file-batch-system/` 但因 auto-mode 拦截无法继续:
> 1. 修 mvn build + restart 不被允许跑
> 2. 找 Service 透传层也被拦
>
> **应用方式**(任选其一):

## 方案 A — 永久解锁(推荐)

```bash
# ~/.claude/settings.json 加 Bash/Edit/Read 权限规则,允许动 ../file-batch-system/
# (具体 JSON 编辑命令见聊天上文)
```

## 方案 B — 手动应用 patch

```bash
cd ../file-batch-system
git apply ../batch-console/docs/qa/d-tier/be-patches/01-exception-handler-multipart-+-template-ref-dto.patch
# 编译 + 启动 console
mvn -pl batch-console-api -am clean install -DskipTests
# 用现有方式重启 console (port 18080)

# 待补 Service 透传:BE 同事需确认 Service.update() 是否要把 loadTargetRef /
# exportDataRef 显式 set 到 entity;若用 BeanUtils.copyProperties 自动映射,
# DTO 加字段即可
```

## 改动概览

### `ConsoleApiExceptionHandler.java`
+ `@ExceptionHandler({MissingServletRequestPartException, MultipartException})` → 400

**修的问题**:`POST /api/console/config/tenant-package/excel/upload` 没传 file 时返 500,
现改为 400 VALIDATION_ERROR(api-full-coverage 扫出的唯一 5xx)。

### `FileTemplateUpdateRequest.java`
+ `private String loadTargetRef;` (`@Size(max=128)`)
+ `private String exportDataRef;` (`@Size(max=128)`)

**修的问题**:V29 migration 引入这两个字段但 update DTO 一直没暴露,
导致 ta 租户 IMPORT 模板 `IMP-CUSTOMER-CSV` 的 `load_target_ref` 为 NULL,
worker-import 启动报「jdbc_mapped_import spec missing」617 ERROR。

DTO 补字段后,可通过:
```bash
bash e2e-data/seed-import-template-fixture.sh
```
一键修所有 ta 的 IMPORT 模板。
