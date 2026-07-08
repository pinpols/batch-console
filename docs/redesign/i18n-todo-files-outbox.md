> ✅ 已全部落库(2026-07-04):本清单键值已补进 src/locales zh/en,check:i18n 绿。留档仅作追溯。
# i18n TODO — FileList / OutboxList redesign(proto-files / proto-outbox 对齐)

> 本轮 redesign 禁改 `src/locales/`,以下新 key 已在模板中以 `t()` 正常引用,
> 待统一补进 `src/locales/zh-CN.ts` / `src/locales/en-US.ts`(1:1 对齐,`npm run check:i18n` 验证)。

## 新增 key

| Key | zh-CN 建议 | en-US 建议 | 用在哪 |
|---|---|---|---|
| `observability.outboxStatSuccess` | `投递成功` | `Delivered` | `src/views/observability/OutboxList.vue` 头部统计 pill(对应 dump「今日成功」;后端无按日汇总端点,口径为当前 tab 已加载数据中的成功态计数,故不用「今日」措辞) |

## 复用的既有 key(无需新增)

- `jobInstanceList.liveTitle` / `jobInstanceList.liveEvery` / `jobInstanceList.liveLast` — OutboxList 页级实时条(与 AlertList 复用同一组 key 的先例一致)。
- FileList 本轮无新增 key(汇总卡「›」为纯视觉元素;筛选区仅调整顺序)。
