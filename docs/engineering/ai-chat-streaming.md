# AI 对话流式交互

桌面 AI 页面与全局抽屉共用 `useAiChatSession`。发送采用 `POST /api/console/ai/chat/stream` 的 SSE：`started` 携带 requestId，`delta` 是增量纯文本，`completed` 携带权威的 `AiChatResponse`。只有收到 `completed` 才算本轮成功；断流、协议错误和 `failed` 事件均保留原问题供重试。生成中显示纯文本，结束后才使用安全 Markdown 渲染。停止按钮调用同一操作者限定的取消端点并关闭连接；服务端仍需结算和审计。

浏览器原生 `EventSource` 不支持带 JSON 请求体的 POST，因此本链路使用 `fetch` + `eventsource-parser`，显式携带 HttpOnly Cookie、CSRF、租户、幂等键和语言头。旧 `/chat` JSON 接口已移除。`src/types/api.generated.ts` 只能由后端 OpenAPI 生成。

文本附件是本地读取的 UTF-8 `.txt/.md/.log`，单文件上限 8 KiB；问题和附件合并后的后端 prompt 上限是 4000 字符。文件内容随问题发送给已配置的模型，并受现有会话持久化策略约束；这不是文件管理功能，也不允许上传图片或读取系统业务文件。用户应先清除密钥和敏感原文。附件仅在成功发送后从编辑器清空，失败时保留供修改重试。

验证入口：`src/api/aiStream.test.ts`、`src/utils/aiTextAttachment.test.ts`、`src/composables/useAiChatSession.test.ts`；真实供应商、反向代理缓冲与浏览器断网行为仍需在部署环境联测。
