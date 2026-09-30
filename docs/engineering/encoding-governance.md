# 字符编码治理

## 目标

平台内部文本统一使用 **UTF-8 无 BOM**，消除不同操作系统、编辑器、容器和脚本运行时的默认编码差异。外部批量文件继续遵循业务模板契约，不因平台治理被静默转码。

## 治理范围

| 层次 | 编码约定 | 执行位置 |
| --- | --- | --- |
| 前端源码与资源 | UTF-8 无 BOM、LF | `.editorconfig`、`.gitattributes`、编码门禁 |
| JSON/YAML/XML/SQL/脚本 | UTF-8 无 BOM、LF | 编码门禁、changed preflight、CI |
| Markdown 文档 | UTF-8 无 BOM、LF | 编码门禁、文档检查和文档构建 |
| 浏览器生成的 JSON/SVG | MIME 显式声明 `charset=utf-8` | 下载实现与生产构建 |
| Nginx 文本响应 | UTF-8 | `charset` 与 `charset_types` |
| 构建和运行容器 | `LANG=C.UTF-8`、`LC_ALL=C.UTF-8` | Dockerfile |
| Windows 本地工具 | 输入显式 UTF-8，输出 UTF-8 无 BOM | PowerShell 公共写入函数 |
| 后端源码、API、日志、数据库 | UTF-8 | 后端 EditorConfig、Maven、Spring、容器和 PostgreSQL 配置 |

## 外部业务文件边界

银行、主机和存量系统文件可能明确使用 GBK、GB18030、Big5、UTF-16 等字符集。这些文件不是平台源码，不允许一刀切转换为 UTF-8。

- 前端上传原始字节，只提供本地样本预检，不替代后端权威校验。
- 后端按 `file_template_config.charset` 解析导入文件，未声明时采用后端 UTF-8 默认值。
- 导出按模板 `target_charset` 生成；平台 JSON、日志和控制面协议仍保持 UTF-8。
- 字符集不匹配必须明确失败，不允许依赖操作系统默认编码或静默替换乱码。
- `e2e-data/06-file-pipeline/samples/sample-invalid-encoding.csv` 是 UTF-16LE 反例样本，用于验证非 UTF-8 检测，必须保留原始字节。

## 自动化门禁

`npm run check:encoding` 使用严格 UTF-8 解码检查 Git 已跟踪和待提交的平台文本文件，同时拒绝 UTF-8 BOM。已知二进制文件按扩展名排除，非 UTF-8 业务样本必须在脚本中逐项登记，禁止使用目录级通配豁免。

门禁接入层次：

1. `npm run preflight:changed`：提交前只要存在变更即执行。
2. `npm run verify:governance`：本地完整工程治理入口。
3. `pr-gate.yml`：PR 必过门禁。
4. `full-ci-gate.yml`：主干与定时全量门禁。

新增例外必须同时满足：

1. 文件确实属于外部协议样本或二进制制品，不能通过 UTF-8 表达。
2. 在编码检查脚本中使用精确路径登记。
3. 在本文件说明用途、权威字符集和不可转码原因。
4. 测试能够证明该例外仍在验证真实业务行为。

## 开发约定

- 编辑器启用仓库根目录 `.editorconfig`，不要提交带 BOM 的文本。
- Node.js 文件读写显式使用 `utf8`；浏览器文本 Blob 显式填写 UTF-8 MIME。
- Java 使用 `StandardCharsets.UTF_8`，禁止依赖 `Charset.defaultCharset()`。
- Python 使用 `encoding="utf-8"`；Shell 继承容器或本地 `C.UTF-8` locale。
- PowerShell 不使用 Windows PowerShell 5.1 的默认编码，统一调用 UTF-8 无 BOM 写入函数。
- 发现乱码时先确认原始字节、模板 charset 和 HTTP Content-Type，不在 UI 层猜测并改写数据。

## 本地验证

```bash
npm run check:encoding
npm run preflight:changed:all
npm run build:fast
```

容器配置变更还需验证：

```bash
nginx -t
```

## 故障排查

| 现象 | 优先检查 |
| --- | --- |
| CI 报“不是有效的 UTF-8” | 编辑器保存编码、文件是否属于业务样本、是否误提交二进制文件 |
| CI 报“UTF-8 BOM” | 使用 UTF-8 无 BOM 重新保存，不要直接把文件加入豁免 |
| 浏览器下载中文乱码 | Blob MIME、服务端 Content-Type、消费工具是否忽略 UTF-8 |
| Windows 脚本中文路径乱码 | 输出是否无 BOM、CMD 是否执行 `chcp 65001` |
| 导入文件乱码 | 模板 `charset`、原始文件字节、后端严格解码错误，不先改前端展示 |
| 数据库中文异常 | 数据库初始化编码、连接参数和入库前原始内容 |

## 责任边界

- 前端负责源码、构建、静态响应、本地工具和浏览器生成文本的 UTF-8 一致性。
- 后端负责 API、日志、数据库以及文件模板字符集解析与转换。
- 运维负责容器 locale、数据库初始化参数和部署环境不覆盖编码设置。
- 业务模板维护者负责外部文件真实字符集，不能用自动探测结果替代契约配置。
